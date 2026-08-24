use crate::{
    dto::{
        PowerOfAttorneyDto, PowerOfAttorneyInput, PowerOfAttorneyListInput, PowerOfAttorneySummary,
    },
    errors::Error,
    services::power_of_attorney_service,
    state::AppState,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn power_of_attorney_create(
    app: AppHandle,
    state: State<AppState>,
    input: PowerOfAttorneyInput,
) -> Result<PowerOfAttorneyDto, Error> {
    power_of_attorney_service::save(&app, &state, input)
}

#[tauri::command]
pub fn power_of_attorney_update(
    app: AppHandle,
    state: State<AppState>,
    input: PowerOfAttorneyInput,
) -> Result<PowerOfAttorneyDto, Error> {
    power_of_attorney_service::save(&app, &state, input)
}

#[tauri::command]
pub fn power_of_attorney_get(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<PowerOfAttorneyDto, Error> {
    power_of_attorney_service::get(&app, &state, &id)
}

#[tauri::command]
pub fn power_of_attorney_list(
    app: AppHandle,
    state: State<AppState>,
    input: PowerOfAttorneyListInput,
) -> Result<Vec<PowerOfAttorneySummary>, Error> {
    power_of_attorney_service::list(&app, &state, input)
}

#[tauri::command]
pub fn power_of_attorney_archive(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<PowerOfAttorneyDto, Error> {
    power_of_attorney_service::set_archived(&app, &state, &id, true)
}

#[tauri::command]
pub fn power_of_attorney_restore(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<PowerOfAttorneyDto, Error> {
    power_of_attorney_service::set_archived(&app, &state, &id, false)
}
