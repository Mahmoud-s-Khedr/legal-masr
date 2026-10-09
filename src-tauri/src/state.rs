use crate::errors::Error;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, MutexGuard,
    },
};
use zeroize::Zeroizing;

#[derive(Default)]
pub struct AppState {
    pub master_key: Mutex<Option<Zeroizing<[u8; 32]>>>,
    selected_document_sources: Mutex<HashMap<String, PathBuf>>,
    restore: Mutex<RestoreState>,
    generation: AtomicU64,
    operations: Mutex<()>,
    attachment_operations: Mutex<()>,
    security_operations: Mutex<()>,
}

#[derive(Default)]
struct RestoreState {
    request: u64,
    selection: Option<(String, PathBuf)>,
    prepared: Option<(String, crate::backup::PreparedRestore)>,
}

impl AppState {
    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }
    pub fn check_generation(&self, generation: u64) -> Result<(), Error> {
        if self.generation() == generation {
            Ok(())
        } else {
            Err(Error::Locked)
        }
    }
    pub fn advance_generation(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
    }
    /// All IPC vault access shares this gate; dialogs never hold it. Try-lock keeps
    /// the event loop responsive while a worker authenticates or stages an archive.
    pub fn operation(&self) -> Result<MutexGuard<'_, ()>, Error> {
        self.operations.try_lock().map_err(|_| Error::OperationBusy)
    }
    pub fn store_prepared_restore(
        &self,
        selection: &str,
        generation: u64,
        token: String,
        prepared: crate::backup::PreparedRestore,
    ) -> Result<(), Error> {
        let mut restore = self.restore.lock().map_err(|_| Error::Operation)?;
        self.check_generation(generation)?;
        if restore
            .selection
            .as_ref()
            .is_none_or(|(stored, _)| stored != selection)
        {
            return Err(Error::Validation);
        }
        restore.prepared = Some((token, prepared));
        Ok(())
    }
    pub fn take_prepared_restore(
        &self,
        token: &str,
    ) -> Result<crate::backup::PreparedRestore, Error> {
        let mut restore = self.restore.lock().map_err(|_| Error::Operation)?;
        if restore
            .prepared
            .as_ref()
            .is_none_or(|(stored, _)| stored != token)
        {
            return Err(Error::Validation);
        }
        Ok(restore.prepared.take().ok_or(Error::Validation)?.1)
    }

    pub fn unlocked(&self) -> Result<Zeroizing<[u8; 32]>, Error> {
        self.master_key
            .lock()
            .map_err(|_| Error::Locked)?
            .as_ref()
            .cloned()
            .ok_or(Error::Locked)
    }

    pub fn store_document_source(&self, path: PathBuf) -> Result<String, Error> {
        let key = self.master_key.lock().map_err(|_| Error::Locked)?;
        if key.is_none() {
            return Err(Error::Locked);
        }
        let token = uuid::Uuid::new_v4().to_string();
        self.selected_document_sources
            .lock()
            .map_err(|_| Error::Operation)?
            .insert(token.clone(), path);
        Ok(token)
    }

    pub fn take_document_source(&self, token: &str) -> Result<PathBuf, Error> {
        let key = self.master_key.lock().map_err(|_| Error::Locked)?;
        if key.is_none() {
            return Err(Error::Locked);
        }
        self.selected_document_sources
            .lock()
            .map_err(|_| Error::Operation)?
            .remove(token)
            .ok_or(Error::AttachmentSourceMissing)
    }

    /// The backup file chosen in the native picker for a pending restore. The
    /// path stays in Rust; the renderer only holds the one-time token. A new
    /// selection replaces any earlier one.
    pub fn begin_restore_selection(&self) -> Result<u64, Error> {
        let mut restore = self.restore.lock().map_err(|_| Error::Operation)?;
        restore.request = restore.request.wrapping_add(1);
        restore.selection = None;
        restore.prepared = None;
        Ok(restore.request)
    }
    pub fn finish_restore_selection(&self, request: u64, path: PathBuf) -> Result<String, Error> {
        let mut restore = self.restore.lock().map_err(|_| Error::Operation)?;
        if restore.request != request {
            return Err(Error::Cancelled);
        }
        let token = uuid::Uuid::new_v4().to_string();
        restore.selection = Some((token.clone(), path));
        Ok(token)
    }
    pub fn store_restore_selection(&self, path: PathBuf) -> Result<String, Error> {
        let request = self.begin_restore_selection()?;
        self.finish_restore_selection(request, path)
    }
    /// A mistyped password can retry the same selection.
    pub fn peek_restore_selection(&self, token: &str) -> Result<PathBuf, Error> {
        match &self.restore.lock().map_err(|_| Error::Operation)?.selection {
            Some((stored, path)) if stored == token => Ok(path.clone()),
            _ => Err(Error::Validation),
        }
    }
    pub fn clear_restore_selection(&self) -> Result<(), Error> {
        let mut restore = self.restore.lock().map_err(|_| Error::Operation)?;
        restore.request = restore.request.wrapping_add(1);
        restore.prepared = None;
        restore.selection = None;
        Ok(())
    }

    /// Native-picker source paths are transient capabilities. They must not
    /// survive a vault lock, even though they are not persisted in the vault.
    pub fn clear_document_sources(&self) -> Result<(), Error> {
        self.selected_document_sources
            .lock()
            .map_err(|_| Error::Operation)?
            .clear();
        Ok(())
    }

    /// Serializes managed attachment mutations with snapshot and restore work so
    /// a backup never contains a database/file-system split view.
    pub fn lock_attachment_operations(&self) -> Result<MutexGuard<'_, ()>, Error> {
        self.attachment_operations
            .lock()
            .map_err(|_| Error::Operation)
    }

    /// Serializes security-file recovery and replacement, including Windows'
    /// two-step rename fallback.
    pub fn lock_security_operations(&self) -> Result<MutexGuard<'_, ()>, Error> {
        self.security_operations
            .lock()
            .map_err(|_| Error::Operation)
    }
}

#[cfg(test)]
mod tests {
    use super::AppState;
    use std::path::PathBuf;

    #[test]
    fn document_source_tokens_are_one_time_capabilities() {
        let state = AppState::default();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let path = PathBuf::from("/selected-by-native-dialog.pdf");
        let token = state.store_document_source(path.clone()).unwrap();
        assert_eq!(state.take_document_source(&token).unwrap(), path);
        assert!(state.take_document_source(&token).is_err());
        assert!(state.take_document_source("fabricated-token").is_err());
    }

    #[test]
    fn clearing_removes_unconsumed_document_source_tokens() {
        let state = AppState::default();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let token = state
            .store_document_source(PathBuf::from("/selected-by-native-dialog.pdf"))
            .unwrap();

        state.clear_document_sources().unwrap();

        assert!(state.take_document_source(&token).is_err());
    }

    #[test]
    fn security_operations_are_exclusive() {
        let state = AppState::default();
        let _guard = state.lock_security_operations().unwrap();
        assert!(state.security_operations.try_lock().is_err());
    }
    #[test]
    fn locking_rejects_existing_tokens_and_late_picker_results() {
        let state = AppState::default();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let token = state
            .store_document_source(PathBuf::from("fictional.pdf"))
            .unwrap();
        crate::services::app_service::lock(&state).unwrap();
        assert!(state.take_document_source(&token).is_err());
        assert!(state
            .store_document_source(PathBuf::from("fictional.pdf"))
            .is_err());
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        assert!(state.take_document_source(&token).is_err());
    }
    #[test]
    fn cancelled_or_superseded_pickers_never_install_a_selection() {
        let state = AppState::default();
        let first = state.begin_restore_selection().unwrap();
        state.clear_restore_selection().unwrap();
        assert!(matches!(
            state.finish_restore_selection(first, PathBuf::from("backup")),
            Err(crate::errors::Error::Cancelled)
        ));
        let second = state.begin_restore_selection().unwrap();
        let third = state.begin_restore_selection().unwrap();
        assert!(state
            .finish_restore_selection(second, PathBuf::from("old"))
            .is_err());
        let token = state
            .finish_restore_selection(third, PathBuf::from("current"))
            .unwrap();
        assert_eq!(
            state.peek_restore_selection(&token).unwrap(),
            PathBuf::from("current")
        );
        let generation = state.generation();
        state.advance_generation();
        assert!(state.check_generation(generation).is_err());
    }
    #[test]
    fn overlapping_vault_operations_are_refused_without_blocking() {
        let state = AppState::default();
        let operation = state.operation().unwrap();
        assert!(matches!(
            state.operation(),
            Err(crate::errors::Error::OperationBusy)
        ));
        drop(operation);
        assert!(state.operation().is_ok());
    }
}
