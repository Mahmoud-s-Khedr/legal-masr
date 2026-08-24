use crate::{db, errors::Error, security};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::{
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

#[derive(Serialize, Deserialize)]
struct BackupEnvelope {
    version: u8,
    nonce: String,
    ciphertext: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    format_version: u8,
    application_version: String,
    schema_version: i64,
    created_at: String,
    database_encrypted: bool,
    managed_document_count: usize,
}

fn checksum(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn consistent_database_snapshot(db_path: &Path, master: &[u8; 32]) -> Result<Vec<u8>, Error> {
    let snapshot_path = db_path.with_extension(format!("backup-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let source = db::open_db(db_path, master)?;
        let mut destination = db::open_db(&snapshot_path, master)?;
        let backup = rusqlite::backup::Backup::new(&source, &mut destination)?;
        backup.run_to_completion(64, Duration::from_millis(2), None)?;
        drop(backup);
        drop(destination);
        fs::read(&snapshot_path).map_err(Error::from)
    })();
    let _ = fs::remove_file(&snapshot_path);
    result
}

pub fn create(
    db_path: &Path,
    master: &[u8; 32],
    destination: &str,
    documents: &Path,
) -> Result<String, Error> {
    let destination = PathBuf::from(destination);
    fs::create_dir_all(&destination)?;
    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    let database = consistent_database_snapshot(db_path, master)?;
    let opened = db::open_db(db_path, master)?;
    let manifest = BackupManifest {
        format_version: 1,
        application_version: env!("CARGO_PKG_VERSION").into(),
        schema_version: db::schema_version(&opened),
        created_at: db::now(),
        database_encrypted: true,
        managed_document_count: 0,
    };
    let mut checksums = BTreeMap::new();
    checksums.insert("database.sqlite".to_owned(), checksum(&database));
    archive.start_file("database.sqlite", SimpleFileOptions::default())?;
    archive.write_all(&database)?;
    let mut document_count = 0usize;
    if documents.is_dir() {
        for entry in fs::read_dir(documents)? {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                continue;
            }
            let bytes = fs::read(entry.path())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let archive_name = format!("attachments/{name}");
            checksums.insert(archive_name.clone(), checksum(&bytes));
            archive.start_file(archive_name, SimpleFileOptions::default())?;
            archive.write_all(&bytes)?;
            document_count += 1;
        }
    }
    let manifest = BackupManifest {
        managed_document_count: document_count,
        ..manifest
    };
    archive.start_file("manifest.json", SimpleFileOptions::default())?;
    archive.write_all(&serde_json::to_vec(&manifest)?)?;
    archive.start_file("checksums.json", SimpleFileOptions::default())?;
    archive.write_all(&serde_json::to_vec(&checksums)?)?;
    let plaintext = archive.finish()?.into_inner();
    let key = security::backup_key(master);
    let nonce = security::random_32();
    let cipher = XChaCha20Poly1305::new_from_slice(&key).map_err(|_| Error::BackupInvalid)?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce[..24]), plaintext.as_ref())
        .map_err(|_| Error::BackupInvalid)?;
    let payload = serde_json::to_vec(&BackupEnvelope {
        version: 1,
        nonce: STANDARD.encode(&nonce[..24]),
        ciphertext: STANDARD.encode(ciphertext),
    })?;
    let output = destination.join(format!(
        "legalmaster-backup-{}.lmsbackup",
        time::OffsetDateTime::now_utc().unix_timestamp_nanos()
    ));
    let temp = output.with_extension("tmp");
    let mut file = fs::File::create(&temp)?;
    file.write_all(&payload)?;
    file.sync_all()?;
    drop(file);
    fs::rename(temp, &output)?;
    if let Err(error) = validate(&output.to_string_lossy(), master) {
        let _ = fs::remove_file(&output);
        return Err(error);
    }
    Ok(output.to_string_lossy().into_owned())
}

fn decrypt(path: &str, master: &[u8; 32]) -> Result<Vec<u8>, Error> {
    let payload: BackupEnvelope = serde_json::from_slice(&fs::read(path)?)?;
    if payload.version != 1 {
        return Err(Error::BackupInvalid);
    }
    let key = security::backup_key(master);
    let nonce = STANDARD
        .decode(payload.nonce)
        .map_err(|_| Error::BackupInvalid)?;
    let ciphertext = STANDARD
        .decode(payload.ciphertext)
        .map_err(|_| Error::BackupInvalid)?;
    XChaCha20Poly1305::new_from_slice(&key)
        .map_err(|_| Error::BackupInvalid)?
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| Error::BackupInvalid)
}

pub fn validate(path: &str, master: &[u8; 32]) -> Result<(), Error> {
    let bytes = decrypt(path, master)?;
    let mut archive = ZipArchive::new(Cursor::new(bytes))?;
    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_string(&mut manifest)?;
    let manifest: BackupManifest =
        serde_json::from_str(&manifest).map_err(|_| Error::BackupInvalid)?;
    if manifest.format_version != 1 || !manifest.database_encrypted || manifest.schema_version <= 0
    {
        return Err(Error::BackupInvalid);
    }
    let mut checksums_json = String::new();
    archive
        .by_name("checksums.json")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_string(&mut checksums_json)?;
    let checksums: BTreeMap<String, String> =
        serde_json::from_str(&checksums_json).map_err(|_| Error::BackupInvalid)?;
    for (name, expected) in checksums {
        let mut bytes = Vec::new();
        archive
            .by_name(&name)
            .map_err(|_| Error::BackupInvalid)?
            .read_to_end(&mut bytes)?;
        if checksum(&bytes) != expected {
            return Err(Error::BackupInvalid);
        }
    }
    Ok(())
}

pub fn restore(
    active_db: &Path,
    master: &[u8; 32],
    path: &str,
    documents_root: &Path,
) -> Result<(), Error> {
    validate(path, master)?;
    let bytes = decrypt(path, master)?;
    let mut archive = ZipArchive::new(Cursor::new(bytes))?;
    let mut db_bytes = Vec::new();
    archive
        .by_name("database.sqlite")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_end(&mut db_bytes)?;
    let documents_staging = documents_root.with_extension("restore.tmp");
    if documents_staging.exists() {
        fs::remove_dir_all(&documents_staging)?;
    }
    let staging = active_db.with_extension("restore.tmp");
    let result = (|| -> Result<(), Error> {
        fs::create_dir_all(&documents_staging)?;
        for index in 0..archive.len() {
            let mut entry = archive.by_index(index)?;
            let Some(name) = entry.enclosed_name() else {
                return Err(Error::BackupInvalid);
            };
            let relative = name.strip_prefix("attachments/");
            let Ok(relative) = relative else {
                continue;
            };
            if relative.as_os_str().is_empty() || relative.components().count() != 1 {
                return Err(Error::BackupInvalid);
            }
            let target = documents_staging.join(relative);
            let mut output = fs::File::create(target)?;
            std::io::copy(&mut entry, &mut output)?;
        }
        fs::write(&staging, db_bytes)?;
        let restored = db::open_db(&staging, master).map_err(|_| Error::BackupInvalid)?;
        if db::schema_version(&restored) > db::latest_schema_version() {
            return Err(Error::BackupInvalid);
        }
        db::migrate(&restored).map_err(|_| Error::BackupInvalid)?;
        restored
            .query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))
            .map_err(|_| Error::BackupInvalid)
            .and_then(|value| {
                if value == "ok" {
                    Ok(())
                } else {
                    Err(Error::BackupInvalid)
                }
            })?;
        drop(restored);
        let restore_id = time::OffsetDateTime::now_utc().unix_timestamp_nanos();
        let emergency = active_db.with_extension(format!("pre-restore-{restore_id}.bak"));
        let documents_emergency = documents_root.with_extension("pre-restore");
        if documents_emergency.exists() {
            fs::remove_dir_all(&documents_emergency)?;
        }
        fs::rename(active_db, &emergency)?;
        if documents_root.exists() {
            if let Err(error) = fs::rename(documents_root, &documents_emergency) {
                let _ = fs::rename(&emergency, active_db);
                return Err(error.into());
            }
        }
        if let Err(error) = fs::rename(&documents_staging, documents_root) {
            if documents_emergency.exists() {
                let _ = fs::rename(&documents_emergency, documents_root);
            }
            let _ = fs::rename(&emergency, active_db);
            return Err(error.into());
        }
        if let Err(error) = fs::rename(&staging, active_db) {
            let _ = fs::remove_dir_all(documents_root);
            if documents_emergency.exists() {
                let _ = fs::rename(&documents_emergency, documents_root);
            }
            let _ = fs::rename(&emergency, active_db);
            return Err(error.into());
        }
        if documents_emergency.exists() {
            let _ = fs::remove_dir_all(documents_emergency);
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&documents_staging);
        let _ = fs::remove_file(&staging);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn migrated_database(path: &Path, master: &[u8; 32], client_number: &str) {
        let connection = db::open_db(path, master).unwrap();
        db::migrate(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, 'أحمد', 'now', 'now')",
                params![uuid::Uuid::new_v4().to_string(), client_number],
            )
            .unwrap();
    }

    fn archive_with_entries(
        path: &Path,
        master: &[u8; 32],
        database: &[u8],
        attachments: &[(&str, &[u8])],
    ) {
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        let mut checksums = BTreeMap::new();
        checksums.insert("database.sqlite".to_owned(), checksum(database));
        archive
            .start_file("database.sqlite", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(database).unwrap();
        for (name, content) in attachments {
            let name = format!("attachments/{name}");
            checksums.insert(name.clone(), checksum(content));
            archive
                .start_file(name, SimpleFileOptions::default())
                .unwrap();
            archive.write_all(content).unwrap();
        }
        let manifest = BackupManifest {
            format_version: 1,
            application_version: "test".into(),
            schema_version: db::latest_schema_version(),
            created_at: db::now(),
            database_encrypted: true,
            managed_document_count: attachments.len(),
        };
        archive
            .start_file("manifest.json", SimpleFileOptions::default())
            .unwrap();
        archive
            .write_all(&serde_json::to_vec(&manifest).unwrap())
            .unwrap();
        archive
            .start_file("checksums.json", SimpleFileOptions::default())
            .unwrap();
        archive
            .write_all(&serde_json::to_vec(&checksums).unwrap())
            .unwrap();
        let plaintext = archive.finish().unwrap().into_inner();
        let nonce = security::random_32();
        let key = security::backup_key(master);
        let ciphertext = XChaCha20Poly1305::new_from_slice(&key)
            .unwrap()
            .encrypt(XNonce::from_slice(&nonce[..24]), plaintext.as_ref())
            .unwrap();
        let envelope = BackupEnvelope {
            version: 1,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
        };
        fs::write(path, serde_json::to_vec(&envelope).unwrap()).unwrap();
    }

    #[test]
    fn backup_contains_database_attachments_manifest_and_restores_them() {
        let temp = tempfile::tempdir().unwrap();
        let master = security::random_32();
        let source = temp.path().join("source.sqlite");
        let source_attachments = temp.path().join("source-attachments");
        migrated_database(&source, &master, "CL-BACKUP");
        fs::create_dir(&source_attachments).unwrap();
        fs::write(source_attachments.join("scan.pdf"), b"durable copy").unwrap();

        let destination = temp.path().join("backups");
        let backup = create(
            &source,
            &master,
            &destination.to_string_lossy(),
            &source_attachments,
        )
        .unwrap();
        validate(&backup, &master).unwrap();
        let mut archive = ZipArchive::new(Cursor::new(decrypt(&backup, &master).unwrap())).unwrap();
        let manifest: BackupManifest =
            serde_json::from_reader(archive.by_name("manifest.json").unwrap()).unwrap();
        assert_eq!(manifest.managed_document_count, 1);
        assert!(archive.by_name("database.sqlite").is_ok());
        assert!(archive.by_name("attachments/scan.pdf").is_ok());
        assert!(archive.by_name("checksums.json").is_ok());

        let active = temp.path().join("active.sqlite");
        let active_attachments = temp.path().join("active-attachments");
        migrated_database(&active, &master, "CL-OLD");
        fs::create_dir(&active_attachments).unwrap();
        fs::write(active_attachments.join("old.pdf"), b"old").unwrap();
        restore(&active, &master, &backup, &active_attachments).unwrap();

        let connection = db::open_db(&active, &master).unwrap();
        let restored_client: String = connection
            .query_row("SELECT internal_number FROM clients", [], |row| row.get(0))
            .unwrap();
        assert_eq!(restored_client, "CL-BACKUP");
        assert_eq!(
            fs::read(active_attachments.join("scan.pdf")).unwrap(),
            b"durable copy"
        );
        assert!(!active_attachments.join("old.pdf").exists());
    }

    #[test]
    fn corrupt_restore_staging_never_changes_active_data_or_leaves_staging_files() {
        let temp = tempfile::tempdir().unwrap();
        let master = security::random_32();
        let active = temp.path().join("active.sqlite");
        let documents = temp.path().join("attachments");
        migrated_database(&active, &master, "CL-LIVE");
        fs::create_dir(&documents).unwrap();
        fs::write(documents.join("live.pdf"), b"live").unwrap();
        let before = fs::read(&active).unwrap();

        let invalid_archive = temp.path().join("invalid.lmsbackup");
        archive_with_entries(
            &invalid_archive,
            &master,
            &before,
            &[("nested/not-allowed.pdf", b"bad")],
        );
        assert!(matches!(
            restore(
                &active,
                &master,
                &invalid_archive.to_string_lossy(),
                &documents
            ),
            Err(Error::BackupInvalid)
        ));
        assert_eq!(fs::read(&active).unwrap(), before);
        assert_eq!(fs::read(documents.join("live.pdf")).unwrap(), b"live");
        assert!(!active.with_extension("restore.tmp").exists());
        assert!(!documents.with_extension("restore.tmp").exists());
    }
}
