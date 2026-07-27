use crate::{
    db,
    dto::{ClientCreateInput, ClientDto, ClientListInput, ClientSummary, ClientUpdateInput},
    errors::Error,
    normalize,
    repositories::{client_repository, search_repository},
    state::AppState,
};
use std::fs;
use tauri::{AppHandle, Runtime};
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

pub fn export<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
    destination: &str,
) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let client = client_repository::find_by_id(&conn, id)?;
    let path = std::path::PathBuf::from(destination).join(format!("client-{}.json", client.id));
    fs::write(&path, serde_json::to_vec_pretty(&client)?)?;
    Ok(path.to_string_lossy().into_owned())
}
