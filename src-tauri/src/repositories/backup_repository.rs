use crate::errors::Error;
use rusqlite::{params, Connection};

pub fn start(conn: &Connection, id: &str, now: &str) -> Result<(), Error> {
    conn.execute("INSERT INTO backup_history (id, started_at, status, created_at) VALUES (?1, ?2, 'RUNNING', ?2)", params![id, now])?;
    Ok(())
}

pub fn finish(
    conn: &Connection,
    id: &str,
    succeeded: bool,
    size: Option<i64>,
    error_code: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    conn.execute("UPDATE backup_history SET status = ?2, completed_at = ?3, archive_size_bytes = ?4, error_code = ?5 WHERE id = ?1", params![id, if succeeded { "SUCCEEDED" } else { "FAILED" }, now, size, error_code])?;
    Ok(())
}
