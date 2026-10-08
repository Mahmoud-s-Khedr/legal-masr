use crate::errors::Error;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};
use zeroize::Zeroizing;

#[derive(Default)]
pub struct AppState {
    pub master_key: Mutex<Option<Zeroizing<[u8; 32]>>>,
    selected_document_sources: Mutex<HashMap<String, PathBuf>>,
    selected_backup: Mutex<Option<(String, PathBuf)>>,
    attachment_operations: Mutex<()>,
    security_operations: Mutex<()>,
}

impl AppState {
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

    /// Native-picker source paths are transient capabilities. They must not
    /// survive a vault lock, even though they are not persisted in the vault.
    pub fn clear_document_sources(&self) -> Result<(), Error> {
        self.selected_document_sources
            .lock()
            .map_err(|_| Error::Operation)?
            .clear();
        Ok(())
    }

    /// Remembers a backup chosen in the native picker for the restore that follows. It is
    /// not tied to an unlocked vault because a new installation restores before it has one.
    pub fn store_selected_backup(&self, path: PathBuf) -> Result<String, Error> {
        let token = uuid::Uuid::new_v4().to_string();
        *self.selected_backup.lock().map_err(|_| Error::Operation)? = Some((token.clone(), path));
        Ok(token)
    }

    /// The backup chosen under `token`; it stays chosen so a mistyped password can be retried.
    pub fn selected_backup(&self, token: &str) -> Result<PathBuf, Error> {
        match &*self.selected_backup.lock().map_err(|_| Error::Operation)? {
            Some((stored, path)) if stored == token => Ok(path.clone()),
            _ => Err(Error::BackupInvalid),
        }
    }

    pub fn clear_selected_backup(&self) -> Result<(), Error> {
        *self.selected_backup.lock().map_err(|_| Error::Operation)? = None;
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
}
