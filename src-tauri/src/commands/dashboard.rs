use crate::{dto::DashboardSummary, errors::Error, services::dashboard_service, state::AppState};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn dashboard_get_summary(
    app: AppHandle,
    state: State<AppState>,
    today: String,
) -> Result<DashboardSummary, Error> {
    dashboard_service::summary(&app, &state, &today)
}
