use crate::errors::Error;
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager, Runtime};

const SECURITY_FILE: &str = "security.json";
const DB_FILE: &str = "legalmaster.sqlite";

const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../../migrations/0001_foundation.sql")),
    (
        2,
        include_str!("../../migrations/0002_application_foundation.sql"),
    ),
    (
        3,
        include_str!("../../migrations/0003_clients_and_cases.sql"),
    ),
    (
        4,
        include_str!("../../migrations/0004_events_tasks_documents.sql"),
    ),
    (
        5,
        include_str!("../../migrations/0005_financial_tracking.sql"),
    ),
    (
        6,
        include_str!("../../migrations/0006_reminder_delivery.sql"),
    ),
];

pub fn app_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|_| Error::Io(std::io::Error::other("app data path unavailable")))?
        .join("LegalMasterSolo");
    fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn paths<R: Runtime>(app: &AppHandle<R>) -> Result<(PathBuf, PathBuf), Error> {
    let root = app_dir(app)?;
    Ok((root.join(SECURITY_FILE), root.join(DB_FILE)))
}

pub fn now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

pub fn open_db(path: &Path, master: &[u8; 32]) -> Result<Connection, Error> {
    let db = Connection::open(path)?;
    db.pragma_update(None, "key", format!("x'{}'", hex::encode(master)))?;
    db.busy_timeout(std::time::Duration::from_secs(10))?;
    db.execute_batch("PRAGMA cipher_memory_security = ON; PRAGMA foreign_keys = ON; SELECT count(*) FROM sqlite_master;")?;
    Ok(db)
}

pub fn schema_version(db: &Connection) -> i64 {
    db.query_row(
        "SELECT schema_version FROM app_metadata WHERE id = 1",
        [],
        |r| r.get(0),
    )
    .unwrap_or(0)
}

pub fn latest_schema_version() -> i64 {
    MIGRATIONS.last().map(|(version, _)| *version).unwrap_or(0)
}

pub fn migrate(db: &Connection) -> Result<(), Error> {
    for (version, migration) in MIGRATIONS {
        let current: Option<i64> = db
            .query_row(
                "SELECT schema_version FROM app_metadata WHERE id = 1",
                [],
                |r| r.get(0),
            )
            .ok();
        if current.unwrap_or(0) >= *version {
            continue;
        }
        let tx = db.unchecked_transaction()?;
        tx.execute_batch(migration)?;
        if *version == 1 {
            tx.execute("INSERT OR IGNORE INTO app_metadata (id, installation_uuid, schema_version, created_at, updated_at) VALUES (1, lower(hex(randomblob(16))), 1, ?1, ?1)", [now()])?;
        } else {
            tx.execute(
                "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                rusqlite::params![version, now()],
            )?;
            tx.execute(
                "UPDATE app_metadata SET schema_version = ?1, updated_at = ?2 WHERE id = 1",
                rusqlite::params![version, now()],
            )?;
        }
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_create_foundation_tables_and_schema_version() {
        let db = Connection::open_in_memory().unwrap();
        migrate(&db).unwrap();
        let version = schema_version(&db);
        let settings_exists: String = db
            .query_row(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let clients_exists: String = db
            .query_row(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clients'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 6);
        assert_eq!(settings_exists, "app_settings");
        assert_eq!(clients_exists, "clients");
    }
}
