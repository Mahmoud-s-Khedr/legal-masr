use crate::{
    db,
    dto::{ClientCreateInput, ClientDto, ClientListInput, ClientSummary, ClientUpdateInput},
    errors::Error,
    normalize,
    repositories::{client_repository, search_repository},
    services::search_service,
    state::AppState,
};
use tauri::{AppHandle, Runtime};
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
