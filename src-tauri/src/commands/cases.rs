use crate::{
    dto::{
        CaseCreateInput, CaseDto, CaseListInput, CaseOpponentDto, CaseOpponentInput,
        CaseOpponentUpdateInput, CaseSummary, CaseUpdateInput,
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
pub fn case_add_opponent(
    app: AppHandle,
    state: State<AppState>,
    input: CaseOpponentInput,
) -> Result<CaseOpponentDto, Error> {
    case_service::add_opponent(&app, &state, input)
}

#[tauri::command]
pub fn case_update_opponent(
    app: AppHandle,
    state: State<AppState>,
    input: CaseOpponentUpdateInput,
) -> Result<CaseOpponentDto, Error> {
    case_service::update_opponent(&app, &state, input)
}

#[tauri::command]
pub fn case_remove_opponent(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<(), Error> {
    case_service::remove_opponent(&app, &state, &id)
}
