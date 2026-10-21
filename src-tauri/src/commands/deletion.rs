use super::threads;
use crate::{
    db,
    dto::{DeletionInput, DeletionPreview, DeletionResult, DeletionTarget},
    errors::Error,
    services::{backup_service, deletion_service},
    state::AppState,
};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn deletion_preview(
    app: AppHandle,
    target: DeletionTarget,
    language: String,
) -> Result<DeletionPreview, Error> {
    let generation = app.state::<AppState>().generation();
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        deletion_service::preview(&app, &state, target, &language)
    })
    .await
}

#[tauri::command]
pub async fn deletion_commit(
    app: AppHandle,
    input: DeletionInput,
) -> Result<DeletionResult, Error> {
    let generation = app.state::<AppState>().generation();
    // Native pickers never hold the operation gate. Cancellation has no effects.
    let destination = if input.target == DeletionTarget::All && input.backup_first {
        {
            let state = app.state::<AppState>();
            let _operation = state.operation()?;
            state.unlocked()?;
            if crate::vault_operation::pending(&db::app_dir(&app)?) {
                return Err(Error::VaultInterrupted);
            }
        }
        let picker = app.clone();
        Some(
            threads::on_worker(move || {
                backup_service::pick_copy_destination(&picker, "before-deletion.lmsbackup")
            })
            .await?,
        )
    } else {
        None
    };
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        deletion_service::commit(&app, &state, &input, destination.as_deref())
    })
    .await
}

#[tauri::command]
pub async fn deletion_retry_cleanup(app: AppHandle) -> Result<DeletionResult, Error> {
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        deletion_service::retry_cleanup(&app, &state)
    })
    .await
}
