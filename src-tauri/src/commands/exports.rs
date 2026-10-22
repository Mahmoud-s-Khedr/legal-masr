use super::threads;
use crate::{db, errors::Error, services::export_service, state::AppState, vault_operation};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn export_create(
    app: AppHandle,
    case_id: Option<String>,
    stamp: String,
) -> Result<export_service::ExportResult, Error> {
    let generation = {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.unlocked()?;
        state.generation()
    };
    // A native picker may stay open indefinitely; never hold the operation gate.
    let picker = app.clone();
    let destination = threads::on_worker(move || export_service::pick_folder(&picker)).await?;
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        let master = state.unlocked()?;
        let _attachments = state.lock_attachment_operations()?;
        let root = db::app_dir(&app)?;
        if vault_operation::pending(&root) {
            return Err(Error::VaultInterrupted);
        }
        let destination = export_service::destination_outside_vault(&root, &destination)?;
        let (_, path) = db::paths(&app)?;
        let mut conn = db::open_db(&path, &master)?;
        let output = export_service::create(
            &mut conn,
            &root.join("attachments"),
            &destination,
            case_id.as_deref(),
            &stamp,
            || state.check_generation(generation),
        )?;
        let folder_name = output
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or(Error::Operation)?
            .to_owned();
        let token = state.store_export(generation, output)?;
        Ok(export_service::ExportResult { token, folder_name })
    })
    .await
}

#[tauri::command]
pub async fn export_reveal(app: AppHandle, token: String) -> Result<(), Error> {
    let generation = app.state::<AppState>().generation();
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        let path = state.export_path(&token)?;
        app.opener()
            .reveal_item_in_dir(path)
            .map_err(|_| Error::Operation)
    })
    .await
}
