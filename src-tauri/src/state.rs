use crate::errors::Error;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};

#[derive(Default)]
pub struct AppState {
    pub master_key: Mutex<Option<[u8; 32]>>,
    selected_document_sources: Mutex<HashMap<String, PathBuf>>,
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
}
