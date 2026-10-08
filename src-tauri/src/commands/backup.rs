use super::threads;
use crate::{
    dto::{BackupSummaryDto, LatestSuccessfulBackupDto},
    errors::Error,
    services::backup_service,
    state::AppState,
};
use tauri::{AppHandle, Manager, State};

/// `stamp` is the lawyer's local date and time (YYYY-MM-DD-HHmm), used in the file name.
/// Returns the file name only.
#[tauri::command]
pub fn backup_create(
    app: AppHandle,
    state: State<AppState>,
    stamp: String,
) -> Result<String, Error> {
    backup_service::create(&app, &state, &stamp)
}

#[tauri::command]
pub fn backup_latest_successful(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Option<LatestSuccessfulBackupDto>, Error> {
    backup_service::latest_successful(&app, &state)
}

/// Shows the latest backup in the system file manager.
#[tauri::command]
pub fn backup_reveal(app: AppHandle, state: State<AppState>) -> Result<(), Error> {
    backup_service::reveal_latest(&app, &state)
}

/// Saves a copy of the latest backup where the lawyer chooses (a flash drive, another
/// disk). Async so the native save dialog is awaited off the main thread.
#[tauri::command]
pub async fn backup_save_copy(app: AppHandle) -> Result<String, Error> {
    app.state::<AppState>().unlocked()?;
    let source = backup_service::latest_file(&app)?;
    let suggested = source
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let picker = app.clone();
    let destination =
        threads::on_worker(move || backup_service::pick_copy_destination(&picker, &suggested))
            .await?;
    threads::on_worker(move || backup_service::save_copy(&source, &destination)).await
}

/// Async so the native picker is awaited off the main thread (see `threads`). Checking a
/// file only reads it, so it stays on the worker too.
#[tauri::command]
pub async fn backup_validate(app: AppHandle) -> Result<BackupSummaryDto, Error> {
    app.state::<AppState>().unlocked()?;
    let picker = app.clone();
    let path = threads::on_worker(move || backup_service::pick_backup(&picker)).await?;
    threads::on_worker(move || backup_service::inspect(&app, &app.state::<AppState>(), &path)).await
}

/// Chooses and checks the backup to restore, so the lawyer can see what it holds before
/// anything is replaced. The returned token names it for `backup_restore`.
#[tauri::command]
pub async fn backup_inspect_restore(app: AppHandle) -> Result<BackupSummaryDto, Error> {
    backup_service::ensure_restorable(&app, &app.state::<AppState>())?;
    let picker = app.clone();
    let path = threads::on_worker(move || backup_service::pick_backup(&picker)).await?;
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let mut summary = backup_service::inspect(&app, &state, &path)?;
        summary.token = Some(state.store_selected_backup(path)?);
        Ok(summary)
    })
    .await
}

/// Restores the backup chosen by `backup_inspect_restore`. It runs on the main thread so
/// it cannot interleave with any other vault command.
#[tauri::command]
pub async fn backup_restore(app: AppHandle, token: String) -> Result<(), Error> {
    threads::on_main_thread(&app, move |app| {
        let state = app.state::<AppState>();
        let path = state.selected_backup(&token)?;
        let result = backup_service::restore(app, &state, &path);
        if !matches!(result, Err(Error::Locked)) {
            state.clear_selected_backup()?;
        }
        result
    })
    .await
}
