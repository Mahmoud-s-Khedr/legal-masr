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
    (
        7,
        include_str!("../../migrations/0007_canonical_legal_masr.sql"),
    ),
    (
        8,
        include_str!("../../migrations/0008_repair_missing_app_settings.sql"),
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
        if *version == 7 && legacy_domain_data_exists(db)? {
            return Err(Error::LegacyDataMigrationRequired);
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
        }
        tx.commit()?;
    }
    Ok(())
}

fn migration_is_applied(db: &Connection, version: i64) -> bool {
    let schema_history_exists: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if schema_history_exists {
        if version == 1 {
            return db
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_metadata')",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(false);
        }
        return db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                [version],
                |row| row.get(0),
            )
            .unwrap_or(false);
    }

    db.query_row(
        "SELECT schema_version >= ?1 FROM app_metadata WHERE id = 1",
        [version],
        |row| row.get(0),
    )
    .unwrap_or(false)
}

fn legacy_domain_data_exists(db: &Connection) -> Result<bool, Error> {
    const LEGACY_TABLES: &[&str] = &[
        "clients",
        "client_contacts",
        "cases",
        "case_clients",
        "case_parties",
        "case_events",
        "tasks",
        "documents",
        "case_fee_agreements",
        "financial_transactions",
        "search_index",
        "activity_history",
        "reminder_deliveries",
    ];

    for table in LEGACY_TABLES {
        let sql = format!("SELECT EXISTS(SELECT 1 FROM {table} LIMIT 1)");
        if db.query_row(&sql, [], |row| row.get::<_, bool>(0))? {
            return Ok(true);
        }
    }
    Ok(false)
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
        assert_eq!(version, 8);
        assert_eq!(settings_exists, "app_settings");
        assert_eq!(clients_exists, "clients");
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
    fn populated_legacy_vault_is_rejected_without_schema_replacement() {
        let db = Connection::open_in_memory().unwrap();
        for (_, migration) in MIGRATIONS.iter().take(6) {
            db.execute_batch(migration).unwrap();
        }
        db.execute(
            "INSERT INTO app_metadata (id, installation_uuid, schema_version, created_at, updated_at) VALUES (1, 'legacy-installation', 6, 'now', 'now')",
            [],
        )
        .unwrap();
        for version in 2..=6 {
            db.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, 'now')",
                [version],
            )
            .unwrap();
        }
        db.execute(
            "INSERT INTO clients (id, client_type, display_name, created_at, updated_at) VALUES ('legacy-client', 'INDIVIDUAL', 'سجل قديم', 'now', 'now')",
            [],
        )
        .unwrap();

        assert!(matches!(
            migrate(&db),
            Err(Error::LegacyDataMigrationRequired)
        ));
        let legacy_clients: String = db
            .query_row(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clients'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(legacy_clients, "clients");
    }

    #[test]
    fn migration_repairs_a_missing_settings_singleton_without_overwriting_preferences() {
        let db = Connection::open_in_memory().unwrap();
        migrate(&db).unwrap();
        db.execute("DELETE FROM app_settings WHERE id = 1", [])
            .unwrap();
        db.execute("DELETE FROM schema_migrations WHERE version = 8", [])
            .unwrap();

        migrate(&db).unwrap();

        let settings: (String, String, i64, i64) = db
            .query_row(
                "SELECT language, theme, default_reminder_minutes, lock_timeout_minutes FROM app_settings WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(settings, ("ar".into(), "system".into(), 60, 15));
        assert_eq!(schema_version(&db), 8);

        db.execute(
            "UPDATE app_settings SET language = 'en', theme = 'dark', default_reminder_minutes = 45, lock_timeout_minutes = 30 WHERE id = 1",
            [],
        )
        .unwrap();
        db.execute("DELETE FROM schema_migrations WHERE version = 8", [])
            .unwrap();
        migrate(&db).unwrap();
        let preserved: (String, String, i64, i64) = db
            .query_row(
                "SELECT language, theme, default_reminder_minutes, lock_timeout_minutes FROM app_settings WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(preserved, ("en".into(), "dark".into(), 45, 30));
    }
}
