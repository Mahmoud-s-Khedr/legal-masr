use base64::{engine::general_purpose::STANDARD, Engine};
use legalmaster_lib::{backup, db, security};
use std::fs;

const SAMPLE_VALUE: &str = "قضية سرية للاختبار-98765";

#[test]
fn full_security_and_backup_lifecycle_survives_close_reopen_and_restore() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("legalmaster.sqlite");

    let master = security::random_32();
    {
        let conn = db::open_db(&db_path, &master).unwrap();
        db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO spike_records (id, value, created_at) VALUES (lower(hex(randomblob(16))), ?1, ?2)",
            [SAMPLE_VALUE, &db::now()],
        )
        .unwrap();
    }

    {
        let conn = db::open_db(&db_path, &master).unwrap();
        let value: String = conn
            .query_row(
                "SELECT value FROM spike_records WHERE value = ?1",
                [SAMPLE_VALUE],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(value, SAMPLE_VALUE);
    }

    {
        let wrong_master = security::random_32();
        assert!(db::open_db(&db_path, &wrong_master).is_err());
    }

    let salt = security::random_32();
    let password_key =
        security::derive_password("a secure local password", &salt, 19_456, 2, 1).unwrap();
    let wrong_password_key =
        security::derive_password("a wrong local password", &salt, 19_456, 2, 1).unwrap();
    let password_envelope = security::wrap(&password_key, &master).unwrap();
    assert_eq!(
        security::unwrap(&password_key, &password_envelope).unwrap(),
        master
    );
    assert!(security::unwrap(&wrong_password_key, &password_envelope).is_err());

    let new_salt = security::random_32();
    let new_password_key =
        security::derive_password("a new secure local password", &new_salt, 19_456, 2, 1).unwrap();
    let new_password_envelope = security::wrap(&new_password_key, &master).unwrap();
    assert!(security::unwrap(&new_password_key, &password_envelope).is_err());
    assert_eq!(
        security::unwrap(&new_password_key, &new_password_envelope).unwrap(),
        master
    );

    let recovery_key = hex::encode(security::random_32());
    let recovery_envelope =
        security::wrap(&security::recovery_key_material(&recovery_key), &master).unwrap();
    let recovered = security::unwrap(
        &security::recovery_key_material(&recovery_key),
        &recovery_envelope,
    )
    .unwrap();
    assert_eq!(recovered, master);

    let backup_dir = tempfile::tempdir().unwrap();
    let backup_path =
        backup::create(&db_path, &master, backup_dir.path().to_str().unwrap()).unwrap();
    backup::validate(&backup_path, &master).unwrap();

    let active_dir = tempfile::tempdir().unwrap();
    let active_db_path = active_dir.path().join("legalmaster.sqlite");
    fs::copy(&db_path, &active_db_path).unwrap();
    {
        let conn = db::open_db(&active_db_path, &master).unwrap();
        conn.execute("DELETE FROM spike_records WHERE value = ?1", [SAMPLE_VALUE])
            .unwrap();
    }

    backup::restore(&active_db_path, &master, &backup_path).unwrap();

    let conn = db::open_db(&active_db_path, &master).unwrap();
    let restored_value: String = conn
        .query_row(
            "SELECT value FROM spike_records WHERE value = ?1",
            [SAMPLE_VALUE],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(restored_value, SAMPLE_VALUE);

    let raw_db_bytes = fs::read(&active_db_path).unwrap();
    assert!(!contains_plaintext(&raw_db_bytes, SAMPLE_VALUE));

    let backup_json = fs::read_to_string(&backup_path).unwrap();
    assert!(!backup_json.contains(SAMPLE_VALUE));
    let envelope: serde_json::Value = serde_json::from_str(&backup_json).unwrap();
    let ciphertext = STANDARD
        .decode(envelope["ciphertext"].as_str().unwrap())
        .unwrap();
    assert!(!contains_plaintext(&ciphertext, SAMPLE_VALUE));
}

fn contains_plaintext(haystack: &[u8], needle: &str) -> bool {
    let needle = needle.as_bytes();
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}
