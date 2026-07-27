use crate::{dto::SettingsDto, errors::Error, services::settings_service, state::AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn settings_get(app: AppHandle, state: State<AppState>) -> Result<SettingsDto, Error> {
    settings_service::get(&app, &state)
}

#[tauri::command]
pub fn settings_update(
    app: AppHandle,
    state: State<AppState>,
    language: String,
    theme: String,
    lock_timeout_minutes: u32,
    backup_directory: String,
) -> Result<SettingsDto, Error> {
    settings_service::update(
        &app,
        &state,
        &language,
        &theme,
        lock_timeout_minutes,
        &backup_directory,
    )
}
