use rusqlite::{backup::Backup, Connection};

fn key(conn: &Connection, password: &str) {
    conn.pragma_update(None, "key", password).unwrap();
}

#[test]
fn bundled_engine_contains_the_sqlite_wal_memory_disclosure_fix() {
    let conn = Connection::open_in_memory().unwrap();
    let cipher: String = conn
        .query_row("PRAGMA cipher_version", [], |row| row.get(0))
        .expect("the bundled engine must provide SQLCipher encryption");
    let cipher_version: Vec<u32> = cipher
        .split_whitespace()
        .next()
        .unwrap()
        .split('.')
        .map(|part| part.parse().unwrap())
        .collect();
    assert!(cipher_version.as_slice() >= [4, 20, 0].as_slice());
    // RUSTSEC-2026-0459 also affects SQLCipher builds using older SQLite,
    // even when the libsqlite3-sys crate itself passes cargo audit.
    assert!(rusqlite::version_number() >= 3_054_000);
}

#[test]
fn encrypted_wal_backup_reopens_and_rejects_the_wrong_key() {
    let dir = tempfile::tempdir().unwrap();
    let source_path = dir.path().join("source.sqlite");
    let backup_path = dir.path().join("backup.sqlite");
    let source = Connection::open(&source_path).unwrap();
    key(&source, "synthetic-source-key");
    source.pragma_update(None, "journal_mode", "WAL").unwrap();
    source
        .execute_batch("CREATE TABLE records (value TEXT); INSERT INTO records VALUES ('synthetic legal record');")
        .unwrap();
    let mut destination = Connection::open(&backup_path).unwrap();
    key(&destination, "synthetic-backup-key");
    Backup::new(&source, &mut destination)
        .unwrap()
        .run_to_completion(5, std::time::Duration::from_millis(1), None)
        .unwrap();
    drop(destination);
    drop(source);

    for (path, password) in [
        (&source_path, "synthetic-source-key"),
        (&backup_path, "synthetic-backup-key"),
    ] {
        let wrong = Connection::open(path).unwrap();
        key(&wrong, "wrong-key");
        assert!(wrong
            .query_row("SELECT value FROM records", [], |row| row
                .get::<_, String>(0))
            .is_err());
        drop(wrong);

        let reopened = Connection::open(path).unwrap();
        key(&reopened, password);
        let value: String = reopened
            .query_row("SELECT value FROM records", [], |row| row.get(0))
            .unwrap();
        assert_eq!(value, "synthetic legal record");
        let count: u64 = reopened
            .query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
        drop(reopened);
        let bytes = std::fs::read(path).unwrap();
        assert!(!bytes
            .windows(value.len())
            .any(|window| window == value.as_bytes()));
    }
}
