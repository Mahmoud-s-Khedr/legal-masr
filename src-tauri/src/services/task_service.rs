use crate::{
    db,
    dto::{TaskDto, TaskInput, TaskListInput},
    errors::Error,
    normalize,
    repositories::{search_repository, task_repository},
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date, Time};
use uuid::Uuid;
const PRIORITIES: &[&str] = &["LOW", "NORMAL", "HIGH", "URGENT"];
const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
const TIME_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[hour]:[minute]");

fn valid_date(value: Option<&str>) -> bool {
    value.is_none_or(|value| value.len() == 10 && Date::parse(value, DATE_FORMAT).is_ok())
}

fn valid_time(value: Option<&str>) -> bool {
    value.is_none_or(|value| value.len() == 5 && Time::parse(value, TIME_FORMAT).is_ok())
}
fn index(c: &rusqlite::Connection, t: &TaskDto, now: &str) -> Result<(), Error> {
    search_repository::upsert(
        c,
        "task",
        &t.id,
        &t.title,
        t.due_date.as_deref(),
        &normalize::normalize_text(&format!(
            "{} {}",
            t.title,
            t.description.clone().unwrap_or_default()
        )),
        now,
    )
}
pub fn save<R: Runtime>(a: &AppHandle<R>, s: &AppState, i: TaskInput) -> Result<TaskDto, Error> {
    if i.title.trim().is_empty()
        || !PRIORITIES.contains(&i.priority.as_str())
        || !valid_date(i.due_date.as_deref())
        || !valid_time(i.due_time.as_deref())
    {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let is_new = i.id.is_none();
    let id = i.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let mut t = TaskDto {
        id,
        client_id: i.client_id,
        case_id: i.case_id,
        source_event_id: i.source_event_id,
        title: i.title,
        description: i.description,
        due_date: i.due_date,
        due_time: i.due_time,
        priority: i.priority,
        status: "OPEN".into(),
        completed_at: None,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    if !is_new {
        let old = task_repository::get(&c, &t.id)?;
        // A task created as the follow-up to an event keeps that provenance.
        // Editing ordinary task fields must not silently detach it from the event.
        t.source_event_id = old.source_event_id;
        t.status = old.status;
        t.completed_at = old.completed_at;
        t.created_at = old.created_at;
    }
    let tx = c.unchecked_transaction()?;
    task_repository::save(&tx, &t, is_new)?;
    index(&tx, &t, &now)?;
    tx.commit()?;
    Ok(t)
}
pub fn list<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: TaskListInput,
) -> Result<Vec<TaskDto>, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    task_repository::list(
        &db::open_db(&p, &m)?,
        i.due_from.as_deref(),
        i.due_to.as_deref(),
        i.case_id.as_deref(),
        i.client_id.as_deref(),
        i.priority.as_deref(),
        i.status.as_deref(),
    )
}
pub fn status<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    id: &str,
    status: &str,
) -> Result<TaskDto, Error> {
    if !["OPEN", "COMPLETED", "CANCELLED"].contains(&status) {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let tx = c.unchecked_transaction()?;
    task_repository::set_status(&tx, id, status, &now)?;
    let t = task_repository::get(&tx, id)?;
    index(&tx, &t, &now)?;
    tx.commit()?;
    Ok(t)
}
pub fn delete<R: Runtime>(a: &AppHandle<R>, s: &AppState, id: &str) -> Result<(), Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let tx = c.unchecked_transaction()?;
    task_repository::delete(&tx, id)?;
    search_repository::delete(&tx, "task", id)?;
    tx.commit()?;
    Ok(())
}
