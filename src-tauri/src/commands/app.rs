use super::threads;
use crate::{
    dto::{BackupChoiceDto, InitializeInput, InitializeResult, RestoreFromBackupInput, Status},
    errors::Error,
    services::{
        app_service,
        backup_service::{self, BackupSecret},
    },
    state::AppState,
};
use tauri::{AppHandle, Manager, State};
use zeroize::Zeroizing;

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
    app_service::recover_access(
        &app,
        &state,
        &Zeroizing::new(recovery_key),
        &Zeroizing::new(new_password),
    )
}

/// On a new installation, chooses the backup to restore. Async so the native picker is
/// awaited off the main thread (see `threads`).
#[tauri::command]
pub async fn app_choose_backup(app: AppHandle) -> Result<BackupChoiceDto, Error> {
    backup_service::ensure_new_installation(&app)?;
    let picker = app.clone();
    let path = threads::on_worker(move || backup_service::pick_backup(&picker)).await?;
    threads::on_worker(move || {
        backup_service::ensure_portable(&path)?;
        let file_name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let token = app.state::<AppState>().store_selected_backup(path)?;
        Ok(BackupChoiceDto { token, file_name })
    })
    .await
}

/// Restores the backup chosen by `app_choose_backup` as this installation's vault and
/// unlocks it. A wrong password or recovery key keeps the choice so it can be retried.
#[tauri::command]
pub async fn app_restore_from_backup(
    app: AppHandle,
    input: RestoreFromBackupInput,
) -> Result<(), Error> {
    threads::on_main_thread(&app, move |app| {
        let state = app.state::<AppState>();
        let path = state.selected_backup(&input.token)?;
        let password = Zeroizing::new(input.password.unwrap_or_default());
        let recovery_key = Zeroizing::new(input.recovery_key.unwrap_or_default());
        let new_password = Zeroizing::new(input.new_password.unwrap_or_default());
        let secret = if recovery_key.is_empty() {
            BackupSecret::Password(&password)
        } else {
            BackupSecret::RecoveryKey {
                key: &recovery_key,
                new_password: &new_password,
            }
        };
        backup_service::restore_new_vault(app, &state, &path, secret, &input.language)?;
        state.clear_selected_backup()
    })
    .await
}

/// Issues a new recovery key once the current password is confirmed.
#[tauri::command]
pub fn app_replace_recovery_key(
    app: AppHandle,
    state: State<AppState>,
    current_password: String,
) -> Result<InitializeResult, Error> {
    let recovery_key =
        app_service::replace_recovery_key(&app, &state, &Zeroizing::new(current_password))?;
    Ok(InitializeResult { recovery_key })
}

/// Saves the recovery key as a text file where the lawyer chooses (a flash drive). Async
/// so the native save dialog is awaited off the main thread.
#[tauri::command]
pub async fn app_save_recovery_key(app: AppHandle, recovery_key: String) -> Result<(), Error> {
    app.state::<AppState>().unlocked()?;
    let document = app_service::recovery_key_document(&Zeroizing::new(recovery_key))?;
    let picker = app.clone();
    let destination =
        threads::on_worker(move || app_service::pick_recovery_key_destination(&picker)).await?;
    threads::on_worker(move || app_service::save_recovery_key(&destination, &document)).await
}

/// Opens the system print dialog for the current page; the page's print styles decide
/// what is printed. Async so the dialog is dispatched to the event loop, not run inside
/// this call.
#[tauri::command]
pub async fn app_print(window: tauri::WebviewWindow) -> Result<(), Error> {
    window.print().map_err(|_| Error::Operation)
}
