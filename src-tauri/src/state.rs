use crate::errors::Error;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub master_key: Mutex<Option<[u8; 32]>>,
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
}
