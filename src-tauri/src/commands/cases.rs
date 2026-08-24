use crate::{
    dto::{
        CaseCreateInput, CaseDto, CaseListInput, CasePartyDto, CasePartyInput,
        CasePartyUpdateInput, CaseSummary, CaseUpdateInput,
    },
    errors::Error,
    services::case_service,
    state::AppState,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn case_create(
    app: AppHandle,
    state: State<AppState>,
    input: CaseCreateInput,
) -> Result<CaseDto, Error> {
    case_service::create(&app, &state, input)
}

#[tauri::command]
pub fn case_update(
    app: AppHandle,
    state: State<AppState>,
    input: CaseUpdateInput,
) -> Result<CaseDto, Error> {
    case_service::update(&app, &state, input)
}

#[tauri::command]
pub fn case_get(app: AppHandle, state: State<AppState>, id: String) -> Result<CaseDto, Error> {
    case_service::get(&app, &state, &id)
}

#[tauri::command]
pub fn case_list(
    app: AppHandle,
    state: State<AppState>,
    input: CaseListInput,
) -> Result<Vec<CaseSummary>, Error> {
    case_service::list(&app, &state, input)
}

#[tauri::command]
pub fn case_archive(app: AppHandle, state: State<AppState>, id: String) -> Result<CaseDto, Error> {
    case_service::archive(&app, &state, &id)
}

#[tauri::command]
pub fn case_restore(app: AppHandle, state: State<AppState>, id: String) -> Result<CaseDto, Error> {
    case_service::restore(&app, &state, &id)
}

#[tauri::command]
pub fn case_export(app: AppHandle, state: State<AppState>, id: String) -> Result<String, Error> {
    case_service::export(&app, &state, &id)
}

#[tauri::command]
pub fn case_attach_client(
    app: AppHandle,
    state: State<AppState>,
    case_id: String,
    client_id: String,
    make_primary: bool,
) -> Result<CaseDto, Error> {
    case_service::attach_client(&app, &state, &case_id, &client_id, make_primary)
}

#[tauri::command]
pub fn case_detach_client(
    app: AppHandle,
    state: State<AppState>,
    case_id: String,
    client_id: String,
) -> Result<CaseDto, Error> {
    case_service::detach_client(&app, &state, &case_id, &client_id)
}

#[tauri::command]
pub fn case_set_primary_client(
    app: AppHandle,
    state: State<AppState>,
    case_id: String,
    client_id: String,
) -> Result<CaseDto, Error> {
    case_service::set_primary_client(&app, &state, &case_id, &client_id)
}

#[tauri::command]
pub fn case_add_party(
    app: AppHandle,
    state: State<AppState>,
    input: CasePartyInput,
) -> Result<CasePartyDto, Error> {
    case_service::add_party(&app, &state, input)
}

#[tauri::command]
pub fn case_update_party(
    app: AppHandle,
    state: State<AppState>,
    input: CasePartyUpdateInput,
) -> Result<CasePartyDto, Error> {
    case_service::update_party(&app, &state, input)
}

#[tauri::command]
pub fn case_remove_party(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    case_service::remove_party(&app, &state, &id)
}
