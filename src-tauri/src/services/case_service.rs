use crate::{
    db,
    dto::{
        CaseClientInput, CaseCreateInput, CaseDto, CaseListInput, CaseOpponentDto,
        CaseOpponentInput, CaseOpponentUpdateInput, CaseSetClientsInput, CaseSummary,
        CaseUpdateInput,
    },
    errors::Error,
    normalize,
    repositories::{case_repository, search_repository},
    state::AppState,
};
use std::collections::HashSet;
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date};
use uuid::Uuid;

const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
const VALID_STATUSES: &[&str] = &["ACTIVE", "SUSPENDED", "CLOSED"];
const VALID_LITIGATION_DEGREES: &[&str] = &["FIRST_INSTANCE", "APPEAL", "CASSATION", "OTHER"];

fn valid_date(value: Option<&str>) -> bool {
    value.is_none_or(|date| date.len() == 10 && Date::parse(date, DATE_FORMAT).is_ok())
}

fn clean(value: Option<String>) -> Option<String> {
    value.and_then(|value| (!value.trim().is_empty()).then(|| value.trim().to_owned()))
}

fn validate_case(
    internal_number: &str,
    official_year: Option<i64>,
    litigation_degree: Option<&str>,
    status: &str,
    filed_on: Option<&str>,
    closed_on: Option<&str>,
    clients: &[CaseClientInput],
) -> Result<(), Error> {
    let unique_clients = clients
        .iter()
        .map(|client| &client.client_id)
        .collect::<HashSet<_>>();
    if internal_number.trim().is_empty()
        || clients.is_empty()
        || clients
            .iter()
            .any(|client| client.client_id.trim().is_empty())
        || unique_clients.len() != clients.len()
        || official_year.is_some_and(|year| !(1800..=9999).contains(&year))
        || litigation_degree.is_some_and(|degree| !VALID_LITIGATION_DEGREES.contains(&degree))
        || !VALID_STATUSES.contains(&status)
        || !valid_date(filed_on)
        || !valid_date(closed_on)
    {
        return Err(Error::Validation);
    }
    Ok(())
}

fn index(conn: &rusqlite::Connection, case: &CaseDto, now: &str) -> Result<(), Error> {
    let client_names = case
        .clients
        .iter()
        .map(|client| client.full_name.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    search_repository::upsert(
        conn,
        "CASE",
        &case.id,
        &case.internal_number,
        case.official_number.as_deref(),
        &normalize::normalize_text(&format!(
            "{} {} {} {}",
            case.internal_number,
            case.official_number.clone().unwrap_or_default(),
            case.official_year
                .map(|year| year.to_string())
                .unwrap_or_default(),
            client_names
        )),
        now,
    )
}

fn assemble(conn: &rusqlite::Connection, id: &str) -> Result<CaseDto, Error> {
    case_repository::hydrate(conn, case_repository::get(conn, id)?)
}

fn create_dto(input: CaseCreateInput, id: String, now: String) -> CaseDto {
    CaseDto {
        id,
        internal_number: input.internal_number.trim().to_owned(),
        official_number: clean(input.official_number),
        official_year: input.official_year,
        case_type: clean(input.case_type),
        litigation_degree: input.litigation_degree,
        court_name: clean(input.court_name),
        circuit_name: clean(input.circuit_name),
        status: input.status,
        filed_on: input.filed_on,
        closed_on: input.closed_on,
        subject: clean(input.subject),
        notes: clean(input.notes),
        archived_at: None,
        created_at: now.clone(),
        updated_at: now,
        clients: vec![],
        opponents: vec![],
    }
}

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseCreateInput,
) -> Result<CaseDto, Error> {
    validate_case(
        &input.internal_number,
        input.official_year,
        input.litigation_degree.as_deref(),
        &input.status,
        input.filed_on.as_deref(),
        input.closed_on.as_deref(),
        &input.clients,
    )?;
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    let clients = input.clients.clone();
    let case = create_dto(input, Uuid::new_v4().to_string(), now.clone());
    let tx = conn.unchecked_transaction()?;
    case_repository::insert(&tx, &case)?;
    case_repository::replace_clients(&tx, &case.id, &clients, &now)?;
    let case = assemble(&tx, &case.id)?;
    index(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn update<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseUpdateInput,
) -> Result<CaseDto, Error> {
    validate_case(
        &input.internal_number,
        input.official_year,
        input.litigation_degree.as_deref(),
        &input.status,
        input.filed_on.as_deref(),
        input.closed_on.as_deref(),
        &input.clients,
    )?;
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let existing = case_repository::get(&conn, &input.id)?;
    let now = db::now();
    let clients = input.clients.clone();
    let case = CaseDto {
        id: input.id,
        internal_number: input.internal_number.trim().to_owned(),
        official_number: clean(input.official_number),
        official_year: input.official_year,
        case_type: clean(input.case_type),
        litigation_degree: input.litigation_degree,
        court_name: clean(input.court_name),
        circuit_name: clean(input.circuit_name),
        status: input.status,
        filed_on: input.filed_on,
        closed_on: input.closed_on,
        subject: clean(input.subject),
        notes: clean(input.notes),
        archived_at: existing.archived_at,
        created_at: existing.created_at,
        updated_at: now.clone(),
        clients: vec![],
        opponents: vec![],
    };
    let tx = conn.unchecked_transaction()?;
    case_repository::update(&tx, &case)?;
    case_repository::replace_clients(&tx, &case.id, &clients, &now)?;
    let case = assemble(&tx, &case.id)?;
    index(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

// Relationship-only mutation: unrelated case fields are read inside the same transaction.
pub fn set_clients<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseSetClientsInput,
) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let tx = conn.unchecked_transaction()?;
    case_repository::get(&tx, &input.case_id)?;
    let now = db::now();
    case_repository::replace_clients(&tx, &input.case_id, &input.clients, &now)?;
    tx.execute(
        "UPDATE cases SET updated_at = ?2 WHERE id = ?1",
        rusqlite::params![input.case_id, now],
    )?;
    let case = assemble(&tx, &input.case_id)?;
    index(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn get<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    assemble(&db::open_db(&path, &master)?, id)
}

pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseListInput,
) -> Result<Vec<CaseSummary>, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    case_repository::list(
        &db::open_db(&path, &master)?,
        input.query.as_deref(),
        input.status.as_deref(),
        input.client_id.as_deref(),
        input.include_archived,
    )
}

fn set_archived<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    archived: bool,
) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    case_repository::set_archived(&tx, id, archived, &now)?;
    let case = assemble(&tx, id)?;
    index(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn archive<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<CaseDto, Error> {
    set_archived(app, state, id, true)
}
pub fn restore<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<CaseDto, Error> {
    set_archived(app, state, id, false)
}

pub fn add_opponent<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseOpponentInput,
) -> Result<CaseOpponentDto, Error> {
    if input.full_name.trim().is_empty() {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let id = Uuid::new_v4().to_string();
    let now = db::now();
    case_repository::insert_opponent(
        &conn,
        &id,
        &input.case_id,
        input.full_name.trim(),
        clean(input.legal_capacity).as_deref(),
        clean(input.lawyer_name).as_deref(),
        clean(input.phone).as_deref(),
        clean(input.address).as_deref(),
        clean(input.notes).as_deref(),
        &now,
    )?;
    case_repository::get_opponent(&conn, &id)
}

pub fn update_opponent<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseOpponentUpdateInput,
) -> Result<CaseOpponentDto, Error> {
    if input.full_name.trim().is_empty() {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let now = db::now();
    case_repository::update_opponent(
        &conn,
        &input.id,
        input.full_name.trim(),
        clean(input.legal_capacity).as_deref(),
        clean(input.lawyer_name).as_deref(),
        clean(input.phone).as_deref(),
        clean(input.address).as_deref(),
        clean(input.notes).as_deref(),
        &now,
    )
}

pub fn remove_opponent<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    case_repository::delete_opponent(&db::open_db(&path, &master)?, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_a_complete_canonical_case_contract() {
        let clients = vec![CaseClientInput {
            client_id: "a".into(),
            legal_capacity: Some("مدعٍ".into()),
            power_of_attorney_id: None,
            notes: None,
        }];
        assert!(validate_case(
            "CA-1",
            Some(2026),
            Some("APPEAL"),
            "ACTIVE",
            Some("2026-08-24"),
            None,
            &clients
        )
        .is_ok());
    }
    #[test]
    fn rejects_duplicate_clients_invalid_dates_and_legacy_statuses() {
        let duplicate = CaseClientInput {
            client_id: "a".into(),
            legal_capacity: None,
            power_of_attorney_id: None,
            notes: None,
        };
        assert!(validate_case(
            "CA-1",
            None,
            None,
            "ACTIVE",
            Some("2026-02-30"),
            None,
            std::slice::from_ref(&duplicate)
        )
        .is_err());
        assert!(validate_case(
            "CA-1",
            None,
            None,
            "DRAFT",
            None,
            None,
            &[duplicate.clone(), duplicate]
        )
        .is_err());
    }
}
