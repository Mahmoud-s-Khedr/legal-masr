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
            &normalize::normalize_text(&format!(
                "{} {}",
                case.case_number,
                case.judicial_year
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            )),
            &now,
        )?;
    }

    let mut event_stmt =
        tx.prepare("SELECT id,title,event_date,COALESCE(outcome,'') FROM case_events")?;
    let events = event_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, title, date, outcome) in &events {
        search_repository::upsert(
            &tx,
            "event",
            id,
            title,
            Some(date),
            &normalize::normalize_text(&format!("{title} {date} {outcome}")),
            &now,
        )?;
    }
    let mut task_stmt =
        tx.prepare("SELECT id,title,COALESCE(description,''),due_date FROM tasks")?;
    let tasks = task_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, title, description, due_date) in &tasks {
        search_repository::upsert(
            &tx,
            "task",
            id,
            title,
            due_date.as_deref(),
            &normalize::normalize_text(&format!("{title} {description}")),
            &now,
        )?;
    }
    let mut document_stmt =
        tx.prepare("SELECT id,original_filename,category,COALESCE(description,'') FROM documents")?;
    let documents = document_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, filename, category, description) in &documents {
        search_repository::upsert(
            &tx,
            "document",
            id,
            filename,
            Some(category),
            &normalize::normalize_text(&format!("{filename} {category} {description}")),
            &now,
        )?;
    }

    drop(document_stmt);
    drop(task_stmt);
    drop(event_stmt);

    tx.commit()?;
    Ok(clients.len() + cases.len() + events.len() + tasks.len() + documents.len())
}
