use crate::{
    db,
    dto::{ClientCreateInput, ClientDto, ClientListInput, ClientSummary, ClientUpdateInput},
    errors::Error,
    normalize,
    repositories::{
        case_repository, client_repository, document_repository, finance_repository,
        hearing_repository, search_repository, task_repository,
    },
    services::search_service,
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
        "CLIENT",
        &client.id,
        &client.full_name,
        client.primary_phone.as_deref(),
        &search_service::client_index_text(
            &client.internal_number,
            &client.full_name,
            client.primary_phone.as_deref(),
        ),
        now,
    )
}

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: ClientCreateInput,
) -> Result<ClientDto, Error> {
    // Numbers typed on an Arabic keyboard are stored with Latin digits, like the rest of
    // the app shows them, so they sort, search and collide as the same number.
    let input = ClientCreateInput {
        internal_number: normalize::ascii_digits(&input.internal_number),
        national_id: input.national_id.as_deref().map(normalize::ascii_digits),
        primary_phone: input.primary_phone.as_deref().map(normalize::ascii_digits),
        ..input
    };
    if input.internal_number.trim().is_empty() || input.full_name.trim().is_empty() {
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
            &input.full_name,
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
        input.internal_number.trim(),
        input.full_name.trim(),
        input.national_id.as_deref(),
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
    let input = ClientUpdateInput {
        internal_number: normalize::ascii_digits(&input.internal_number),
        national_id: input.national_id.as_deref().map(normalize::ascii_digits),
        primary_phone: input.primary_phone.as_deref().map(normalize::ascii_digits),
        ..input
    };
    if input.internal_number.trim().is_empty() || input.full_name.trim().is_empty() {
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
        input.internal_number.trim(),
        input.full_name.trim(),
        input.national_id.as_deref(),
        input.primary_phone.as_deref(),
        normalized_phone.as_deref(),
        input.email.as_deref(),
        input.address.as_deref(),
        input.notes.as_deref(),
        &now,
    )?;
    let client = client_repository::find_by_id(&tx, &input.id)?;
    search_service::refresh_with(&tx)?;
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

/// Shows the native folder picker. It blocks until the dialog closes, so it must run off
/// the main thread (see `commands::threads`).
pub fn pick_export_folder<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, Error> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

pub fn export<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    destination: &std::path::Path,
) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let client = client_repository::find_by_id(&conn, id)?;
    let cases = case_repository::list(&conn, None, None, Some(id), true)?;
    let case_records: Vec<_> = cases
        .iter()
        .map(|summary| case_repository::hydrate(&conn, case_repository::get(&conn, &summary.id)?))
        .collect::<Result<_, _>>()?;
    let hearings = case_records
        .iter()
        .map(|case_record| hearing_repository::list(&conn, Some(&case_record.id), None, None, None))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    let tasks = task_repository::list(&conn, Some("ALL"), "9999-12-31", None, Some(id))?;
    let attachments = document_repository::list(&conn, None, Some(id), None, None)?;
    let payments = finance_repository::list_payments(&conn, Some(id), None, None, None)?;
    let expenses = finance_repository::list_expenses(&conn, Some(id), None, None, None)?;
    let path = destination.join(format!("client-{}.json", client.id));
    let export = serde_json::json!({
        "formatVersion": 1,
        "client": client,
        "cases": case_records,
        "hearings": hearings,
        "tasks": tasks,
        "attachments": attachments,
        "payments": payments,
        "expenses": expenses,
    });
    fs::write(&path, serde_json::to_vec_pretty(&export)?)?;
    Ok(path.to_string_lossy().into_owned())
}
