use crate::{errors::Error, services::reminder_service, state::AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn reminders_refresh(
    app: AppHandle,
    state: State<AppState>,
    today: String,
    now_time: String,
) -> Result<u32, Error> {
    let _operation = state.operation()?;
    reminder_service::refresh(&app, &state, &today, &now_time)
}
