use crate::{dto::SearchHit, errors::Error};
use rusqlite::Connection;

pub fn upsert(
    conn: &Connection,
    entity_type: &str,
    entity_id: &str,
    title: &str,
    subtitle: Option<&str>,
    normalized_text: &str,
    now: &str,
) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO search_index (entity_type, entity_id, title, subtitle, normalized_text, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET title = ?3, subtitle = ?4, normalized_text = ?5, updated_at = ?6",
        rusqlite::params![entity_type, entity_id, title, subtitle, normalized_text, now],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, entity_type: &str, entity_id: &str) -> Result<(), Error> {
    conn.execute(
        "DELETE FROM search_index WHERE entity_type = ?1 AND entity_id = ?2",
        rusqlite::params![entity_type, entity_id],
    )?;
    Ok(())
}

pub fn clear_all(conn: &Connection) -> Result<(), Error> {
    conn.execute("DELETE FROM search_index", [])?;
    Ok(())
}

/// `text` matches the normalized index text; `digits`, when given, also matches the bare
/// phone digits stored in it. Both are `LIKE … ESCAPE '\'` patterns.
pub fn search(
    conn: &Connection,
    text: &str,
    digits: Option<&str>,
) -> Result<Vec<SearchHit>, Error> {
    let mut stmt = conn.prepare(
        "SELECT entity_type, entity_id, title, subtitle FROM search_index
         WHERE normalized_text LIKE ?1 ESCAPE '\\'
            OR (?2 IS NOT NULL AND normalized_text LIKE ?2 ESCAPE '\\')
         ORDER BY entity_type, title",
    )?;
    let rows = stmt.query_map(rusqlite::params![text, digits], |row| {
        Ok(SearchHit {
            entity_type: row.get(0)?,
            entity_id: row.get(1)?,
            title: row.get(2)?,
            subtitle: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}
