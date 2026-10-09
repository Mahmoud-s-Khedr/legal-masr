use crate::{
    dto::{TaskDto, TaskInput, TaskListInput},
    errors::Error,
    services::task_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn task_create(
    app: AppHandle,
    state: State<AppState>,
    input: TaskInput,
) -> Result<TaskDto, Error> {
    let _operation = state.operation()?;
    task_service::save(&app, &state, input)
}
#[tauri::command]
pub fn task_update(
    app: AppHandle,
    state: State<AppState>,
    input: TaskInput,
) -> Result<TaskDto, Error> {
    let _operation = state.operation()?;
    task_service::save(&app, &state, input)
}
#[tauri::command]
pub fn task_list(
    app: AppHandle,
    state: State<AppState>,
    input: TaskListInput,
) -> Result<Vec<TaskDto>, Error> {
    let _operation = state.operation()?;
    task_service::list(&app, &state, input)
}
#[tauri::command]
pub fn task_complete(app: AppHandle, state: State<AppState>, id: String) -> Result<TaskDto, Error> {
    let _operation = state.operation()?;
    task_service::set_completed(&app, &state, &id, true)
}
#[tauri::command]
pub fn task_reopen(app: AppHandle, state: State<AppState>, id: String) -> Result<TaskDto, Error> {
    let _operation = state.operation()?;
    task_service::set_completed(&app, &state, &id, false)
}
#[tauri::command]
pub fn task_delete(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    task_service::delete(&app, &state, &id)
}
