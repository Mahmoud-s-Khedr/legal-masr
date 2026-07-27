use crate::{
    db,
    dto::SearchHit,
    errors::Error,
    normalize,
    repositories::{case_repository, client_repository, search_repository},
    state::AppState,
};
use tauri::{AppHandle, Runtime};

pub fn search<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    query: &str,
) -> Result<Vec<SearchHit>, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    search_repository::search(&conn, &normalize::normalize_text(query))
}

pub fn rebuild_index<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<usize, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    search_repository::clear_all(&tx)?;

    let clients = client_repository::list(&tx, None, true)?;
    for client in &clients {
        search_repository::upsert(
            &tx,
            "client",
            &client.id,
            &client.display_name,
            client.primary_phone.as_deref(),
            &normalize::normalize_text(&client.display_name),
            &now,
        )?;
    }

    let cases = case_repository::list_summaries(&tx, None, None, None, true)?;
    for case in &cases {
        search_repository::upsert(
            &tx,
            "case",
            &case.id,
            &case.case_number,
            case.primary_client_name.as_deref(),
            &normalize::normalize_text(&case.case_number),
            &now,
        )?;
    }

    tx.commit()?;
    Ok(clients.len() + cases.len())
}
