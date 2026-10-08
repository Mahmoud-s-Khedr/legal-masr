use crate::{
    db, dto::SearchHit, errors::Error, normalize, repositories::search_repository, state::AppState,
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

    let mut client_statement = tx.prepare(
        "SELECT id, full_name, internal_number, COALESCE(primary_phone, '') FROM clients",
    )?;
    let clients = client_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, full_name, internal_number, primary_phone) in &clients {
        search_repository::upsert(
            &tx,
            "CLIENT",
            id,
            full_name,
            Some(primary_phone),
            &normalize::normalize_text(&format!("{full_name} {internal_number} {primary_phone}")),
            &now,
        )?;
    }

    let mut case_statement = tx.prepare(
        "SELECT id, internal_number, COALESCE(official_number, ''), COALESCE(CAST(official_year AS TEXT), ''), COALESCE(CAST(judicial_year AS TEXT), '') FROM cases",
    )?;
    let cases = case_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, internal_number, official_number, official_year, judicial_year) in &cases {
        search_repository::upsert(
            &tx,
            "CASE",
            id,
            internal_number,
            (!official_number.is_empty()).then_some(official_number.as_str()),
            &normalize::normalize_text(&format!(
                "{internal_number} {official_number} {official_year} {judicial_year}"
            )),
            &now,
        )?;
    }

    let mut poa_statement = tx.prepare(
        "SELECT p.id, p.internal_sequence, COALESCE(p.official_number, ''), COALESCE(group_concat(c.full_name, ' '), '') FROM powers_of_attorney p LEFT JOIN power_of_attorney_clients pc ON pc.power_of_attorney_id = p.id LEFT JOIN clients c ON c.id = pc.client_id GROUP BY p.id",
    )?;
    let powers_of_attorney = poa_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, internal_sequence, official_number, client_names) in &powers_of_attorney {
        search_repository::upsert(
            &tx,
            "POWER_OF_ATTORNEY",
            id,
            internal_sequence,
            (!official_number.is_empty()).then_some(official_number.as_str()),
            &normalize::normalize_text(&format!(
                "{internal_sequence} {official_number} {client_names}"
            )),
            &now,
        )?;
    }

    drop(poa_statement);
    drop(case_statement);
    drop(client_statement);

    tx.commit()?;
    Ok(clients.len() + cases.len() + powers_of_attorney.len())
}
