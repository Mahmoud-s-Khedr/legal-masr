use crate::{errors::Error, services::backup_service, state::AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn backup_create(
    app: AppHandle,
    state: State<AppState>,
    destination: String,
) -> Result<String, Error> {
    backup_service::create(&app, &state, &destination)
}

#[tauri::command]
pub fn backup_validate(state: State<AppState>, path: String) -> Result<(), Error> {
    backup_service::validate(&state, &path)
}

#[tauri::command]
pub fn backup_restore(app: AppHandle, state: State<AppState>, path: String) -> Result<(), Error> {
    backup_service::restore(&app, &state, &path)
}
