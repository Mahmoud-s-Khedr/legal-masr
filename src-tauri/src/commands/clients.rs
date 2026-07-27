use crate::{
    dto::{ClientCreateInput, ClientDto, ClientListInput, ClientSummary, ClientUpdateInput},
    errors::Error,
    services::client_service,
    state::AppState,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn client_create(
    app: AppHandle,
    state: State<AppState>,
    input: ClientCreateInput,
) -> Result<ClientDto, Error> {
    client_service::create(&app, &state, input)
}

#[tauri::command]
pub fn client_update(
    app: AppHandle,
    state: State<AppState>,
    input: ClientUpdateInput,
) -> Result<ClientDto, Error> {
    client_service::update(&app, &state, input)
}

#[tauri::command]
pub fn client_get(app: AppHandle, state: State<AppState>, id: String) -> Result<ClientDto, Error> {
    client_service::get(&app, &state, &id)
}

#[tauri::command]
pub fn client_list(
    app: AppHandle,
    state: State<AppState>,
    input: ClientListInput,
) -> Result<Vec<ClientSummary>, Error> {
    client_service::list(&app, &state, input)
}

#[tauri::command]
pub fn client_archive(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<ClientDto, Error> {
    client_service::archive(&app, &state, &id)
}

#[tauri::command]
pub fn client_restore(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<ClientDto, Error> {
    client_service::restore(&app, &state, &id)
}

#[tauri::command]
pub fn client_export(
    app: AppHandle,
    state: State<AppState>,
    id: String,
    destination: String,
) -> Result<String, Error> {
    client_service::export(&app, &state, &id, &destination)
}
