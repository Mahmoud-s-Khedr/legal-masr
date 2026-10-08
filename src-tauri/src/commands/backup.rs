use super::threads;
use crate::{
    dto::LatestSuccessfulBackupDto, errors::Error, services::backup_service, state::AppState,
};
use tauri::{AppHandle, Manager, State};

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

/// Async so the native picker is awaited off the main thread (see `threads`). Checking a
/// file only reads it, so it stays on the worker too.
#[tauri::command]
pub async fn backup_validate(app: AppHandle) -> Result<(), Error> {
    app.state::<AppState>().unlocked()?;
    let picker = app.clone();
    let path = threads::on_worker(move || backup_service::pick_backup(&picker)).await?;
    threads::on_worker(move || backup_service::validate(&app.state::<AppState>(), &path)).await
}

/// Async so the native picker is awaited off the main thread; the restore itself runs on
/// the main thread so it cannot interleave with any other vault command.
#[tauri::command]
pub async fn backup_restore(app: AppHandle) -> Result<(), Error> {
    backup_service::ensure_restorable(&app, &app.state::<AppState>())?;
    let picker = app.clone();
    let path = threads::on_worker(move || backup_service::pick_backup(&picker)).await?;
    threads::on_main_thread(&app, move |app| {
        backup_service::restore(app, &app.state::<AppState>(), &path)
    })
    .await
}
