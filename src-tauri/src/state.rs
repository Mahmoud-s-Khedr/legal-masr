use crate::errors::Error;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};

#[derive(Default)]
pub struct AppState {
    pub master_key: Mutex<Option<[u8; 32]>>,
    selected_document_sources: Mutex<HashMap<String, PathBuf>>,
    attachment_operations: Mutex<()>,
    security_operations: Mutex<()>,
}

impl AppState {
    pub fn unlocked(&self) -> Result<[u8; 32], Error> {
        self.master_key
            .lock()
            .map_err(|_| Error::Locked)?
            .as_ref()
            .copied()
            .ok_or(Error::Locked)
    }

    pub fn store_document_source(&self, path: PathBuf) -> Result<String, Error> {
        let token = uuid::Uuid::new_v4().to_string();
        self.selected_document_sources
            .lock()
            .map_err(|_| Error::Operation)?
            .insert(token.clone(), path);
        Ok(token)
    }

    pub fn take_document_source(&self, token: &str) -> Result<PathBuf, Error> {
        self.selected_document_sources
            .lock()
            .map_err(|_| Error::Operation)?
            .remove(token)
            .ok_or(Error::AttachmentSourceMissing)
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
        let path = PathBuf::from("/selected-by-native-dialog.pdf");
        let token = state.store_document_source(path.clone()).unwrap();
        assert_eq!(state.take_document_source(&token).unwrap(), path);
        assert!(state.take_document_source(&token).is_err());
        assert!(state.take_document_source("fabricated-token").is_err());
    }

    #[test]
    fn security_operations_are_exclusive() {
        let state = AppState::default();
        let _guard = state.lock_security_operations().unwrap();
        assert!(state.security_operations.try_lock().is_err());
    }
}
