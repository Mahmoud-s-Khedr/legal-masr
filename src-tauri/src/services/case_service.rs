use crate::{
    db,
    dto::{
        CaseCreateInput, CaseDto, CaseListInput, CasePartyDto, CasePartyInput,
        CasePartyUpdateInput, CaseSummary, CaseUpdateInput,
    },
    errors::Error,
    normalize,
    repositories::{case_repository, search_repository},
    state::AppState,
};
use rusqlite::Connection;
use std::fs;
use tauri::{AppHandle, Runtime};
use uuid::Uuid;

const VALID_STATUSES: &[&str] = &[
    "DRAFT",
    "ACTIVE",
    "SUSPENDED",
    "JUDGMENT_ISSUED",
    "APPEALED",
    "ENFORCEMENT",
    "CLOSED",
    "ARCHIVED",
];
const VALID_PARTY_ROLES: &[&str] = &["OPPONENT", "WITNESS", "EXPERT", "OTHER"];

fn assemble(conn: &Connection, id: &str) -> Result<CaseDto, Error> {
    let mut case = case_repository::find_case_by_id(conn, id)?;
    case.clients = case_repository::list_clients_for_case(conn, id)?;
    case.parties = case_repository::list_parties_for_case(conn, id)?;
    Ok(case)
}

fn upsert_search_entry(conn: &Connection, case: &CaseDto, now: &str) -> Result<(), Error> {
    let subtitle = case
        .clients
        .iter()
        .find(|c| c.is_primary)
        .map(|c| c.display_name.clone());
    search_repository::upsert(
        conn,
        "case",
        &case.id,
        &case.case_number,
        subtitle.as_deref(),
        &normalize::normalize_text(&case.case_number),
        now,
    )
}

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseCreateInput,
) -> Result<CaseDto, Error> {
    if input.case_number.trim().is_empty()
        || !VALID_STATUSES.contains(&input.status.as_str())
        || input.client_ids.is_empty()
        || !input.client_ids.contains(&input.primary_client_id)
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let id = Uuid::new_v4().to_string();
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    case_repository::insert_case(
        &tx,
        &id,
        &input.case_number,
        input.judicial_year,
        input.court_name.as_deref(),
        input.circuit_name.as_deref(),
        input.case_type.as_deref(),
        input.client_legal_capacity.as_deref(),
        &input.status,
        input.filed_on.as_deref(),
        input.summary.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    for client_id in &input.client_ids {
        case_repository::attach_client(&tx, &id, client_id, &now)?;
    }
    case_repository::set_primary_client(&tx, &id, &input.primary_client_id)?;
    let case = assemble(&tx, &id)?;
    upsert_search_entry(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn update<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseUpdateInput,
) -> Result<CaseDto, Error> {
    if input.case_number.trim().is_empty() || !VALID_STATUSES.contains(&input.status.as_str()) {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    case_repository::update_case(
        &tx,
        &input.id,
        &input.case_number,
        input.judicial_year,
        input.court_name.as_deref(),
        input.circuit_name.as_deref(),
        input.case_type.as_deref(),
        input.client_legal_capacity.as_deref(),
        &input.status,
        input.filed_on.as_deref(),
        input.closed_on.as_deref(),
        input.summary.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    let case = assemble(&tx, &input.id)?;
    upsert_search_entry(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn get<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    assemble(&conn, id)
}

pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CaseListInput,
) -> Result<Vec<CaseSummary>, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    case_repository::list_summaries(
        &conn,
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
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    case_repository::set_archived(&tx, id, archived, &now)?;
    let case = assemble(&tx, id)?;
    upsert_search_entry(&tx, &case, &now)?;
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

pub fn export<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    destination: &str,
) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let case = assemble(&conn, id)?;
    let path = std::path::PathBuf::from(destination).join(format!("case-{}.json", case.id));
    fs::write(&path, serde_json::to_vec_pretty(&case)?)?;
    Ok(path.to_string_lossy().into_owned())
}

pub fn attach_client<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    case_id: &str,
    client_id: &str,
    make_primary: bool,
) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    case_repository::attach_client(&tx, case_id, client_id, &now)?;
    if make_primary {
        case_repository::clear_primary_client(&tx, case_id)?;
        case_repository::set_primary_client(&tx, case_id, client_id)?;
    }
    let case = assemble(&tx, case_id)?;
    upsert_search_entry(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn detach_client<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    case_id: &str,
    client_id: &str,
) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    let total = case_repository::count_clients_for_case(&tx, case_id)?;
    if total <= 1 {
        return Err(Error::CaseMustHaveClient);
    }
    if case_repository::is_client_primary(&tx, case_id, client_id)? {
        return Err(Error::CasePrimaryClientReassignmentRequired);
    }
    case_repository::detach_client(&tx, case_id, client_id)?;
    let case = assemble(&tx, case_id)?;
    upsert_search_entry(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn set_primary_client<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    case_id: &str,
    client_id: &str,
) -> Result<CaseDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    case_repository::clear_primary_client(&tx, case_id)?;
    case_repository::set_primary_client(&tx, case_id, client_id)?;
    let case = assemble(&tx, case_id)?;
    upsert_search_entry(&tx, &case, &now)?;
    tx.commit()?;
    Ok(case)
}

pub fn add_party<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CasePartyInput,
) -> Result<CasePartyDto, Error> {
    if input.name.trim().is_empty() || !VALID_PARTY_ROLES.contains(&input.role.as_str()) {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let id = Uuid::new_v4().to_string();
    let now = db::now();
    case_repository::insert_party(
        &conn,
        &id,
        &input.case_id,
        &input.role,
        &input.name,
        input.phone.as_deref(),
        input.address.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    Ok(CasePartyDto {
        id,
        case_id: input.case_id,
        role: input.role,
        name: input.name,
        phone: input.phone,
        address: input.address,
        notes: input.notes,
    })
}

pub fn update_party<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: CasePartyUpdateInput,
) -> Result<CasePartyDto, Error> {
    if input.name.trim().is_empty() || !VALID_PARTY_ROLES.contains(&input.role.as_str()) {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    case_repository::update_party(
        &conn,
        &input.id,
        &input.role,
        &input.name,
        input.phone.as_deref(),
        input.address.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    let case_id = conn.query_row(
        "SELECT case_id FROM case_parties WHERE id = ?1",
        [&input.id],
        |r| r.get(0),
    )?;
    Ok(CasePartyDto {
        id: input.id,
        case_id,
        role: input.role,
        name: input.name,
        phone: input.phone,
        address: input.address,
        notes: input.notes,
    })
}

pub fn remove_party<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    case_repository::delete_party(&conn, id)
}
