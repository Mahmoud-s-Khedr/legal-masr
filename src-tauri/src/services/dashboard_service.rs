use crate::{
    dto::{DashboardSummary, HearingListInput, TaskListInput},
    errors::Error,
    services::{hearing_service, task_service},
    state::AppState,
};
use tauri::{AppHandle, Runtime};
pub fn summary<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    today: &str,
) -> Result<DashboardSummary, Error> {
    let today_hearings = hearing_service::list(
        app,
        state,
        HearingListInput {
            case_id: None,
            from_date: Some(today.into()),
            to_date: Some(today.into()),
            status: Some("SCHEDULED".into()),
        },
    )?;
    let upcoming_hearings = hearing_service::list(
        app,
        state,
        HearingListInput {
            case_id: None,
            from_date: Some(today.into()),
            to_date: None,
            status: Some("SCHEDULED".into()),
        },
    )?;
    let today_tasks = task_service::list(
        app,
        state,
        TaskListInput {
            view: Some("TODAY".into()),
            reference_date: today.into(),
            case_id: None,
            client_id: None,
        },
    )?;
    let overdue_tasks = task_service::list(
        app,
        state,
        TaskListInput {
            view: Some("OVERDUE".into()),
            reference_date: today.into(),
            case_id: None,
            client_id: None,
        },
    )?;
    Ok(DashboardSummary {
        today_hearings,
        today_tasks,
        overdue_tasks,
        upcoming_hearings,
    })
}
