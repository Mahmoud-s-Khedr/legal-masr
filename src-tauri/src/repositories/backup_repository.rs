use crate::{dto::LatestSuccessfulBackupDto, errors::Error};
use rusqlite::{params, Connection, OptionalExtension};

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

/// A backup's database snapshot is taken while its own history row still says RUNNING.
/// After that backup is restored, the newest RUNNING row is the restored backup itself,
/// which did succeed: record it so, with the restored file's size.
pub fn settle_restored(conn: &Connection, size: Option<i64>) -> Result<(), Error> {
    conn.execute(
        "UPDATE backup_history SET status = 'SUCCEEDED', completed_at = started_at, archive_size_bytes = ?1
         WHERE id = (SELECT id FROM backup_history WHERE status = 'RUNNING' ORDER BY started_at DESC LIMIT 1)",
        params![size],
    )?;
    Ok(())
}

pub fn latest_successful(conn: &Connection) -> Result<Option<LatestSuccessfulBackupDto>, Error> {
    conn.query_row(
        "SELECT completed_at, archive_size_bytes FROM backup_history WHERE status = 'SUCCEEDED' ORDER BY completed_at DESC LIMIT 1",
        [],
        |row| Ok(LatestSuccessfulBackupDto { completed_at: row.get(0)?, archive_size_bytes: row.get(1)? }),
    )
    .optional()
    .map_err(Error::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(
                "CREATE TABLE backup_history (
                    id TEXT PRIMARY KEY,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    status TEXT NOT NULL,
                    archive_size_bytes INTEGER,
                    error_code TEXT,
                    created_at TEXT NOT NULL
                );",
            )
            .expect("backup history table");
        connection
    }

    #[test]
    fn a_restored_backup_counts_as_the_latest_successful_one() {
        let connection = connection();
        start(&connection, "stale", "2026-08-24T07:00:00Z").expect("stale row");
        start(&connection, "restored", "2026-08-24T08:00:00Z").expect("restored row");
        assert!(latest_successful(&connection).unwrap().is_none());

        settle_restored(&connection, Some(4096)).expect("settle");

        let latest = latest_successful(&connection)
            .unwrap()
            .expect("a successful backup");
        assert_eq!(latest.completed_at, "2026-08-24T08:00:00Z");
        assert_eq!(latest.archive_size_bytes, Some(4096));
        // Only the backup being restored is settled; an older unknown run stays as it was.
        let stale: String = connection
            .query_row(
                "SELECT status FROM backup_history WHERE id = 'stale'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stale, "RUNNING");
        // With nothing running, settling changes nothing.
        settle_restored(&connection, Some(1)).expect("settle again");
        assert_eq!(
            latest_successful(&connection)
                .unwrap()
                .unwrap()
                .archive_size_bytes,
            Some(4096)
        );
    }

    #[test]
    fn returns_only_the_most_recent_successful_backup() {
        let connection = connection();
        start(&connection, "running", "2026-08-24T08:00:00Z").expect("running row");
        finish(
            &connection,
            "running",
            false,
            None,
            Some("OPERATION_FAILED"),
            "2026-08-24T08:02:00Z",
        )
        .expect("failed row");
        start(&connection, "first", "2026-08-24T08:03:00Z").expect("first row");
        finish(
            &connection,
            "first",
            true,
            Some(100),
            None,
            "2026-08-24T08:04:00Z",
        )
        .expect("first success");
        start(&connection, "latest", "2026-08-24T08:05:00Z").expect("latest row");
        finish(
            &connection,
            "latest",
            true,
            Some(200),
            None,
            "2026-08-24T08:06:00Z",
        )
        .expect("latest success");

        let latest = latest_successful(&connection)
            .expect("latest query")
            .expect("successful backup");
        assert_eq!(latest.completed_at, "2026-08-24T08:06:00Z");
        assert_eq!(latest.archive_size_bytes, Some(200));
    }

    #[test]
    fn returns_none_when_every_backup_failed_or_is_running() {
        let connection = connection();
        start(&connection, "running", "2026-08-24T08:00:00Z").expect("running row");
        assert!(latest_successful(&connection)
            .expect("latest query")
            .is_none());
    }
}
