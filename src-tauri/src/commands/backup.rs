use crate::{errors::Error, services::backup_service, state::AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn backup_create(app: AppHandle, state: State<AppState>) -> Result<String, Error> {
    backup_service::create(&app, &state)
}

#[tauri::command]
pub fn backup_validate(app: AppHandle, state: State<AppState>) -> Result<(), Error> {
    backup_service::validate(&app, &state)
}

#[tauri::command]
pub fn backup_restore(app: AppHandle, state: State<AppState>) -> Result<(), Error> {
    backup_service::restore(&app, &state)
}
