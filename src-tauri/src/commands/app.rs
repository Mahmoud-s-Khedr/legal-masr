use super::threads;
use crate::{
    dto::{InitializeInput, InitializeResult, Status},
    errors::Error,
    services::app_service,
    state::AppState,
};
use tauri::{AppHandle, Manager, State};
use zeroize::Zeroizing;

#[tauri::command]
pub fn app_get_status(app: AppHandle, state: State<AppState>) -> Result<Status, Error> {
    let _operation = state.operation()?;
    app_service::get_status(&app, &state)
}

#[tauri::command]
pub fn app_initialize(
    app: AppHandle,
    state: State<AppState>,
    input: InitializeInput,
) -> Result<InitializeResult, Error> {
    let _operation = state.operation()?;
    app_service::initialize(&app, &state, input)
}

#[tauri::command]
pub fn app_unlock(app: AppHandle, state: State<AppState>, password: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    app_service::unlock(&app, &state, &Zeroizing::new(password))
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
    let _operation = state.operation()?;
    app_service::change_password(
        &app,
        &state,
        &Zeroizing::new(current_password),
        &Zeroizing::new(new_password),
    )
}

#[tauri::command]
pub fn app_recover_access(
    app: AppHandle,
    state: State<AppState>,
    recovery_key: String,
    new_password: String,
) -> Result<(), Error> {
    let _operation = state.operation()?;
    app_service::recover_access(
        &app,
        &state,
        &Zeroizing::new(recovery_key),
        &Zeroizing::new(new_password),
    )
}

/// Issues a new recovery key once the current password is confirmed.
#[tauri::command]
pub fn app_replace_recovery_key(
    app: AppHandle,
    state: State<AppState>,
    current_password: String,
) -> Result<InitializeResult, Error> {
    let _operation = state.operation()?;
    let recovery_key =
        app_service::replace_recovery_key(&app, &state, &Zeroizing::new(current_password))?;
    Ok(InitializeResult { recovery_key })
}

/// Saves the recovery key as a text file where the lawyer chooses (a flash drive). Async
/// so the native save dialog is awaited off the main thread.
#[tauri::command]
pub async fn app_save_recovery_key(app: AppHandle, recovery_key: String) -> Result<(), Error> {
    let generation = app.state::<AppState>().generation();
    app.state::<AppState>().unlocked()?;
    let document = app_service::recovery_key_document(&Zeroizing::new(recovery_key))?;
    let picker = app.clone();
    let destination =
        threads::on_worker(move || app_service::pick_recovery_key_destination(&picker)).await?;
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        state.unlocked()?;
        app_service::save_recovery_key(&destination, &document)
    })
    .await
}

/// Opens the system print dialog for the current page; the page's print styles decide
/// what is printed. Async so the dialog is dispatched to the event loop, not run inside
/// this call.
#[tauri::command]
pub async fn app_print(window: tauri::WebviewWindow) -> Result<(), Error> {
    window.print().map_err(|_| Error::Operation)
}
