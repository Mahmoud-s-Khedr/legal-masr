use crate::{
    dto::{
        AttachmentDto, AttachmentInput, AttachmentListInput, AttachmentSourceSelection,
        AttachmentUpdateInput,
    },
    errors::Error,
    services::document_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn attachment_select_source(
    app: AppHandle,
    state: State<AppState>,
) -> Result<AttachmentSourceSelection, Error> {
    document_service::select_source(&app, &state)
}
#[tauri::command]
pub fn attachment_add(
    app: AppHandle,
    state: State<AppState>,
    input: AttachmentInput,
) -> Result<AttachmentDto, Error> {
    document_service::add(&app, &state, input)
}
#[tauri::command]
pub fn attachment_list(
    app: AppHandle,
    state: State<AppState>,
    input: AttachmentListInput,
) -> Result<Vec<AttachmentDto>, Error> {
    document_service::list(&app, &state, input)
}
#[tauri::command]
pub fn attachment_update(
    app: AppHandle,
    state: State<AppState>,
    input: AttachmentUpdateInput,
) -> Result<AttachmentDto, Error> {
    document_service::update(&app, &state, input)
}
#[tauri::command]
pub fn attachment_open(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    document_service::open(&app, &state, &id)
}
#[tauri::command]
pub fn attachment_reveal(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    document_service::reveal(&app, &state, &id)
}
#[tauri::command]
pub fn attachment_remove(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    document_service::remove(&app, &state, &id)
}
