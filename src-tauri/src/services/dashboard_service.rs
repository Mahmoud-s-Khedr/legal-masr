use crate::{
    dto::{DashboardSummary, EventListInput, TaskListInput},
    errors::Error,
    services::{event_service, task_service},
    state::AppState,
};
use tauri::{AppHandle, Runtime};
pub fn summary<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    today: &str,
) -> Result<DashboardSummary, Error> {
    let events = event_service::list(
        a,
        s,
        EventListInput {
            from_date: Some(today.into()),
            to_date: Some(today.into()),
            case_id: None,
            client_id: None,
            status: Some("SCHEDULED".into()),
        },
    )?;
    let tasks = task_service::list(
        a,
        s,
        TaskListInput {
            due_from: Some(today.into()),
            due_to: Some(today.into()),
            case_id: None,
            client_id: None,
            priority: None,
            status: Some("OPEN".into()),
        },
    )?;
    let overdue = task_service::list(
        a,
        s,
        TaskListInput {
            due_from: None,
            due_to: Some(today.into()),
            case_id: None,
            client_id: None,
            priority: None,
            status: Some("OPEN".into()),
        },
    )?
    .into_iter()
    .filter(|x| x.due_date.as_deref().is_some_and(|d| d < today))
    .collect();
    let missing = event_service::list(
        a,
        s,
        EventListInput {
            from_date: None,
            to_date: Some(today.into()),
            case_id: None,
            client_id: None,
            status: Some("SCHEDULED".into()),
        },
    )?
    .into_iter()
    .filter(|x| x.event_type == "HEARING" && x.event_date.as_str() < today)
    .collect();
    let upcoming = event_service::list(
        a,
        s,
        EventListInput {
            from_date: Some(today.into()),
            to_date: None,
            case_id: None,
            client_id: None,
            status: Some("SCHEDULED".into()),
        },
    )?;
    Ok(DashboardSummary {
        today_events: events,
        today_tasks: tasks,
        overdue_tasks: overdue,
        missing_outcome_events: missing,
        upcoming_events: upcoming,
    })
}
