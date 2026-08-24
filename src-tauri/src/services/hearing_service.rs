use crate::{
    db,
    dto::{
        HearingDecisionInput, HearingDecisionResult, HearingDto, HearingInput, HearingListInput,
    },
    errors::Error,
    repositories::hearing_repository,
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date, Time};
use uuid::Uuid;
const DATE: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
const TIME: &[BorrowedFormatItem<'static>] = format_description!("[hour]:[minute]");
fn valid(input: &HearingInput) -> bool {
    !input.case_id.is_empty()
        && input.hearing_date.len() == 10
        && Date::parse(&input.hearing_date, DATE).is_ok()
        && input
            .hearing_time
            .as_deref()
            .is_none_or(|time| time.len() == 5 && Time::parse(time, TIME).is_ok())
        && input
            .reminder_minutes
            .is_none_or(|minutes| minutes <= 10_080)
}
fn clean(value: Option<String>) -> Option<String> {
    value.and_then(|value| (!value.trim().is_empty()).then(|| value.trim().to_owned()))
}
fn make(
    input: HearingInput,
    existing: Option<HearingDto>,
    previous_hearing_id: Option<String>,
    now: &str,
) -> HearingDto {
    HearingDto {
        id: input.id.unwrap_or_else(|| Uuid::new_v4().to_string()),
        case_id: input.case_id,
        previous_hearing_id,
        hearing_date: input.hearing_date,
        hearing_time: clean(input.hearing_time),
        hearing_type: clean(input.hearing_type),
        location: clean(input.location),
        circuit_name: clean(input.circuit_name),
        required_documents: clean(input.required_documents),
        notes: clean(input.notes),
        decision_text: existing
            .as_ref()
            .and_then(|item| item.decision_text.clone()),
        status: existing
            .as_ref()
            .map(|item| item.status.clone())
            .unwrap_or_else(|| "SCHEDULED".into()),
        completed_at: existing.as_ref().and_then(|item| item.completed_at.clone()),
        reminder_minutes: input.reminder_minutes,
        created_at: existing
            .as_ref()
            .map(|item| item.created_at.clone())
            .unwrap_or_else(|| now.into()),
        updated_at: now.into(),
    }
}
pub fn save<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: HearingInput,
) -> Result<HearingDto, Error> {
    if !valid(&input) {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    let existing = input
        .id
        .as_deref()
        .map(|id| hearing_repository::get(&conn, id))
        .transpose()?;
    if existing
        .as_ref()
        .is_some_and(|item| item.case_id != input.case_id || item.status != "SCHEDULED")
    {
        return Err(Error::Validation);
    };
    let item = make(
        input,
        existing.clone(),
        existing
            .as_ref()
            .and_then(|item| item.previous_hearing_id.clone()),
        &now,
    );
    if existing.is_none() {
        hearing_repository::insert(&conn, &item)?;
    } else {
        hearing_repository::update(&conn, &item)?;
    }
    hearing_repository::get(&conn, &item.id)
}
pub fn get<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<HearingDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    hearing_repository::get(&db::open_db(&path, &master)?, id)
}
pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: HearingListInput,
) -> Result<Vec<HearingDto>, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    hearing_repository::list(
        &db::open_db(&path, &master)?,
        input.case_id.as_deref(),
        input.from_date.as_deref(),
        input.to_date.as_deref(),
        input.status.as_deref(),
    )
}
pub fn record_decision<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: HearingDecisionInput,
) -> Result<HearingDecisionResult, Error> {
    if input
        .decision_text
        .as_deref()
        .is_some_and(|text| text.trim().is_empty())
        || input
            .next_hearing
            .as_ref()
            .is_some_and(|hearing| !valid(hearing))
    {
        return Err(Error::Validation);
    };
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    let source = hearing_repository::get(&tx, &input.id)?;
    if source.status != "SCHEDULED" {
        return Err(Error::Validation);
    }
    let next_hearing = input
        .next_hearing
        .map(|mut next| {
            next.id = None;
            next.case_id = source.case_id.clone();
            let item = make(next, None, Some(source.id.clone()), &now);
            hearing_repository::insert(&tx, &item)?;
            hearing_repository::get(&tx, &item.id)
        })
        .transpose()?;
    hearing_repository::complete(
        &tx,
        &source.id,
        input.decision_text.as_deref().map(str::trim),
        &now,
    )?;
    let hearing = hearing_repository::get(&tx, &source.id)?;
    tx.commit()?;
    Ok(HearingDecisionResult {
        hearing,
        next_hearing,
    })
}
pub fn delete<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    hearing_repository::delete(&db::open_db(&path, &master)?, id)
}
