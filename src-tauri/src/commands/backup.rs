use crate::{
    dto::{BackupSelectionDto, LatestSuccessfulBackupDto, RestoreCredentialInput},
    errors::Error,
    services::backup_service,
    state::AppState,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn backup_create(app: AppHandle, state: State<AppState>) -> Result<String, Error> {
    backup_service::create(&app, &state)
}

#[tauri::command]
pub fn backup_latest_successful(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Option<LatestSuccessfulBackupDto>, Error> {
    backup_service::latest_successful(&app, &state)
}

#[tauri::command]
pub fn backup_validate(app: AppHandle, state: State<AppState>) -> Result<(), Error> {
    backup_service::validate(&app, &state)
}

#[tauri::command]
pub fn backup_restore(app: AppHandle, state: State<AppState>) -> Result<(), Error> {
    backup_service::restore(&app, &state)
}

#[tauri::command]
pub fn backup_select_for_restore(
    app: AppHandle,
    state: State<AppState>,
) -> Result<BackupSelectionDto, Error> {
    backup_service::select_for_restore(&app, &state)
}

#[tauri::command]
pub fn backup_restore_selected(
    app: AppHandle,
    state: State<AppState>,
    token: String,
    credential: RestoreCredentialInput,
) -> Result<(), Error> {
    backup_service::restore_selected(&app, &state, &token, &credential)
}
