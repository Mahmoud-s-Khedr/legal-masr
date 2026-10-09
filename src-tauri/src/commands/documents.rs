use super::threads;
use crate::{
    dto::{
        AttachmentDto, AttachmentInput, AttachmentListInput, AttachmentSourceSelection,
        AttachmentUpdateInput,
    },
    errors::Error,
    services::document_service,
    state::AppState,
};
use tauri::{AppHandle, Manager, State};
/// Async so the native picker is awaited off the main thread (see `threads`).
#[tauri::command]
pub async fn attachment_select_source(app: AppHandle) -> Result<AttachmentSourceSelection, Error> {
    let generation = app.state::<AppState>().generation();
    app.state::<AppState>().unlocked()?;
    let picker = app.clone();
    let path = threads::on_worker(move || document_service::pick_source(&picker)).await?;
    let state = app.state::<AppState>();
    let _operation = state.operation()?;
    state.check_generation(generation)?;
    document_service::register_source(&state, path)
}
#[tauri::command]
pub fn attachment_add(
    app: AppHandle,
    state: State<AppState>,
    input: AttachmentInput,
) -> Result<AttachmentDto, Error> {
    let _operation = state.operation()?;
    document_service::add(&app, &state, input)
}
#[tauri::command]
pub fn attachment_list(
    app: AppHandle,
    state: State<AppState>,
    input: AttachmentListInput,
) -> Result<Vec<AttachmentDto>, Error> {
    let _operation = state.operation()?;
    document_service::list(&app, &state, input)
}
#[tauri::command]
pub fn attachment_update(
    app: AppHandle,
    state: State<AppState>,
    input: AttachmentUpdateInput,
) -> Result<AttachmentDto, Error> {
    let _operation = state.operation()?;
    document_service::update(&app, &state, input)
}
#[tauri::command]
pub fn attachment_open(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    document_service::open(&app, &state, &id)
}
#[tauri::command]
pub fn attachment_reveal(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    document_service::reveal(&app, &state, &id)
}
#[tauri::command]
pub fn attachment_remove(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    document_service::remove(&app, &state, &id)
}
