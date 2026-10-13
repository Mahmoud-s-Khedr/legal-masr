use crate::{
    db,
    dto::{TaskDto, TaskInput, TaskListInput},
    errors::Error,
    repositories::{case_repository, task_repository},
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date};
use uuid::Uuid;

const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
fn valid_date(value: &str) -> bool {
    value.len() == 10 && Date::parse(value, DATE_FORMAT).is_ok()
}
fn clean(value: Option<String>) -> Option<String> {
    value.and_then(|value| (!value.trim().is_empty()).then(|| value.trim().to_owned()))
}
fn validate(input: &TaskInput) -> Result<(), Error> {
    if input.title.trim().is_empty() || !valid_date(&input.due_date) {
        return Err(Error::Validation);
    }
    // A task of a case reaches its client through the case: it never carries a client of its own.
    if input.case_id.is_some() && input.client_id.is_some() {
        return Err(Error::LinkCaseOrClient);
    }
    Ok(())
}

pub fn save<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: TaskInput,
) -> Result<TaskDto, Error> {
    validate(&input)?;
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    if let Some(case_id) = &input.case_id {
        case_repository::ensure_active(&conn, case_id)?;
    }
    if let Some(client_id) = &input.client_id {
        conn.query_row("SELECT 1 FROM clients WHERE id = ?1", [client_id], |_| {
            Ok(())
        })
        .map_err(|_| Error::ClientNotFound)?;
    }
    let now = db::now();
    let is_new = input.id.is_none();
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = (!is_new)
        .then(|| task_repository::get(&conn, &id))
        .transpose()?;
    if let Some(case_id) = existing.as_ref().and_then(|item| item.case_id.as_ref()) {
        case_repository::ensure_active(&conn, case_id)?;
    }
    let task = TaskDto {
        id,
        client_id: input.client_id,
        case_id: input.case_id,
        title: input.title.trim().to_owned(),
        details: clean(input.details),
        notes: clean(input.notes),
        due_date: input.due_date,
        completed: existing.as_ref().is_some_and(|task| task.completed),
        completed_at: existing.as_ref().and_then(|task| task.completed_at.clone()),
        created_at: existing
            .as_ref()
            .map(|task| task.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };
    if is_new {
        task_repository::insert(&conn, &task)?;
    } else {
        task_repository::update(&conn, &task)?;
    }
    Ok(task)
}

pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: TaskListInput,
) -> Result<Vec<TaskDto>, Error> {
    if !valid_date(&input.reference_date) {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    task_repository::list(
        &db::open_db(&path, &master)?,
        input.view.as_deref(),
        &input.reference_date,
        input.case_id.as_deref(),
        input.client_id.as_deref(),
    )
}

pub fn set_completed<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    completed: bool,
) -> Result<TaskDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    ensure_case_active(&conn, id)?;
    let now = db::now();
    task_repository::set_completed(&conn, id, completed, &now)?;
    task_repository::get(&conn, id)
}

pub fn delete<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    ensure_case_active(&conn, id)?;
    task_repository::delete(&conn, id)
}

/// Tasks of an archived case are read-only with it.
fn ensure_case_active(conn: &rusqlite::Connection, task_id: &str) -> Result<(), Error> {
    match task_repository::get(conn, task_id)?.case_id {
        Some(case_id) => case_repository::ensure_active(conn, &case_id),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_a_simple_date_only_task_and_rejects_priority_era_inputs() {
        let input = TaskInput {
            id: None,
            client_id: None,
            case_id: None,
            title: "مراجعة الملف".into(),
            details: None,
            notes: None,
            due_date: "2026-08-24".into(),
        };
        assert!(validate(&input).is_ok());
        assert!(!valid_date("2026-08-24T09:00:00Z"));
    }

    fn task_input(case_id: Option<&str>, client_id: Option<&str>) -> TaskInput {
        TaskInput {
            id: None,
            client_id: client_id.map(Into::into),
            case_id: case_id.map(Into::into),
            title: "مراجعة الملف".into(),
            details: None,
            notes: None,
            due_date: "2026-08-24".into(),
        }
    }

    #[test]
    fn a_task_links_a_case_or_a_client_but_not_both() {
        assert!(validate(&task_input(Some("case"), None)).is_ok());
        assert!(validate(&task_input(None, Some("client"))).is_ok());
        assert!(validate(&task_input(None, None)).is_ok());
        assert!(matches!(
            validate(&task_input(Some("case"), Some("client"))),
            Err(Error::LinkCaseOrClient)
        ));
    }
}
