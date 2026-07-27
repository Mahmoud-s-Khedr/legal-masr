use crate::{
    dto::{InitializeInput, InitializeResult, Status},
    errors::Error,
    services::app_service,
    state::AppState,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn app_get_status(app: AppHandle, state: State<AppState>) -> Result<Status, Error> {
    app_service::get_status(&app, &state)
}

#[tauri::command]
pub fn app_initialize(
    app: AppHandle,
    state: State<AppState>,
    input: InitializeInput,
) -> Result<InitializeResult, Error> {
    app_service::initialize(&app, &state, input)
}

#[tauri::command]
pub fn app_unlock(app: AppHandle, state: State<AppState>, password: String) -> Result<(), Error> {
    app_service::unlock(&app, &state, &password)
}

#[tauri::command]
pub fn app_lock(state: State<AppState>) -> Result<(), Error> {
    app_service::lock(&state)
}

#[tauri::command]
pub fn app_change_password(
    app: AppHandle,
    state: State<AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), Error> {
    app_service::change_password(&app, &state, &current_password, &new_password)
}

#[tauri::command]
pub fn app_recover_access(
    app: AppHandle,
    state: State<AppState>,
    recovery_key: String,
    new_password: String,
) -> Result<(), Error> {
    app_service::recover_access(&app, &state, &recovery_key, &new_password)
}
