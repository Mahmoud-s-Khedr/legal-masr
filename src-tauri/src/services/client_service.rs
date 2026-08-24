use crate::{
    db,
    dto::{ClientCreateInput, ClientDto, ClientListInput, ClientSummary, ClientUpdateInput},
    errors::Error,
    normalize,
    repositories::{
        case_repository, client_repository, document_repository, event_repository,
        finance_repository, search_repository, task_repository,
    },
    state::AppState,
};
use std::fs;
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

fn upsert_search_entry(
    conn: &rusqlite::Connection,
    client: &ClientDto,
    now: &str,
) -> Result<(), Error> {
    search_repository::upsert(
        conn,
        "client",
        &client.id,
        &client.display_name,
        client.primary_phone.as_deref(),
        &normalize::normalize_text(&client.display_name),
        now,
    )
}

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: ClientCreateInput,
) -> Result<ClientDto, Error> {
    if !matches!(input.client_type.as_str(), "INDIVIDUAL" | "ORGANIZATION")
        || input.display_name.trim().is_empty()
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let normalized_phone = input
        .primary_phone
        .as_deref()
        .map(normalize::normalize_phone);

    if !input.confirm_duplicate {
        let candidates = client_repository::find_probable_duplicates(
            &conn,
            normalized_phone.as_deref().filter(|p| !p.is_empty()),
            &input.display_name,
        )?;
        if !candidates.is_empty() {
            return Err(Error::ClientProbableDuplicate(candidates));
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    client_repository::insert(
        &tx,
        &id,
        &input.client_type,
        &input.display_name,
        input.national_id.as_deref(),
        input.registration_number.as_deref(),
        input.primary_phone.as_deref(),
        normalized_phone.as_deref(),
        input.email.as_deref(),
        input.address.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    let client = client_repository::find_by_id(&tx, &id)?;
    upsert_search_entry(&tx, &client, &now)?;
    tx.commit()?;
    Ok(client)
}

pub fn update<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: ClientUpdateInput,
) -> Result<ClientDto, Error> {
    if input.display_name.trim().is_empty() {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let normalized_phone = input
        .primary_phone
        .as_deref()
        .map(normalize::normalize_phone);
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    client_repository::update(
        &tx,
        &input.id,
        &input.display_name,
        input.national_id.as_deref(),
        input.registration_number.as_deref(),
        input.primary_phone.as_deref(),
        normalized_phone.as_deref(),
        input.email.as_deref(),
        input.address.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    let client = client_repository::find_by_id(&tx, &input.id)?;
    upsert_search_entry(&tx, &client, &now)?;
    tx.commit()?;
    Ok(client)
}

pub fn get<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<ClientDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    client_repository::find_by_id(&conn, id)
}

pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: ClientListInput,
) -> Result<Vec<ClientSummary>, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    client_repository::list(&conn, input.query.as_deref(), input.include_archived)
}

fn set_archived<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    archived: bool,
) -> Result<ClientDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    client_repository::set_archived(&tx, id, archived, &now)?;
    let client = client_repository::find_by_id(&tx, id)?;
    upsert_search_entry(&tx, &client, &now)?;
    tx.commit()?;
    Ok(client)
}

pub fn archive<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<ClientDto, Error> {
    set_archived(app, state, id, true)
}

pub fn restore<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<ClientDto, Error> {
    set_archived(app, state, id, false)
}

pub fn export<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let client = client_repository::find_by_id(&conn, id)?;
    let cases = case_repository::list_summaries(&conn, None, None, Some(id), true)?;
    let case_records: Vec<_> = cases
        .iter()
        .map(|summary| {
            let mut case = case_repository::find_case_by_id(&conn, &summary.id)?;
            case.clients = case_repository::list_clients_for_case(&conn, &case.id)?;
            case.parties = case_repository::list_parties_for_case(&conn, &case.id)?;
            Ok::<_, Error>(case)
        })
        .collect::<Result<_, _>>()?;
    let events = event_repository::list(&conn, None, None, None, Some(id), None)?;
    let tasks = task_repository::list(&conn, None, None, None, Some(id), None, None)?;
    let documents = document_repository::list(&conn, None, Some(id), true)?;
    let transactions = finance_repository::list_transactions(&conn, Some(id), None, None, None)?;
    let destination = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)?;
    let path = destination.join(format!("client-{}.json", client.id));
    let export = serde_json::json!({
        "formatVersion": 1,
        "client": client,
        "cases": case_records,
        "events": events,
        "tasks": tasks,
        "documents": documents,
        "financialTransactions": transactions,
    });
    fs::write(&path, serde_json::to_vec_pretty(&export)?)?;
    Ok(path.to_string_lossy().into_owned())
}
