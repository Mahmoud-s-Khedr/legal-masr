use crate::{
    db,
    dto::{
        PowerOfAttorneyDto, PowerOfAttorneyInput, PowerOfAttorneyListInput, PowerOfAttorneySummary,
    },
    errors::Error,
    normalize,
    repositories::{power_of_attorney_repository, search_repository},
    state::AppState,
};
use std::collections::HashSet;
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date};
use uuid::Uuid;

const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
fn valid_date(value: Option<&str>) -> bool {
    value.is_none_or(|date| date.len() == 10 && Date::parse(date, DATE_FORMAT).is_ok())
}
fn clean(value: Option<String>) -> Option<String> {
    value.and_then(|value| (!value.trim().is_empty()).then(|| value.trim().to_owned()))
}

fn index(conn: &rusqlite::Connection, poa: &PowerOfAttorneyDto, now: &str) -> Result<(), Error> {
    let client_names = poa
        .clients
        .iter()
        .map(|client| client.full_name.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    search_repository::upsert(
        conn,
        "POWER_OF_ATTORNEY",
        &poa.id,
        &poa.internal_sequence,
        poa.official_number.as_deref(),
        &normalize::normalize_text(&format!(
            "{} {} {}",
            poa.internal_sequence,
            poa.official_number.clone().unwrap_or_default(),
            client_names
        )),
        now,
    )
}

pub fn save<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: PowerOfAttorneyInput,
) -> Result<PowerOfAttorneyDto, Error> {
    let unique_clients = input.client_ids.iter().collect::<HashSet<_>>();
    if input.internal_sequence.trim().is_empty()
        || input.client_ids.is_empty()
        || unique_clients.len() != input.client_ids.len()
        || !valid_date(input.issue_date.as_deref())
        || input
            .issue_year
            .is_some_and(|year| !(1800..=9999).contains(&year))
        || input
            .lawyers
            .iter()
            .any(|lawyer| lawyer.full_name.trim().is_empty())
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    let is_new = input.id.is_none();
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = (!is_new)
        .then(|| power_of_attorney_repository::get(&conn, &id))
        .transpose()?;
    let poa = PowerOfAttorneyDto {
        id: id.clone(),
        internal_sequence: input.internal_sequence.trim().to_owned(),
        official_number: clean(input.official_number),
        issue_year: input.issue_year,
        issue_date: input.issue_date,
        notary_office: clean(input.notary_office),
        notes: clean(input.notes),
        archived_at: existing.as_ref().and_then(|poa| poa.archived_at.clone()),
        created_at: existing
            .as_ref()
            .map(|poa| poa.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now.clone(),
        clients: vec![],
        lawyers: vec![],
        case_ids: vec![],
    };
    let lawyers = input
        .lawyers
        .into_iter()
        .map(|lawyer| {
            (
                lawyer.id.unwrap_or_else(|| Uuid::new_v4().to_string()),
                lawyer.full_name.trim().to_owned(),
                clean(lawyer.bar_number),
                clean(lawyer.notes),
            )
        })
        .collect::<Vec<_>>();
    let tx = conn.unchecked_transaction()?;
    if is_new {
        power_of_attorney_repository::insert(&tx, &poa)?;
    } else {
        power_of_attorney_repository::update(&tx, &poa)?;
    }
    power_of_attorney_repository::replace_clients(&tx, &id, &input.client_ids, &now)?;
    power_of_attorney_repository::replace_lawyers(&tx, &id, &lawyers, &now)?;
    let poa =
        power_of_attorney_repository::hydrate(&tx, power_of_attorney_repository::get(&tx, &id)?)?;
    index(&tx, &poa, &now)?;
    tx.commit()?;
    Ok(poa)
}

pub fn get<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<PowerOfAttorneyDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    power_of_attorney_repository::hydrate(&conn, power_of_attorney_repository::get(&conn, id)?)
}
pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: PowerOfAttorneyListInput,
) -> Result<Vec<PowerOfAttorneySummary>, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    power_of_attorney_repository::list(
        &db::open_db(&path, &master)?,
        input.query.as_deref(),
        input.include_archived,
    )
}
pub fn set_archived<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    archived: bool,
) -> Result<PowerOfAttorneyDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    power_of_attorney_repository::set_archived(&tx, id, archived, &now)?;
    let poa =
        power_of_attorney_repository::hydrate(&tx, power_of_attorney_repository::get(&tx, id)?)?;
    index(&tx, &poa, &now)?;
    tx.commit()?;
    Ok(poa)
}
