use crate::{
    dto::{EventCompleteInput, EventDto, EventInput, EventListInput},
    errors::Error,
    services::event_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn event_create(
    app: AppHandle,
    state: State<AppState>,
    input: EventInput,
) -> Result<EventDto, Error> {
    event_service::create(&app, &state, input)
}
#[tauri::command]
pub fn event_update(
    app: AppHandle,
    state: State<AppState>,
    input: EventInput,
) -> Result<EventDto, Error> {
    event_service::update(&app, &state, input)
}
#[tauri::command]
pub fn event_list(
    app: AppHandle,
    state: State<AppState>,
    input: EventListInput,
) -> Result<Vec<EventDto>, Error> {
    event_service::list(&app, &state, input)
}
#[tauri::command]
pub fn event_complete(
    app: AppHandle,
    state: State<AppState>,
    input: EventCompleteInput,
) -> Result<EventDto, Error> {
    event_service::complete(&app, &state, input)
}
#[tauri::command]
pub fn event_delete(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    event_service::delete(&app, &state, &id)
}
