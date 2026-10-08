use crate::{
    db, dto::SearchHit, errors::Error, normalize, repositories::search_repository, state::AppState,
};
use rusqlite::Connection;
use tauri::{AppHandle, Runtime};

/// Searchable text for a client: number, name and phone (as typed and as bare digits).
pub fn client_index_text(internal_number: &str, full_name: &str, phone: Option<&str>) -> String {
    let phone = phone.unwrap_or_default();
    normalize::normalize_text(&format!(
        "{internal_number} {full_name} {phone} {}",
        normalize::normalize_phone(phone)
    ))
}

/// Searchable text for a case: numbers, years, court and client names.
pub fn case_index_text(
    internal_number: &str,
    official_number: Option<&str>,
    official_year: Option<i64>,
    judicial_year: Option<i64>,
    court_name: Option<&str>,
    client_names: &str,
) -> String {
    let year = |value: Option<i64>| value.map(|year| year.to_string()).unwrap_or_default();
    normalize::normalize_text(&format!(
        "{internal_number} {} {} {} {} {client_names}",
        official_number.unwrap_or_default(),
        year(official_year),
        year(judicial_year),
        court_name.unwrap_or_default(),
    ))
}

/// Searchable text for a power of attorney: numbers, notary office and client names.
pub fn power_of_attorney_index_text(
    internal_sequence: &str,
    official_number: Option<&str>,
    notary_office: Option<&str>,
    client_names: &str,
) -> String {
    normalize::normalize_text(&format!(
        "{internal_sequence} {} {} {client_names}",
        official_number.unwrap_or_default(),
        notary_office.unwrap_or_default(),
    ))
}

pub fn search<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    query: &str,
) -> Result<Vec<SearchHit>, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let text = normalize::like_pattern(&normalize::normalize_text(query));
    let digits = Some(normalize::normalize_phone(query))
        .filter(|digits| digits.len() >= 3)
        .map(|digits| normalize::like_pattern(&digits));
    search_repository::search(&conn, &text, digits.as_deref())
}

pub fn rebuild_index<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<usize, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    rebuild_with(&conn)
}

/// Rewrites the whole index from the records. Unlock runs it so that vaults indexed by an
/// earlier version (without phones, courts or normalized spellings) are searchable too.
pub fn rebuild_with(conn: &Connection) -> Result<usize, Error> {
    let now = db::now();
    let tx = conn.unchecked_transaction()?;
    search_repository::clear_all(&tx)?;
    let mut count = 0;

    let mut clients =
        tx.prepare("SELECT id, full_name, internal_number, primary_phone FROM clients")?;
    let rows = clients
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, full_name, internal_number, phone) in &rows {
        search_repository::upsert(
            &tx,
            "CLIENT",
            id,
            full_name,
            phone.as_deref(),
            &client_index_text(internal_number, full_name, phone.as_deref()),
            &now,
        )?;
    }
    count += rows.len();

    let mut cases = tx.prepare(
        "SELECT c.id, c.internal_number, c.official_number, c.official_year, c.judicial_year, c.court_name,
                COALESCE(group_concat(cl.full_name, ' '), '')
         FROM cases c
         LEFT JOIN case_clients cc ON cc.case_id = c.id
         LEFT JOIN clients cl ON cl.id = cc.client_id
         GROUP BY c.id",
    )?;
    let rows = cases
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, internal_number, official_number, official_year, judicial_year, court, clients) in
        &rows
    {
        search_repository::upsert(
            &tx,
            "CASE",
            id,
            internal_number,
            official_number.as_deref(),
            &case_index_text(
                internal_number,
                official_number.as_deref(),
                *official_year,
                *judicial_year,
                court.as_deref(),
                clients,
            ),
            &now,
        )?;
    }
    count += rows.len();

    let mut powers = tx.prepare(
        "SELECT p.id, p.internal_sequence, p.official_number, p.notary_office,
                COALESCE(group_concat(c.full_name, ' '), '')
         FROM powers_of_attorney p
         LEFT JOIN power_of_attorney_clients pc ON pc.power_of_attorney_id = p.id
         LEFT JOIN clients c ON c.id = pc.client_id
         GROUP BY p.id",
    )?;
    let rows = powers
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, internal_sequence, official_number, notary_office, clients) in &rows {
        search_repository::upsert(
            &tx,
            "POWER_OF_ATTORNEY",
            id,
            internal_sequence,
            official_number.as_deref(),
            &power_of_attorney_index_text(
                internal_sequence,
                official_number.as_deref(),
                notary_office.as_deref(),
                clients,
            ),
            &now,
        )?;
    }
    count += rows.len();

    drop(powers);
    drop(cases);
    drop(clients);
    tx.commit()?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn vault() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        conn.execute_batch(
            "INSERT INTO clients (id, internal_number, full_name, primary_phone, normalized_phone, created_at, updated_at)
             VALUES ('00000000-0000-0000-0000-000000000001', '1', 'أحمد محمود علي', '0122 333 4444', '01223334444', 'now', 'now');
             INSERT INTO cases (id, internal_number, official_number, official_year, court_name, status, created_at, updated_at)
             VALUES ('00000000-0000-0000-0000-000000000002', '2026/15', '447', 2026, 'محكمة شمال القاهرة', 'ACTIVE', 'now', 'now');
             INSERT INTO case_clients (case_id, client_id, created_at, updated_at)
             VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'now', 'now');",
        )
        .unwrap();
        conn
    }

    fn hits(conn: &Connection, query: &str) -> Vec<String> {
        let text = normalize::like_pattern(&normalize::normalize_text(query));
        let digits = Some(normalize::normalize_phone(query))
            .filter(|digits| digits.len() >= 3)
            .map(|digits| normalize::like_pattern(&digits));
        search_repository::search(conn, &text, digits.as_deref())
            .unwrap()
            .into_iter()
            .map(|hit| format!("{}:{}", hit.entity_type, hit.title))
            .collect()
    }

    #[test]
    fn rebuilt_index_finds_spelling_variants_phones_courts_and_case_clients() {
        let conn = vault();
        assert_eq!(rebuild_with(&conn).unwrap(), 2);
        assert_eq!(
            hits(&conn, "احمد"),
            vec!["CASE:2026/15", "CLIENT:أحمد محمود علي"]
        );
        assert_eq!(hits(&conn, "01223334444"), vec!["CLIENT:أحمد محمود علي"]);
        assert_eq!(hits(&conn, "٠١٢٢٣٣٣"), vec!["CLIENT:أحمد محمود علي"]);
        assert_eq!(hits(&conn, "شمال القاهره"), vec!["CASE:2026/15"]);
    }

    #[test]
    fn unrelated_queries_find_nothing() {
        let conn = vault();
        rebuild_with(&conn).unwrap();
        assert!(hits(&conn, "مصطفى").is_empty());
        assert!(hits(&conn, "999").is_empty());
    }
}
