use crate::{
    dto::{
        DocumentDto, DocumentListInput, DocumentReferenceInput, DocumentSourceSelection,
        DocumentUpdateInput,
    },
    errors::Error,
    services::document_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn document_select_source(
    app: AppHandle,
    state: State<AppState>,
) -> Result<DocumentSourceSelection, Error> {
    document_service::select_source(&app, &state)
}
#[tauri::command]
pub fn document_import_managed(
    app: AppHandle,
    state: State<AppState>,
    input: DocumentReferenceInput,
) -> Result<DocumentDto, Error> {
    document_service::import_managed(&app, &state, input)
}
#[tauri::command]
pub fn document_add_reference(
    app: AppHandle,
    state: State<AppState>,
    input: DocumentReferenceInput,
) -> Result<DocumentDto, Error> {
    document_service::add_reference(&app, &state, input)
}
#[tauri::command]
pub fn document_list(
    app: AppHandle,
    state: State<AppState>,
    input: DocumentListInput,
) -> Result<Vec<DocumentDto>, Error> {
    document_service::list(&app, &state, input)
}
#[tauri::command]
pub fn document_update(
    app: AppHandle,
    state: State<AppState>,
    input: DocumentUpdateInput,
) -> Result<DocumentDto, Error> {
    document_service::update(&app, &state, input)
}
#[tauri::command]
pub fn document_check_missing(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<bool, Error> {
    document_service::check_missing(&app, &state, &id)
}
#[tauri::command]
pub fn document_open(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    document_service::open(&app, &state, &id)
}
#[tauri::command]
pub fn document_reveal(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    document_service::reveal(&app, &state, &id)
}
#[tauri::command]
pub fn document_remove(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    document_service::remove(&app, &state, &id)
}
