use crate::{
    dto::{ClientCreateInput, ClientDto, ClientListInput, ClientSummary, ClientUpdateInput},
    errors::Error,
    services::client_service,
    state::AppState,
};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn client_create(
    app: AppHandle,
    state: State<AppState>,
    input: ClientCreateInput,
) -> Result<ClientDto, Error> {
    let _operation = state.operation()?;
    client_service::create(&app, &state, input)
}

#[tauri::command]
pub fn client_update(
    app: AppHandle,
    state: State<AppState>,
    input: ClientUpdateInput,
) -> Result<ClientDto, Error> {
    let _operation = state.operation()?;
    client_service::update(&app, &state, input)
}

#[tauri::command]
pub fn client_get(app: AppHandle, state: State<AppState>, id: String) -> Result<ClientDto, Error> {
    let _operation = state.operation()?;
    client_service::get(&app, &state, &id)
}

#[tauri::command]
pub fn client_list(
    app: AppHandle,
    state: State<AppState>,
    input: ClientListInput,
) -> Result<Vec<ClientSummary>, Error> {
    let _operation = state.operation()?;
    client_service::list(&app, &state, input)
}

#[tauri::command]
pub fn client_archive(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<ClientDto, Error> {
    let _operation = state.operation()?;
    client_service::archive(&app, &state, &id)
}

#[tauri::command]
pub fn client_restore(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<ClientDto, Error> {
    let _operation = state.operation()?;
    client_service::restore(&app, &state, &id)
}

/// Async so the native folder picker is awaited off the main thread (see `threads`).
#[tauri::command]
pub async fn client_export(app: AppHandle, id: String) -> Result<String, Error> {
    let generation = app.state::<AppState>().generation();
    app.state::<AppState>().unlocked()?;
    let picker = app.clone();
    let destination =
        super::threads::on_worker(move || client_service::pick_export_folder(&picker)).await?;
    super::threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.check_generation(generation)?;
        client_service::export(&app, &state, &id, &destination)
    })
    .await
}
