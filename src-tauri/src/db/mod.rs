use crate::errors::Error;
use rusqlite::{Connection, OpenFlags};
use std::{
    fs,
    path::{Path, PathBuf},
};
#[cfg(not(feature = "desktop-e2e"))]
use tauri::Manager;
use tauri::{AppHandle, Runtime};

const SECURITY_FILE: &str = "security.json";
const DB_FILE: &str = "legalmaster.sqlite";

const MIGRATIONS: &[(i64, &str)] = &[
    (
        1,
        include_str!("../../migrations/0001_canonical_legal_masr.sql"),
    ),
    (
        2,
        include_str!("../../migrations/0002_case_judicial_year.sql"),
    ),
];

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

/// Creation is an explicit setup/test operation. Reserve the filename without
/// replacement before SQLite opens it; ordinary opens never have CREATE rights.
pub fn create_db(path: &Path, master: &[u8; 32]) -> Result<Connection, Error> {
    let file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    drop(file);
    match keyed_connection(path, master) {
        Ok(db) => Ok(db),
        Err(error) => {
            let _ = fs::remove_file(path);
            Err(error)
        }
    }
}

fn keyed_connection(path: &Path, master: &[u8; 32]) -> Result<Connection, Error> {
    let db = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    db.pragma_update(None, "key", format!("x'{}'", hex::encode(master)))?;
    db.busy_timeout(std::time::Duration::from_secs(10))?;
    db.execute_batch("PRAGMA cipher_memory_security = ON; PRAGMA foreign_keys = ON; SELECT count(*) FROM sqlite_master;")?;
    crate::normalize::register_sql_functions(&db)?;
    Ok(db)
}

/// Existing vault access must not turn missing or partial artifacts into a new
/// workspace. Credentials are authenticated separately before this call.
pub fn open_db(path: &Path, master: &[u8; 32]) -> Result<Connection, Error> {
    match fs::metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(Error::VaultMissing)
        }
        Err(error) => return Err(error.into()),
        Ok(metadata) if !metadata.is_file() || metadata.len() == 0 => {
            return Err(Error::VaultIncomplete)
        }
        Ok(_) => (),
    }
    let db = keyed_connection(path, master).map_err(|error| match error {
        Error::Sql(rusqlite::Error::SqliteFailure(code, _))
            if matches!(
                code.code,
                rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase
            ) =>
        {
            Error::VaultCorrupt
        }
        other => other,
    })?;
    if !migration_is_applied(&db, 1) {
        return if pre_reset_schema_exists(&db)? {
            Err(Error::LegacyDataMigrationRequired)
        } else {
            Err(Error::VaultIncomplete)
        };
    }
    if schema_version(&db) > latest_schema_version() {
        return Err(Error::VaultNewerSchema);
    }
    Ok(db)
}

/// Include interrupted setup/security/restore files and SQLite sidecars. Empty
/// directories made during setup are also artifacts: setup may never overwrite
/// a prior attempt or stranded attachments. Logs are not vault contents.
pub fn has_vault_artifacts(root: &Path) -> Result<bool, Error> {
    for entry in fs::read_dir(root)? {
        let name = entry?.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("legalmaster.")
            || name.starts_with("security.")
            || name.starts_with("attachments")
            || name == "Backups"
            || name == "vault-operation.json"
            || name == "EmergencySnapshots"
        {
            return Ok(true);
        }
    }
    Ok(false)
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
    // Queries use these helpers; connections opened without `keyed_connection` (such as
    // in-memory test databases) get them here.
    crate::normalize::register_sql_functions(db)?;
    if schema_version(db) > latest_schema_version() {
        return Err(Error::VaultNewerSchema);
    }
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

    /// A vault exactly as the previous release left it: only migration 1 applied.
    fn version_one_vault() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let (version, sql) = MIGRATIONS[0];
        assert_eq!(version, 1);
        let tx = conn.unchecked_transaction().unwrap();
        tx.execute_batch(sql).unwrap();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, now()],
        )
        .unwrap();
        tx.commit().unwrap();
        assert_eq!(schema_version(&conn), 1);
        conn
    }

    #[test]
    fn upgrading_a_populated_version_one_vault_keeps_every_record_and_adds_judicial_year() {
        let conn = version_one_vault();
        let (client_id, case_id, hearing_id) = (
            uuid::Uuid::new_v4().to_string(),
            uuid::Uuid::new_v4().to_string(),
            uuid::Uuid::new_v4().to_string(),
        );
        conn.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'أحمد', 'now', 'now')", [&client_id]).unwrap();
        conn.execute("INSERT INTO cases (id, internal_number, official_number, official_year, status, created_at, updated_at) VALUES (?1, 'CA-1', '447', 2026, 'ACTIVE', 'now', 'now')", [&case_id]).unwrap();
        conn.execute("INSERT INTO case_clients (case_id, client_id, created_at, updated_at) VALUES (?1, ?2, 'now', 'now')", rusqlite::params![case_id, client_id]).unwrap();
        conn.execute("INSERT INTO hearings (id, case_id, hearing_date, created_at, updated_at) VALUES (?1, ?2, '2026-10-03', 'now', 'now')", rusqlite::params![hearing_id, case_id]).unwrap();

        migrate(&conn).unwrap();

        assert_eq!(schema_version(&conn), latest_schema_version());
        assert!(latest_schema_version() >= 2);
        // The case kept its Gregorian year, and no judicial year was invented.
        let (number, year, judicial): (String, Option<i64>, Option<i64>) = conn
            .query_row(
                "SELECT official_number, official_year, judicial_year FROM cases WHERE id = ?1",
                [&case_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!((number.as_str(), year, judicial), ("447", Some(2026), None));
        // Children survived the upgrade and the relationships are still consistent.
        for (table, expected) in [("case_clients", 1_i64), ("hearings", 1), ("clients", 1)] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert_eq!(count, expected, "{table} rows were lost by the upgrade");
        }
        let violations: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(violations, 0);

        // A judicial year such as 89 is now storable; the database still bounds it.
        conn.execute(
            "UPDATE cases SET judicial_year = 89 WHERE id = ?1",
            [&case_id],
        )
        .unwrap();
        for invalid in [0_i64, -1, 10_000] {
            assert!(conn
                .execute(
                    "UPDATE cases SET judicial_year = ?2 WHERE id = ?1",
                    rusqlite::params![case_id, invalid]
                )
                .is_err());
        }
        // The Gregorian year constraint is unchanged.
        assert!(conn
            .execute(
                "UPDATE cases SET official_year = 89 WHERE id = ?1",
                [&case_id]
            )
            .is_err());

        // Re-running migrations is a no-op.
        migrate(&conn).unwrap();
        let applied: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(applied, latest_schema_version());
    }

    #[test]
    fn existing_open_never_creates_a_missing_database() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("legalmaster.sqlite");
        assert!(matches!(open_db(&path, &[7; 32]), Err(Error::VaultMissing)));
        assert!(!path.exists());
    }

    #[test]
    fn explicit_creation_refuses_existing_contents() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("legalmaster.sqlite");
        fs::write(&path, b"preserve stranded vault").unwrap();
        assert!(create_db(&path, &[7; 32]).is_err());
        assert_eq!(fs::read(path).unwrap(), b"preserve stranded vault");
    }

    #[test]
    fn existing_open_rejects_empty_corrupt_legacy_and_newer_vaults() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("legalmaster.sqlite");
        let master = [7; 32];
        fs::write(&path, []).unwrap();
        assert!(matches!(
            open_db(&path, &master),
            Err(Error::VaultIncomplete)
        ));
        fs::write(&path, b"not a database").unwrap();
        assert!(matches!(open_db(&path, &master), Err(Error::VaultCorrupt)));
        assert_eq!(fs::read(&path).unwrap(), b"not a database");
        fs::remove_file(&path).unwrap();
        {
            let conn = create_db(&path, &master).unwrap();
            conn.execute_batch("CREATE TABLE legacy_records (id TEXT)")
                .unwrap();
        }
        assert!(matches!(
            open_db(&path, &master),
            Err(Error::LegacyDataMigrationRequired)
        ));
        fs::remove_file(&path).unwrap();
        {
            let conn = create_db(&path, &master).unwrap();
            migrate(&conn).unwrap();
            conn.execute("INSERT INTO schema_migrations VALUES (999, 'future')", [])
                .unwrap();
        }
        let before = fs::read(&path).unwrap();
        assert!(matches!(
            open_db(&path, &master),
            Err(Error::VaultNewerSchema)
        ));
        assert_eq!(fs::read(&path).unwrap(), before);
    }

    #[test]
    fn creation_migration_and_existing_open_round_trip() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("legalmaster.sqlite");
        let master = [7; 32];
        {
            let conn = create_db(&path, &master).unwrap();
            migrate(&conn).unwrap();
        }
        let conn = open_db(&path, &master).unwrap();
        assert_eq!(schema_version(&conn), latest_schema_version());
        migrate(&conn).unwrap();
    }

    #[test]
    fn setup_guard_includes_stranded_files_and_directories() {
        let temp = tempfile::tempdir().unwrap();
        assert!(!has_vault_artifacts(temp.path()).unwrap());
        fs::create_dir(temp.path().join("logs")).unwrap();
        assert!(!has_vault_artifacts(temp.path()).unwrap());
        for name in [
            "legalmaster.sqlite",
            "legalmaster.sqlite-wal",
            "legalmaster.tmp",
            "security.json",
            "security.previous",
            "security.write-test.tmp",
            "vault-operation.json",
        ] {
            let path = temp.path().join(name);
            fs::write(&path, b"stranded artifact").unwrap();
            assert!(has_vault_artifacts(temp.path()).unwrap(), "{name}");
            fs::remove_file(path).unwrap();
        }
        for name in [
            "attachments",
            "attachments.restore.tmp",
            "Backups",
            "EmergencySnapshots",
        ] {
            let path = temp.path().join(name);
            fs::create_dir(&path).unwrap();
            assert!(has_vault_artifacts(temp.path()).unwrap(), "{name}");
            fs::remove_dir(path).unwrap();
        }
    }

    #[test]
    fn migration_refuses_newer_version_without_changes() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (999, 'future')", [])
            .unwrap();
        assert!(matches!(migrate(&conn), Err(Error::VaultNewerSchema)));
        assert_eq!(schema_version(&conn), 999);
    }

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
        assert_eq!(version, latest_schema_version());
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
