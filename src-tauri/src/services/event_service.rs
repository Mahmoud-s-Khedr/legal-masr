use crate::{
    db,
    dto::{EventCompleteInput, EventDto, EventInput, EventListInput, TaskDto},
    errors::Error,
    normalize,
    repositories::{event_repository, search_repository, task_repository},
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date, Time};
use uuid::Uuid;
const TYPES: &[&str] = &[
    "HEARING",
    "EXPERT_SESSION",
    "PROSECUTION_APPOINTMENT",
    "INVESTIGATION",
    "ENFORCEMENT_PROCEDURE",
    "ADMINISTRATIVE_APPOINTMENT",
    "CLIENT_APPOINTMENT",
    "DEADLINE",
    "OTHER",
];
const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
const TIME_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[hour]:[minute]");

fn is_date(value: &str) -> bool {
    value.len() == 10 && Date::parse(value, DATE_FORMAT).is_ok()
}

fn is_time(value: &str) -> bool {
    value.len() == 5 && Time::parse(value, TIME_FORMAT).is_ok()
}

fn valid(e: &EventInput) -> bool {
    !e.title.trim().is_empty()
        && is_date(&e.event_date)
        && TYPES.contains(&e.event_type.as_str())
        && match (&e.start_time, &e.end_time) {
            (Some(a), Some(b)) => is_time(a) && is_time(b) && b > a,
            (Some(a), None) | (None, Some(a)) => is_time(a),
            (None, None) => true,
        }
}
fn index(c: &rusqlite::Connection, e: &EventDto, now: &str) -> Result<(), Error> {
    search_repository::upsert(
        c,
        "event",
        &e.id,
        &e.title,
        Some(&e.event_date),
        &normalize::normalize_text(&format!(
            "{} {} {}",
            e.title,
            e.event_date,
            e.outcome.clone().unwrap_or_default()
        )),
        now,
    )
}
fn build(i: EventInput, id: String, now: String) -> EventDto {
    EventDto {
        id,
        case_id: i.case_id,
        client_id: i.client_id,
        event_type: i.event_type,
        title: i.title,
        event_date: i.event_date,
        start_time: i.start_time,
        end_time: i.end_time,
        is_all_day: i.is_all_day,
        location: i.location,
        circuit_name: i.circuit_name,
        preparation_notes: i.preparation_notes,
        required_documents: i.required_documents,
        outcome: None,
        decision_text: None,
        next_action: None,
        status: "SCHEDULED".into(),
        completed_at: None,
        created_at: now.clone(),
        updated_at: now,
    }
}
pub fn create<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: EventInput,
) -> Result<EventDto, Error> {
    if !valid(&i) {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let e = build(i, Uuid::new_v4().to_string(), now.clone());
    let tx = c.unchecked_transaction()?;
    event_repository::insert(&tx, &e)?;
    index(&tx, &e, &now)?;
    tx.commit()?;
    Ok(e)
}
pub fn update<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: EventInput,
) -> Result<EventDto, Error> {
    if !valid(&i) {
        return Err(Error::Validation);
    }
    let id = i.id.clone().ok_or(Error::Validation)?;
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let old = event_repository::get(&c, &id)?;
    let now = db::now();
    let mut e = build(i, id, now.clone());
    e.outcome = old.outcome;
    e.decision_text = old.decision_text;
    e.next_action = old.next_action;
    e.status = old.status;
    e.completed_at = old.completed_at;
    e.created_at = old.created_at;
    let tx = c.unchecked_transaction()?;
    event_repository::update(&tx, &e)?;
    index(&tx, &e, &now)?;
    tx.commit()?;
    Ok(e)
}
pub fn list<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: EventListInput,
) -> Result<Vec<EventDto>, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    event_repository::list(
        &db::open_db(&p, &m)?,
        i.from_date.as_deref(),
        i.to_date.as_deref(),
        i.case_id.as_deref(),
        i.client_id.as_deref(),
        i.status.as_deref(),
    )
}
pub fn complete<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: EventCompleteInput,
) -> Result<EventDto, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let tx = c.unchecked_transaction()?;
    event_repository::complete(
        &tx,
        &i.id,
        i.outcome.as_deref(),
        i.decision_text.as_deref(),
        i.next_action.as_deref(),
        &now,
    )?;
    let e = event_repository::get(&tx, &i.id)?;
    if let Some(date) = i.next_hearing_date.filter(|v| !v.trim().is_empty()) {
        if !is_date(&date) {
            return Err(Error::Validation);
        }
        let n = EventDto {
            id: Uuid::new_v4().to_string(),
            event_date: date,
            title: e.title.clone(),
            event_type: "HEARING".into(),
            case_id: e.case_id.clone(),
            client_id: e.client_id.clone(),
            start_time: e.start_time.clone(),
            end_time: e.end_time.clone(),
            is_all_day: e.is_all_day,
            location: e.location.clone(),
            circuit_name: e.circuit_name.clone(),
            preparation_notes: e.preparation_notes.clone(),
            required_documents: e.required_documents.clone(),
            outcome: None,
            decision_text: None,
            next_action: None,
            status: "SCHEDULED".into(),
            completed_at: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        event_repository::insert(&tx, &n)?;
        index(&tx, &n, &now)?;
    }
    if let Some(title) = i.create_task_title.filter(|v| !v.trim().is_empty()) {
        let t = TaskDto {
            id: Uuid::new_v4().to_string(),
            client_id: e.client_id.clone(),
            case_id: e.case_id.clone(),
            source_event_id: Some(e.id.clone()),
            title,
            description: e.next_action.clone(),
            due_date: None,
            due_time: None,
            priority: "NORMAL".into(),
            status: "OPEN".into(),
            completed_at: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        task_repository::save(&tx, &t, true)?;
    }
    index(&tx, &e, &now)?;
    tx.commit()?;
    Ok(e)
}
pub fn delete<R: Runtime>(a: &AppHandle<R>, s: &AppState, id: &str) -> Result<(), Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let tx = c.unchecked_transaction()?;
    event_repository::delete(&tx, id)?;
    search_repository::delete(&tx, "event", id)?;
    tx.commit()?;
    Ok(())
}
