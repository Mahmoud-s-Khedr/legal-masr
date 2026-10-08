use crate::{db, errors::Error, security, vault_operation};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::{
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

/// Version 1 is sealed with the vault key only, so only its own installation can open it.
/// Version 2 also carries the vault's key envelope (the same password- and recovery-key-
/// sealed copies of the vault key kept beside the database), so a new installation can
/// open it with the password in use when it was made, or with the recovery key.
#[derive(Serialize, Deserialize)]
struct BackupEnvelope {
    version: u8,
    nonce: String,
    ciphertext: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    keyring: Option<security::SecurityFile>,
}

/// What a backup holds, shown before restoring it.
pub struct BackupSummary {
    pub created_at: String,
    pub document_count: usize,
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
        let mut destination = db::create_db(&snapshot_path, master)?;
        let backup = rusqlite::backup::Backup::new(&source, &mut destination)?;
        backup.run_to_completion(64, Duration::from_millis(2), None)?;
        drop(backup);
        drop(destination);
        fs::read(&snapshot_path).map_err(Error::from)
    })();
    let _ = fs::remove_file(&snapshot_path);
    result
}

/// `stamp` names the file in the lawyer's local time (`2026-10-08-1052`); `keyring` makes
/// the backup restorable on another installation (see [`BackupEnvelope`]).
pub fn create(
    db_path: &Path,
    master: &[u8; 32],
    destination: &str,
    documents: &Path,
    stamp: &str,
    keyring: Option<&security::SecurityFile>,
) -> Result<String, Error> {
    if !is_valid_stamp(stamp) {
        return Err(Error::Validation);
    }
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
    let key = zeroize::Zeroizing::new(security::backup_key(master));
    let nonce = security::random_32();
    let cipher =
        XChaCha20Poly1305::new_from_slice(key.as_slice()).map_err(|_| Error::BackupInvalid)?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce[..24]), plaintext.as_ref())
        .map_err(|_| Error::BackupInvalid)?;
    let payload = serde_json::to_vec(&BackupEnvelope {
        version: if keyring.is_some() { 2 } else { 1 },
        nonce: STANDARD.encode(&nonce[..24]),
        ciphertext: STANDARD.encode(ciphertext),
        keyring: keyring.cloned(),
    })?;
    let output = available_name(&destination, stamp);
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

/// `LegalMasr-backup-2026-10-08-1052.lmsbackup`, with `-2`, `-3`… if that name is taken.
fn available_name(destination: &Path, stamp: &str) -> PathBuf {
    let mut candidate = destination.join(format!("LegalMasr-backup-{stamp}.lmsbackup"));
    let mut counter = 2;
    while candidate.exists() || candidate.with_extension("tmp").exists() {
        candidate = destination.join(format!("LegalMasr-backup-{stamp}-{counter}.lmsbackup"));
        counter += 1;
    }
    candidate
}

/// A local date and time as `YYYY-MM-DD-HHMM`.
pub fn is_valid_stamp(stamp: &str) -> bool {
    let bytes = stamp.as_bytes();
    bytes.len() == 15
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            4 | 7 | 10 => *byte == b'-',
            _ => byte.is_ascii_digit(),
        })
}

fn read_envelope(path: &str) -> Result<BackupEnvelope, Error> {
    let payload: BackupEnvelope =
        serde_json::from_slice(&fs::read(path)?).map_err(|_| Error::BackupInvalid)?;
    if !matches!(payload.version, 1 | 2) || (payload.version == 2) != payload.keyring.is_some() {
        return Err(Error::BackupInvalid);
    }
    Ok(payload)
}

/// The key envelope a version 2 backup carries; `None` for a version 1 backup.
pub fn keyring(path: &str) -> Result<Option<security::SecurityFile>, Error> {
    Ok(read_envelope(path)?.keyring)
}

/// Date and document count of a backup that `master` opens and that passes validation.
pub fn summary(path: &str, master: &[u8; 32]) -> Result<BackupSummary, Error> {
    validate(path, master)?;
    let bytes = decrypt(path, master)?;
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|_| Error::BackupInvalid)?;
    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_string(&mut manifest)?;
    let manifest: BackupManifest =
        serde_json::from_str(&manifest).map_err(|_| Error::BackupInvalid)?;
    Ok(BackupSummary {
        created_at: manifest.created_at,
        document_count: manifest.managed_document_count,
    })
}

fn decrypt(path: &str, master: &[u8; 32]) -> Result<Vec<u8>, Error> {
    let payload = read_envelope(path)?;
    let key = zeroize::Zeroizing::new(security::backup_key(master));
    let nonce = STANDARD
        .decode(payload.nonce)
        .map_err(|_| Error::BackupInvalid)?;
    let ciphertext = STANDARD
        .decode(payload.ciphertext)
        .map_err(|_| Error::BackupInvalid)?;
    if nonce.len() != 24 {
        return Err(Error::BackupInvalid);
    }
    XChaCha20Poly1305::new_from_slice(key.as_slice())
        .map_err(|_| Error::BackupInvalid)?
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| Error::BackupInvalid)
}

fn declared_zip_entry_count(bytes: &[u8]) -> Result<usize, Error> {
    const END_OF_CENTRAL_DIRECTORY: [u8; 4] = [0x50, 0x4b, 0x05, 0x06];
    const END_OF_CENTRAL_DIRECTORY_SIZE: usize = 22;
    let offset = bytes
        .windows(END_OF_CENTRAL_DIRECTORY.len())
        .rposition(|window| window == END_OF_CENTRAL_DIRECTORY)
        .ok_or(Error::BackupInvalid)?;
    if offset + END_OF_CENTRAL_DIRECTORY_SIZE > bytes.len() {
        return Err(Error::BackupInvalid);
    }
    let read_u16 = |start: usize| u16::from_le_bytes([bytes[start], bytes[start + 1]]);
    let disk = read_u16(offset + 4);
    let central_directory_disk = read_u16(offset + 6);
    let entries_on_disk = read_u16(offset + 8);
    let total_entries = read_u16(offset + 10);
    let comment_length = read_u16(offset + 20) as usize;
    if disk != 0
        || central_directory_disk != 0
        || entries_on_disk != total_entries
        || offset + END_OF_CENTRAL_DIRECTORY_SIZE + comment_length != bytes.len()
    {
        return Err(Error::BackupInvalid);
    }
    Ok(total_entries as usize)
}

pub fn validate(path: &str, master: &[u8; 32]) -> Result<(), Error> {
    let bytes = decrypt(path, master)?;
    let declared_entry_count = declared_zip_entry_count(&bytes)?;
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|_| Error::BackupInvalid)?;
    if archive.len() != declared_entry_count {
        return Err(Error::BackupInvalid);
    }
    let mut data_entries = BTreeSet::new();
    let mut archive_entries = BTreeSet::new();
    let mut attachment_count = 0usize;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|_| Error::BackupInvalid)?;
        let name = entry.name().to_owned();
        if !archive_entries.insert(name.clone()) || entry.is_dir() {
            return Err(Error::BackupInvalid);
        }
        if name == "database.sqlite" {
            data_entries.insert(name);
        } else if let Some(filename) = name.strip_prefix("attachments/") {
            let path = Path::new(filename);
            if filename.is_empty() || path.components().count() != 1 {
                return Err(Error::BackupInvalid);
            }
            data_entries.insert(name);
            attachment_count += 1;
        } else if name != "manifest.json" && name != "checksums.json" {
            return Err(Error::BackupInvalid);
        }
    }
    if !archive_entries.contains("database.sqlite")
        || !archive_entries.contains("manifest.json")
        || !archive_entries.contains("checksums.json")
    {
        return Err(Error::BackupInvalid);
    }
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
    if manifest.managed_document_count != attachment_count {
        return Err(Error::BackupInvalid);
    }
    let mut checksums_json = String::new();
    archive
        .by_name("checksums.json")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_string(&mut checksums_json)?;
    let checksums: BTreeMap<String, String> =
        serde_json::from_str(&checksums_json).map_err(|_| Error::BackupInvalid)?;
    if checksums.keys().cloned().collect::<BTreeSet<_>>() != data_entries {
        return Err(Error::BackupInvalid);
    }
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
            output.sync_all()?;
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
        vault_operation::sync_file(&staging)?;
        vault_operation::install_restore(active_db, documents_root)?;
        Ok(())
    })();
    if result.is_err() && !vault_operation::pending(active_db.parent().ok_or(Error::Operation)?) {
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
        let connection = db::create_db(path, master).unwrap();
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
        let key = zeroize::Zeroizing::new(security::backup_key(master));
        let ciphertext = XChaCha20Poly1305::new_from_slice(key.as_slice())
            .unwrap()
            .encrypt(XNonce::from_slice(&nonce[..24]), plaintext.as_ref())
            .unwrap();
        let envelope = BackupEnvelope {
            version: 1,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
            keyring: None,
        };
        fs::write(path, serde_json::to_vec(&envelope).unwrap()).unwrap();
    }

    fn archive_with_raw_entries(path: &Path, master: &[u8; 32], entries: &[(&str, &[u8])]) {
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, content) in entries {
            archive
                .start_file(*name, SimpleFileOptions::default())
                .unwrap();
            archive.write_all(content).unwrap();
        }
        let plaintext = archive.finish().unwrap().into_inner();
        let nonce = security::random_32();
        let key = zeroize::Zeroizing::new(security::backup_key(master));
        let ciphertext = XChaCha20Poly1305::new_from_slice(key.as_slice())
            .unwrap()
            .encrypt(XNonce::from_slice(&nonce[..24]), plaintext.as_ref())
            .unwrap();
        let envelope = BackupEnvelope {
            version: 1,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
            keyring: None,
        };
        fs::write(path, serde_json::to_vec(&envelope).unwrap()).unwrap();
    }

    fn duplicate_name_archive(path: &Path, master: &[u8; 32]) {
        let mut archive = Vec::new();
        let mut offsets = Vec::new();
        for (name, contents) in [
            ("database.sqlite", b"first database".as_slice()),
            ("database.sqlite", b"second database".as_slice()),
            ("manifest.json", b"{}".as_slice()),
            ("checksums.json", b"{}".as_slice()),
        ] {
            offsets.push(archive.len() as u32);
            archive.extend_from_slice(&0x0403_4b50_u32.to_le_bytes());
            archive.extend_from_slice(&20_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u32.to_le_bytes());
            archive.extend_from_slice(&(contents.len() as u32).to_le_bytes());
            archive.extend_from_slice(&(contents.len() as u32).to_le_bytes());
            archive.extend_from_slice(&(name.len() as u16).to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(name.as_bytes());
            archive.extend_from_slice(contents);
        }
        let central_start = archive.len() as u32;
        for ((name, contents), offset) in [
            ("database.sqlite", b"first database".as_slice()),
            ("database.sqlite", b"second database".as_slice()),
            ("manifest.json", b"{}".as_slice()),
            ("checksums.json", b"{}".as_slice()),
        ]
        .into_iter()
        .zip(offsets)
        {
            archive.extend_from_slice(&0x0201_4b50_u32.to_le_bytes());
            archive.extend_from_slice(&20_u16.to_le_bytes());
            archive.extend_from_slice(&20_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u32.to_le_bytes());
            archive.extend_from_slice(&(contents.len() as u32).to_le_bytes());
            archive.extend_from_slice(&(contents.len() as u32).to_le_bytes());
            archive.extend_from_slice(&(name.len() as u16).to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u16.to_le_bytes());
            archive.extend_from_slice(&0_u32.to_le_bytes());
            archive.extend_from_slice(&offset.to_le_bytes());
            archive.extend_from_slice(name.as_bytes());
        }
        let central_size = archive.len() as u32 - central_start;
        archive.extend_from_slice(&0x0605_4b50_u32.to_le_bytes());
        archive.extend_from_slice(&0_u16.to_le_bytes());
        archive.extend_from_slice(&0_u16.to_le_bytes());
        archive.extend_from_slice(&4_u16.to_le_bytes());
        archive.extend_from_slice(&4_u16.to_le_bytes());
        archive.extend_from_slice(&central_size.to_le_bytes());
        archive.extend_from_slice(&central_start.to_le_bytes());
        archive.extend_from_slice(&0_u16.to_le_bytes());

        let nonce = security::random_32();
        let key = zeroize::Zeroizing::new(security::backup_key(master));
        let ciphertext = XChaCha20Poly1305::new_from_slice(key.as_slice())
            .unwrap()
            .encrypt(XNonce::from_slice(&nonce[..24]), archive.as_ref())
            .unwrap();
        let envelope = BackupEnvelope {
            version: 1,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
            keyring: None,
        };
        fs::write(path, serde_json::to_vec(&envelope).unwrap()).unwrap();
    }

    fn manifest_with_document_count(document_count: usize) -> Vec<u8> {
        serde_json::to_vec(&BackupManifest {
            format_version: 1,
            application_version: "test".into(),
            schema_version: db::latest_schema_version(),
            created_at: db::now(),
            database_encrypted: true,
            managed_document_count: document_count,
        })
        .unwrap()
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
            "2026-10-08-1052",
            None,
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
        drop(connection);
        let snapshots = temp.path().join("EmergencySnapshots");
        let snapshot = fs::read_dir(&snapshots)
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(
            fs::read(snapshot.join("attachments/old.pdf")).unwrap(),
            b"old"
        );
        let old = db::open_db(&snapshot.join("database.sqlite"), &master).unwrap();
        let previous: String = old
            .query_row("SELECT internal_number FROM clients", [], |row| row.get(0))
            .unwrap();
        assert_eq!(previous, "CL-OLD");
        drop(old);
        restore(&active, &master, &backup, &active_attachments).unwrap();
        assert_eq!(fs::read_dir(snapshots).unwrap().count(), 2);
        assert_eq!(
            fs::read(snapshot.join("attachments/old.pdf")).unwrap(),
            b"old"
        );
    }

    #[test]
    fn backups_are_named_by_local_time_and_carry_their_key_envelope() {
        let temp = tempfile::tempdir().unwrap();
        let master = security::random_32();
        let source = temp.path().join("source.sqlite");
        let attachments = temp.path().join("attachments");
        migrated_database(&source, &master, "CL-NAMED");
        fs::create_dir(&attachments).unwrap();
        fs::write(attachments.join("scan.pdf"), b"scan").unwrap();
        let destination = temp.path().join("Backups");
        let destination_text = destination.to_string_lossy();
        let keyring = security::SecurityFile {
            version: 1,
            salt: STANDARD.encode([1_u8; 16]),
            memory_kib: 8,
            iterations: 1,
            parallelism: 1,
            password_envelope: security::wrap(&[2_u8; 32], &master).unwrap(),
            recovery_envelope: security::wrap(&[3_u8; 32], &master).unwrap(),
        };

        for stamp in ["2026-10-08 10:52", "2026-10-8-1052", "", "٢٠٢٦-10-08-1052"] {
            assert!(matches!(
                create(
                    &source,
                    &master,
                    &destination_text,
                    &attachments,
                    stamp,
                    None
                ),
                Err(Error::Validation)
            ));
        }
        let first = create(
            &source,
            &master,
            &destination_text,
            &attachments,
            "2026-10-08-1052",
            Some(&keyring),
        )
        .unwrap();
        let second = create(
            &source,
            &master,
            &destination_text,
            &attachments,
            "2026-10-08-1052",
            None,
        )
        .unwrap();
        assert!(first.ends_with("LegalMasr-backup-2026-10-08-1052.lmsbackup"));
        assert!(second.ends_with("LegalMasr-backup-2026-10-08-1052-2.lmsbackup"));

        let carried = keyring_of(&first);
        assert!(carried.recovery_envelope == keyring.recovery_envelope);
        assert!(carried.password_envelope == keyring.password_envelope);
        assert!(super::keyring(&second).unwrap().is_none());
        assert_eq!(summary(&first, &master).unwrap().document_count, 1);
        assert!(matches!(
            summary(&first, &security::random_32()),
            Err(Error::BackupInvalid)
        ));

        // A version that disagrees with the presence of the key envelope is refused.
        let mut envelope: BackupEnvelope =
            serde_json::from_slice(&fs::read(&first).unwrap()).unwrap();
        envelope.version = 1;
        fs::write(&first, serde_json::to_vec(&envelope).unwrap()).unwrap();
        assert!(matches!(super::keyring(&first), Err(Error::BackupInvalid)));
        let mut envelope: BackupEnvelope =
            serde_json::from_slice(&fs::read(&second).unwrap()).unwrap();
        envelope.version = 2;
        fs::write(&second, serde_json::to_vec(&envelope).unwrap()).unwrap();
        assert!(matches!(
            validate(&second, &master),
            Err(Error::BackupInvalid)
        ));
    }

    fn keyring_of(path: &str) -> security::SecurityFile {
        super::keyring(path).unwrap().expect("a version 2 backup")
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

    #[test]
    fn malformed_backup_nonce_is_refused_without_panicking() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("bad-nonce.lmsbackup");
        let payload = BackupEnvelope {
            version: 1,
            nonce: STANDARD.encode([0_u8; 23]),
            ciphertext: STANDARD.encode([0_u8; 48]),
            keyring: None,
        };
        fs::write(&path, serde_json::to_vec(&payload).unwrap()).unwrap();
        assert!(matches!(
            validate(&path.to_string_lossy(), &security::random_32()),
            Err(Error::BackupInvalid)
        ));
    }

    #[test]
    fn validation_rejects_incomplete_or_ambiguous_archive_inventory() {
        let temp = tempfile::tempdir().unwrap();
        let master = security::random_32();
        let database = b"encrypted database";
        let attachment = b"managed attachment";
        let manifest = manifest_with_document_count(1);

        let missing_database_checksum = temp.path().join("missing-database-checksum.lmsbackup");
        let checksums = serde_json::to_vec(&BTreeMap::from([(
            "attachments/file.pdf".to_owned(),
            checksum(attachment),
        )]))
        .unwrap();
        archive_with_raw_entries(
            &missing_database_checksum,
            &master,
            &[
                ("database.sqlite", database),
                ("attachments/file.pdf", attachment),
                ("manifest.json", &manifest),
                ("checksums.json", &checksums),
            ],
        );
        assert!(matches!(
            validate(&missing_database_checksum.to_string_lossy(), &master),
            Err(Error::BackupInvalid)
        ));

        let unlisted_attachment = temp.path().join("unlisted-attachment.lmsbackup");
        let checksums = serde_json::to_vec(&BTreeMap::from([(
            "database.sqlite".to_owned(),
            checksum(database),
        )]))
        .unwrap();
        archive_with_raw_entries(
            &unlisted_attachment,
            &master,
            &[
                ("database.sqlite", database),
                ("attachments/file.pdf", attachment),
                ("manifest.json", &manifest),
                ("checksums.json", &checksums),
            ],
        );
        assert!(matches!(
            validate(&unlisted_attachment.to_string_lossy(), &master),
            Err(Error::BackupInvalid)
        ));

        let duplicate_database = temp.path().join("duplicate-database.lmsbackup");
        duplicate_name_archive(&duplicate_database, &master);
        let duplicate_result = validate(&duplicate_database.to_string_lossy(), &master);
        assert!(
            matches!(duplicate_result, Err(Error::BackupInvalid)),
            "unexpected duplicate-archive result: {duplicate_result:?}"
        );
    }
}
