use crate::errors::Error;
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
};
#[cfg(not(feature = "desktop-e2e"))]
use tauri::Manager;
use tauri::{AppHandle, Runtime};

const SECURITY_FILE: &str = "security.json";
const DB_FILE: &str = "legalmaster.sqlite";

const MIGRATIONS: &[(i64, &str)] = &[(
    1,
    include_str!("../../migrations/0001_canonical_legal_masr.sql"),
)];

pub fn app_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    let path = {
        let _ = app;
        crate::desktop_e2e::root()?.join("vault")
    };
    #[cfg(not(feature = "desktop-e2e"))]
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
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
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
        if migration_is_applied(db, *version) {
            continue;
        }
        if *version == 1 && pre_reset_schema_exists(db)? {
            return Err(Error::LegacyDataMigrationRequired);
        }
        let tx = db.unchecked_transaction()?;
        tx.execute_batch(migration)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, now()],
        )?;
        tx.commit()?;
    }
    Ok(())
}

fn migration_is_applied(db: &Connection, version: i64) -> bool {
    if version == 1 {
        let baseline_exists: bool = db
            .query_row(
                "SELECT EXISTS(
                   SELECT 1
                   FROM sqlite_master
                   WHERE type = 'table' AND name = 'migration_baseline'
                 )",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);
        if !baseline_exists {
            return false;
        }
    }

    db.query_row(
        "SELECT EXISTS(
           SELECT 1
           FROM sqlite_master
           WHERE type = 'table' AND name = 'schema_migrations'
         )
         AND EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
        [version],
        |row| row.get(0),
    )
    .unwrap_or(false)
}

fn pre_reset_schema_exists(db: &Connection) -> Result<bool, Error> {
    db.query_row(
        "SELECT EXISTS(
           SELECT 1
           FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         )",
        [],
        |row| row.get(0),
    )
    .map_err(Error::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::OptionalExtension;

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
        let settings_count: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM app_settings WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 1);
        assert_eq!(settings_exists, "app_settings");
        assert_eq!(clients_exists, "clients");
        assert_eq!(settings_count, 1);
    }

    #[test]
    fn canonical_schema_enforces_domain_invariants_and_integrity() {
        let db = Connection::open_in_memory().unwrap();
        migrate(&db).unwrap();
        let client_id = uuid::Uuid::new_v4().to_string();
        let other_client_id = uuid::Uuid::new_v4().to_string();
        let case_id = uuid::Uuid::new_v4().to_string();

        db.execute(
            "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'أحمد', 'now', 'now')",
            [&client_id],
        )
        .unwrap();
        assert!(db
            .execute(
                "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'سارة', 'now', 'now')",
                [&other_client_id],
            )
            .is_err());
        db.execute(
            "INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, 'CA-1', 'ACTIVE', 'now', 'now')",
            [&case_id],
        )
        .unwrap();

        assert!(db
            .execute(
                "INSERT INTO payments (id, case_id, payer_client_id, amount_minor, payment_date, created_at, updated_at) VALUES (?1, ?2, ?3, 100, '2026-08-24', 'now', 'now')",
                rusqlite::params![uuid::Uuid::new_v4().to_string(), case_id, client_id],
            )
            .is_err());
        db.execute(
            "INSERT INTO case_clients (case_id, client_id, created_at, updated_at) VALUES (?1, ?2, 'now', 'now')",
            rusqlite::params![case_id, client_id],
        )
        .unwrap();
        db.execute(
            "INSERT INTO payments (id, case_id, payer_client_id, amount_minor, payment_date, created_at, updated_at) VALUES (?1, ?2, ?3, 100, '2026-08-24', 'now', 'now')",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), case_id, client_id],
        )
        .unwrap();
        assert!(db
            .execute(
                "INSERT INTO tasks (id, title, due_date, completed, created_at, updated_at) VALUES (?1, 'مهمة', '2026-08-24', 2, 'now', 'now')",
                [uuid::Uuid::new_v4().to_string()],
            )
            .is_err());
        assert!(db
            .execute(
                "INSERT INTO attachments (id, original_filename, stored_filename, relative_path, file_size_bytes, sha256, created_at, updated_at) VALUES (?1, 'a.pdf', 'a.pdf', 'attachments/a.pdf', 1, ?2, 'now', 'now')",
                rusqlite::params![uuid::Uuid::new_v4().to_string(), "a".repeat(64)],
            )
            .is_err());
        assert!(db
            .execute(
                "INSERT INTO expenses (id, amount_minor, expense_date, expense_type, created_at, updated_at) VALUES (?1, 0, '2026-08-24', 'OTHER', 'now', 'now')",
                [uuid::Uuid::new_v4().to_string()],
            )
            .is_err());

        let foreign_key_check: Option<String> = db
            .query_row("PRAGMA foreign_key_check", [], |row| row.get(0))
            .optional()
            .unwrap();
        let integrity_check: String = db
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .unwrap();
        assert_eq!(foreign_key_check, None);
        assert_eq!(integrity_check, "ok");
    }

    #[test]
    fn pre_reset_schema_is_rejected_without_replacement() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
             INSERT INTO schema_migrations (version, applied_at) VALUES (1, 'now');",
        )
        .unwrap();
        db.execute(
            "CREATE TABLE clients (id TEXT PRIMARY KEY, display_name TEXT NOT NULL)",
            [],
        )
        .unwrap();
        db.execute(
            "INSERT INTO clients (id, display_name) VALUES ('legacy-client', 'سجل قديم')",
            [],
        )
        .unwrap();

        assert!(matches!(
            migrate(&db),
            Err(Error::LegacyDataMigrationRequired)
        ));
        let legacy_client: String = db
            .query_row(
                "SELECT display_name FROM clients WHERE id = 'legacy-client'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(legacy_client, "سجل قديم");
    }
}
