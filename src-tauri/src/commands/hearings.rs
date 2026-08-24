use crate::{
    dto::{
        HearingDecisionInput, HearingDecisionResult, HearingDto, HearingInput, HearingListInput,
    },
    errors::Error,
    services::hearing_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn hearing_create(
    app: AppHandle,
    state: State<AppState>,
    input: HearingInput,
) -> Result<HearingDto, Error> {
    hearing_service::save(&app, &state, input)
}
#[tauri::command]
pub fn hearing_update(
    app: AppHandle,
    state: State<AppState>,
    input: HearingInput,
) -> Result<HearingDto, Error> {
    hearing_service::save(&app, &state, input)
}
#[tauri::command]
pub fn hearing_get(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<HearingDto, Error> {
    hearing_service::get(&app, &state, &id)
}
#[tauri::command]
pub fn hearing_list(
    app: AppHandle,
    state: State<AppState>,
    input: HearingListInput,
) -> Result<Vec<HearingDto>, Error> {
    hearing_service::list(&app, &state, input)
}
#[tauri::command]
pub fn hearing_record_decision(
    app: AppHandle,
    state: State<AppState>,
    input: HearingDecisionInput,
) -> Result<HearingDecisionResult, Error> {
    hearing_service::record_decision(&app, &state, input)
}
#[tauri::command]
pub fn hearing_delete(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    hearing_service::delete(&app, &state, &id)
}
