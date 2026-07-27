use crate::{backup, db, errors::Error, state::AppState};
use tauri::{AppHandle, Runtime};

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    destination: &str,
) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    backup::create(&db_path, &master, destination)
}

pub fn validate(state: &AppState, path: &str) -> Result<(), Error> {
    backup::validate(path, &state.unlocked()?)
}

pub fn restore<R: Runtime>(app: &AppHandle<R>, state: &AppState, path: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, active_db) = db::paths(app)?;
    backup::restore(&active_db, &master, path)
}
