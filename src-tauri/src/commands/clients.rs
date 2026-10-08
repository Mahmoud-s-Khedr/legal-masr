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

/// Async so the native folder picker is awaited off the main thread (see `threads`).
#[tauri::command]
pub async fn client_export(app: AppHandle, id: String) -> Result<String, Error> {
    app.state::<AppState>().unlocked()?;
    let picker = app.clone();
    let destination =
        super::threads::on_worker(move || client_service::pick_export_folder(&picker)).await?;
    super::threads::on_main_thread(&app, move |app| {
        client_service::export(app, &app.state::<AppState>(), &id, &destination)
    })
    .await
}
