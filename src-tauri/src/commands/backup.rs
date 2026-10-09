use super::threads;
use crate::{
    dto::{
        BackupSelectionDto, LatestSuccessfulBackupDto, PreparedBackupDto, RestoreCredentialInput,
    },
    errors::Error,
    services::backup_service,
    state::AppState,
};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn backup_create(app: AppHandle, stamp: String) -> Result<String, Error> {
    let generation = app.state::<AppState>().generation();
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        let result = backup_service::create(&app, &state, &stamp)?;
        state.check_generation(generation)?;
        Ok(result)
    })
    .await
}
#[tauri::command]
pub fn backup_latest_successful(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Option<LatestSuccessfulBackupDto>, Error> {
    let _operation = state.operation()?;
    backup_service::latest_successful(&app, &state)
}
#[tauri::command]
pub async fn backup_select_for_restore(app: AppHandle) -> Result<BackupSelectionDto, Error> {
    let (generation, request) = {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        backup_service::ensure_restore_allowed(&app, &state)?;
        (state.generation(), state.begin_restore_selection()?)
    };
    let picker = app.clone();
    let path = threads::on_worker(move || backup_service::pick_backup(&picker)).await?;
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        backup_service::select(&app, &state, path, request)
    })
    .await
}
#[tauri::command]
pub async fn backup_prepare_restore(
    app: AppHandle,
    token: String,
    credential: Option<RestoreCredentialInput>,
) -> Result<PreparedBackupDto, Error> {
    let generation = app.state::<AppState>().generation();
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        backup_service::prepare(&app, &state, &token, credential.as_ref())
    })
    .await
}
#[tauri::command]
pub async fn backup_commit_restore(app: AppHandle, token: String) -> Result<(), Error> {
    let generation = app.state::<AppState>().generation();
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        backup_service::commit(&app, &state, &token)
    })
    .await
}
#[tauri::command]
pub fn backup_cancel_restore(state: State<AppState>) -> Result<(), Error> {
    state.clear_restore_selection()
}
#[tauri::command]
pub async fn backup_save_copy(app: AppHandle) -> Result<String, Error> {
    let (generation, source) = {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.unlocked()?;
        (state.generation(), backup_service::latest_file(&app)?)
    };
    let picker = app.clone();
    let name = source
        .file_name()
        .ok_or(Error::Operation)?
        .to_string_lossy()
        .into_owned();
    let destination =
        threads::on_worker(move || backup_service::pick_copy_destination(&picker, &name)).await?;
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        state.unlocked()?;
        backup_service::save_copy(&source, &destination)
    })
    .await
}
#[tauri::command]
pub fn backup_reveal(app: AppHandle, state: State<AppState>) -> Result<(), Error> {
    let _operation = state.operation()?;
    backup_service::reveal_latest(&app, &state)
}
