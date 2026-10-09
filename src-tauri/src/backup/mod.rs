use crate::{
    db,
    errors::Error,
    security::{self, SecurityFile},
    vault_operation,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
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
use zeroize::Zeroizing;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

/// First format: the archive key derives from the vault master key only, so the
/// file opens only where that key already exists.
const FORMAT_V1: u8 = 1;
/// Current format: the header carries a copy of the vault's security envelopes,
/// so the password or the recovery key recovers the master key anywhere.
const FORMAT_V2: u8 = 2;
const NONCE_BYTES: usize = 24;
// A backup header is untrusted input. Bound the key-derivation cost it can
// request before any derivation starts; the app itself writes 19 MiB / 2 / 1.
const MAX_KDF_MEMORY_KIB: u32 = 262_144;
const MAX_KDF_ITERATIONS: u32 = 10;
const MAX_KDF_PARALLELISM: u32 = 8;

#[derive(Serialize, Deserialize)]
struct BackupEnvelope {
    version: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    security: Option<SecurityFile>,
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

/// How a person proves they may open a v2 backup that was not made by the
/// installation they are using. Secrets are borrowed from zeroized command input.
pub enum Credential<'a> {
    Password(&'a str),
    RecoveryKey(&'a str),
}

struct Opened {
    version: u8,
    master: Zeroizing<[u8; 32]>,
    plaintext: Vec<u8>,
    security: Option<SecurityFile>,
}

fn checksum(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn same_key(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a.iter()
        .zip(b)
        .fold(0_u8, |difference, (x, y)| difference | (x ^ y))
        == 0
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

/// Authenticated data for a v2 body: every header field that decides how the
/// key is recovered. It is built from parsed values, so JSON whitespace and key
/// order do not matter, while any changed field makes decryption fail.
fn header_aad(version: u8, security: &SecurityFile, nonce: &str) -> Vec<u8> {
    let mut aad = b"LegalMasterSolo/backup/header\0".to_vec();
    aad.push(version);
    let fields = [
        security.version.to_string(),
        security.salt.clone(),
        security.memory_kib.to_string(),
        security.iterations.to_string(),
        security.parallelism.to_string(),
        security.password_envelope.nonce.clone(),
        security.password_envelope.ciphertext.clone(),
        security.recovery_envelope.nonce.clone(),
        security.recovery_envelope.ciphertext.clone(),
        nonce.to_owned(),
    ];
    for field in fields {
        aad.extend_from_slice(&(field.len() as u32).to_le_bytes());
        aad.extend_from_slice(field.as_bytes());
    }
    aad
}

pub fn create(
    db_path: &Path,
    master: &[u8; 32],
    security_file: &SecurityFile,
    destination: &str,
    documents: &Path,
) -> Result<String, Error> {
    let destination = PathBuf::from(destination);
    fs::create_dir_all(&destination)?;
    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    let database = consistent_database_snapshot(db_path, master)?;
    let opened = db::open_db(db_path, master)?;
    let manifest = BackupManifest {
        format_version: FORMAT_V2,
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
    let key = Zeroizing::new(security::backup_key(master));
    let nonce = security::random_32();
    let nonce_text = STANDARD.encode(&nonce[..NONCE_BYTES]);
    let aad = header_aad(FORMAT_V2, security_file, &nonce_text);
    let cipher =
        XChaCha20Poly1305::new_from_slice(key.as_slice()).map_err(|_| Error::BackupInvalid)?;
    let ciphertext = cipher
        .encrypt(
            XNonce::from_slice(&nonce[..NONCE_BYTES]),
            Payload {
                msg: plaintext.as_ref(),
                aad: &aad,
            },
        )
        .map_err(|_| Error::BackupInvalid)?;
    let payload = serde_json::to_vec(&BackupEnvelope {
        version: FORMAT_V2,
        security: Some(security_file.clone()),
        nonce: nonce_text,
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
    if let Err(error) = validate(&output.to_string_lossy(), Some(master), None) {
        let _ = fs::remove_file(&output);
        return Err(error);
    }
    Ok(output.to_string_lossy().into_owned())
}

/// Reads and classifies the file header without any key. Anything that is not a
/// well-formed Legal Masr envelope is `BackupInvalid`; an envelope written by a
/// newer format is `BackupNewerVersion`. An unreadable file stays an I/O error.
fn read_envelope(path: &str) -> Result<BackupEnvelope, Error> {
    let value: serde_json::Value =
        serde_json::from_slice(&fs::read(path)?).map_err(|_| Error::BackupInvalid)?;
    match value.get("version").and_then(serde_json::Value::as_u64) {
        Some(version) if version > u64::from(FORMAT_V2) => return Err(Error::BackupNewerVersion),
        Some(version) if version >= 1 => {}
        _ => return Err(Error::BackupInvalid),
    }
    let envelope: BackupEnvelope =
        serde_json::from_value(value).map_err(|_| Error::BackupInvalid)?;
    // A v1 file never carries key material and a v2 file always does; anything
    // else was rewritten and must not be trusted as either.
    if (envelope.version == FORMAT_V1) == envelope.security.is_some() {
        return Err(Error::BackupInvalid);
    }
    Ok(envelope)
}

/// The format version of the selected file, for the picker step. Does not
/// authenticate anything.
pub fn inspect(path: &str) -> Result<u8, Error> {
    read_envelope(path).map(|envelope| envelope.version)
}

fn bounded_kdf(security: &SecurityFile) -> Result<(), Error> {
    let valid = (1..=MAX_KDF_ITERATIONS).contains(&security.iterations)
        && (1..=MAX_KDF_PARALLELISM).contains(&security.parallelism)
        && security.memory_kib >= 8 * security.parallelism
        && security.memory_kib <= MAX_KDF_MEMORY_KIB;
    if valid {
        Ok(())
    } else {
        Err(Error::BackupInvalid)
    }
}

fn master_from_credential(
    security: &SecurityFile,
    credential: Credential<'_>,
) -> Result<Zeroizing<[u8; 32]>, Error> {
    match credential {
        Credential::Password(password) => {
            let salt = STANDARD
                .decode(&security.salt)
                .map_err(|_| Error::BackupInvalid)?;
            let derived = Zeroizing::new(security::derive_password(
                password,
                &salt,
                security.memory_kib,
                security.iterations,
                security.parallelism,
            )?);
            security::unwrap(&derived, &security.password_envelope)
                .map(Zeroizing::new)
                .map_err(|_| Error::InvalidPassword)
        }
        Credential::RecoveryKey(key) => {
            let material = Zeroizing::new(security::recovery_key_material(key));
            security::unwrap(&material, &security.recovery_envelope)
                .map(Zeroizing::new)
                .map_err(|_| Error::InvalidRecovery)
        }
    }
}

fn decrypt_body(
    key: &[u8; 32],
    nonce: &[u8],
    ciphertext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, ()> {
    XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| ())?
        .decrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: ciphertext,
                aad,
            },
        )
        .map_err(|_| ())
}

/// Opens the envelope. `credential` recovers the master key from a v2 header;
/// without one the active vault's master key is used (same installation, and
/// the only way a v1 file can be opened).
///
/// Failure classes are kept apart wherever the cryptography allows it: a
/// credential that does not unwrap the master key is `InvalidPassword` /
/// `InvalidRecovery`; once it does, a failing body is damage or tampering
/// (`BackupInvalid`). Without a credential a wrong key and damage look the same
/// to the cipher, so both are `BackupKeyMismatch`.
fn open(
    path: &str,
    active_master: Option<&[u8; 32]>,
    credential: Option<Credential<'_>>,
) -> Result<Opened, Error> {
    let envelope = read_envelope(path)?;
    let nonce = STANDARD
        .decode(&envelope.nonce)
        .map_err(|_| Error::BackupInvalid)?;
    let ciphertext = STANDARD
        .decode(&envelope.ciphertext)
        .map_err(|_| Error::BackupInvalid)?;
    if nonce.len() != NONCE_BYTES {
        return Err(Error::BackupInvalid);
    }
    let used_credential = envelope.security.is_some() && credential.is_some();
    let (master, aad) = match (&envelope.security, credential) {
        (None, _) => (
            Zeroizing::new(*active_master.ok_or(Error::BackupKeyMismatch)?),
            Vec::new(),
        ),
        (Some(security), credential) => {
            bounded_kdf(security)?;
            let aad = header_aad(envelope.version, security, &envelope.nonce);
            let master = match credential {
                Some(credential) => master_from_credential(security, credential)?,
                None => Zeroizing::new(*active_master.ok_or(Error::BackupKeyMismatch)?),
            };
            (master, aad)
        }
    };
    let key = Zeroizing::new(security::backup_key(&master));
    let plaintext = decrypt_body(&key, &nonce, &ciphertext, &aad).map_err(|()| {
        if used_credential {
            Error::BackupInvalid
        } else {
            Error::BackupKeyMismatch
        }
    })?;
    Ok(Opened {
        version: envelope.version,
        master,
        plaintext,
        security: envelope.security,
    })
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

/// Checks the authenticated archive: exact inventory, manifest, checksums.
fn validate_archive(plaintext: &[u8], version: u8) -> Result<(), Error> {
    let declared_entry_count = declared_zip_entry_count(plaintext)?;
    let mut archive = ZipArchive::new(Cursor::new(plaintext)).map_err(|_| Error::BackupInvalid)?;
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
    if manifest.format_version != version
        || !manifest.database_encrypted
        || manifest.schema_version <= 0
    {
        return Err(Error::BackupInvalid);
    }
    if manifest.schema_version > db::latest_schema_version() {
        return Err(Error::BackupNewerVersion);
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

pub fn validate(
    path: &str,
    active_master: Option<&[u8; 32]>,
    credential: Option<Credential<'_>>,
) -> Result<(), Error> {
    let opened = open(path, active_master, credential)?;
    validate_archive(&opened.plaintext, opened.version)
}

fn remove_restore_staging(active_db: &Path, documents_root: &Path) {
    let _ = fs::remove_dir_all(documents_root.with_extension("restore.tmp"));
    let _ = fs::remove_file(active_db.with_extension("restore.tmp"));
    if let Some(root) = active_db.parent() {
        let _ = fs::remove_file(root.join("security.restore.tmp"));
    }
}

/// Replaces the vault with the archive's contents.
///
/// `active_master` is the unlocked vault's key, if any. Without `credential` the
/// archive must open with that key (same installation). With one, a v2 archive
/// is opened from its own header; when its master key differs from the active
/// one (or there is no active vault) the restored vault adopts the archive's
/// password and recovery envelopes, otherwise the current `security.json` stays.
///
/// Everything is authenticated, validated and staged before any live file is
/// touched, so a failure leaves the destination as it was.
pub fn restore(
    active_db: &Path,
    documents_root: &Path,
    path: &str,
    active_master: Option<&[u8; 32]>,
    credential: Option<Credential<'_>>,
) -> Result<(), Error> {
    let root = active_db.parent().ok_or(Error::Operation)?;
    if vault_operation::pending(root) {
        return Err(Error::VaultInterrupted);
    }
    // Staging with no journal is the remains of an attempt that never reached
    // the point of replacing anything.
    remove_restore_staging(active_db, documents_root);
    let opened = open(path, active_master, credential)?;
    validate_archive(&opened.plaintext, opened.version)?;
    let adopted_security = match (&opened.security, active_master) {
        (Some(_), Some(active)) if same_key(active, &opened.master) => None,
        (security, _) => security.clone(),
    };
    let mut archive = ZipArchive::new(Cursor::new(opened.plaintext.as_slice()))?;
    let mut db_bytes = Vec::new();
    archive
        .by_name("database.sqlite")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_end(&mut db_bytes)?;
    let documents_staging = documents_root.with_extension("restore.tmp");
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
        let restored = db::open_db(&staging, &opened.master).map_err(|error| match error {
            Error::VaultNewerSchema => Error::BackupNewerVersion,
            _ => Error::BackupInvalid,
        })?;
        if db::schema_version(&restored) > db::latest_schema_version() {
            return Err(Error::BackupNewerVersion);
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
        if let Some(security) = &adopted_security {
            let staged = root.join("security.restore.tmp");
            fs::write(&staged, serde_json::to_vec_pretty(security)?)?;
            vault_operation::sync_file(&staged)?;
        }
        vault_operation::install_restore(active_db, documents_root, adopted_security.is_some())?;
        Ok(())
    })();
    if result.is_err() && !vault_operation::pending(root) {
        remove_restore_staging(active_db, documents_root);
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
            security: None,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
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
            security: None,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
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
            security: None,
            nonce: STANDARD.encode(&nonce[..24]),
            ciphertext: STANDARD.encode(ciphertext),
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
        let (security_file, _) = vault_security_for(&master, "a secure local password", RECOVERY);
        let backup = create(
            &source,
            &master,
            &security_file,
            &destination.to_string_lossy(),
            &source_attachments,
        )
        .unwrap();
        validate(&backup, Some(&master), None).unwrap();
        let plaintext = open(&backup, Some(&master), None).unwrap().plaintext;
        let mut archive = ZipArchive::new(Cursor::new(plaintext)).unwrap();
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
        restore(&active, &active_attachments, &backup, Some(&master), None).unwrap();

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
        restore(&active, &active_attachments, &backup, Some(&master), None).unwrap();
        assert_eq!(fs::read_dir(snapshots).unwrap().count(), 2);
        assert_eq!(
            fs::read(snapshot.join("attachments/old.pdf")).unwrap(),
            b"old"
        );
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
                &documents,
                &invalid_archive.to_string_lossy(),
                Some(&master),
                None
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
            security: None,
            nonce: STANDARD.encode([0_u8; 23]),
            ciphertext: STANDARD.encode([0_u8; 48]),
        };
        fs::write(&path, serde_json::to_vec(&payload).unwrap()).unwrap();
        assert!(matches!(
            validate(&path.to_string_lossy(), Some(&security::random_32()), None),
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
            validate(
                &missing_database_checksum.to_string_lossy(),
                Some(&master),
                None
            ),
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
            validate(&unlisted_attachment.to_string_lossy(), Some(&master), None),
            Err(Error::BackupInvalid)
        ));

        let duplicate_database = temp.path().join("duplicate-database.lmsbackup");
        duplicate_name_archive(&duplicate_database, &master);
        let duplicate_result = validate(&duplicate_database.to_string_lossy(), Some(&master), None);
        assert!(
            matches!(duplicate_result, Err(Error::BackupInvalid)),
            "unexpected duplicate-archive result: {duplicate_result:?}"
        );
    }

    const RECOVERY: &str = "3fa9c0de12b4778a5e61d0c2f9b83a4417de56c0b19a2e8f40d37c61a5b9e208";
    const PASSWORD: &str = "a secure local password";

    /// The `security.json` content a vault with this master key would hold.
    fn vault_security_for(
        master: &[u8; 32],
        password: &str,
        recovery_key: &str,
    ) -> (SecurityFile, [u8; 32]) {
        let salt = security::random_32();
        let password_key = security::derive_password(password, &salt, 19_456, 2, 1).unwrap();
        (
            SecurityFile {
                version: 1,
                salt: STANDARD.encode(salt),
                memory_kib: 19_456,
                iterations: 2,
                parallelism: 1,
                password_envelope: security::wrap(&password_key, master).unwrap(),
                recovery_envelope: security::wrap(
                    &security::recovery_key_material(recovery_key),
                    master,
                )
                .unwrap(),
            },
            *master,
        )
    }

    /// A source installation with a client, a binary attachment and one v2 backup.
    struct Source {
        _dir: tempfile::TempDir,
        master: [u8; 32],
        security: SecurityFile,
        backup: String,
        attachment: Vec<u8>,
    }

    fn source_with_backup() -> Source {
        let dir = tempfile::tempdir().unwrap();
        let master = security::random_32();
        let db_path = dir.path().join("legalmaster.sqlite");
        let attachments = dir.path().join("attachments");
        migrated_database(&db_path, &master, "CL-SOURCE");
        fs::create_dir(&attachments).unwrap();
        let attachment: Vec<u8> = (0..=255u8).cycle().take(4096).collect();
        fs::write(attachments.join("scan.bin"), &attachment).unwrap();
        let (security, _) = vault_security_for(&master, PASSWORD, RECOVERY);
        let backup = create(
            &db_path,
            &master,
            &security,
            &dir.path().join("Backups").to_string_lossy(),
            &attachments,
        )
        .unwrap();
        Source {
            _dir: dir,
            master,
            security,
            backup,
            attachment,
        }
    }

    /// Names and contents of everything under `root`, to prove nothing changed.
    fn tree_snapshot(root: &Path) -> BTreeMap<String, Vec<u8>> {
        fn walk(base: &Path, dir: &Path, out: &mut BTreeMap<String, Vec<u8>>) {
            for entry in fs::read_dir(dir).unwrap() {
                let path = entry.unwrap().path();
                let name = path
                    .strip_prefix(base)
                    .unwrap()
                    .to_string_lossy()
                    .into_owned();
                if path.is_dir() {
                    out.insert(format!("{name}/"), Vec::new());
                    walk(base, &path, out);
                } else {
                    out.insert(name, fs::read(&path).unwrap());
                }
            }
        }
        let mut out = BTreeMap::new();
        walk(root, root, &mut out);
        out
    }

    fn client_numbers(db_path: &Path, master: &[u8; 32]) -> Vec<String> {
        let connection = db::open_db(db_path, master).unwrap();
        let mut statement = connection
            .prepare("SELECT internal_number FROM clients ORDER BY internal_number")
            .unwrap();
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .map(Result::unwrap)
            .collect();
        rows
    }

    /// What `unlock` does with a restored installation's `security.json`.
    fn unlock_with_password(root: &Path, password: &str) -> Result<[u8; 32], Error> {
        let file = security::read_security(&root.join("security.json"))?;
        let salt = STANDARD.decode(&file.salt).unwrap();
        let key = security::derive_password(
            password,
            &salt,
            file.memory_kib,
            file.iterations,
            file.parallelism,
        )?;
        security::unwrap(&key, &file.password_envelope)
    }

    fn rewrite_envelope(path: &str, change: impl FnOnce(&mut BackupEnvelope)) -> String {
        let mut envelope: BackupEnvelope =
            serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        change(&mut envelope);
        let altered = format!("{path}.altered");
        fs::write(&altered, serde_json::to_vec(&envelope).unwrap()).unwrap();
        altered
    }

    fn flip_first_char(text: &str) -> String {
        let mut chars: Vec<char> = text.chars().collect();
        chars[0] = if chars[0] == 'A' { 'B' } else { 'A' };
        chars.into_iter().collect()
    }

    #[test]
    fn a_v2_backup_restores_into_an_empty_installation_with_the_original_password() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let root = destination.path();
        let active = root.join("legalmaster.sqlite");
        let attachments = root.join("attachments");

        restore(
            &active,
            &attachments,
            &source.backup,
            None,
            Some(Credential::Password(PASSWORD)),
        )
        .unwrap();

        assert_eq!(client_numbers(&active, &source.master), ["CL-SOURCE"]);
        assert_eq!(
            fs::read(attachments.join("scan.bin")).unwrap(),
            source.attachment
        );
        // The restored installation unlocks with the original password and holds
        // the master key the database is encrypted with.
        let unlocked = unlock_with_password(root, PASSWORD).unwrap();
        assert_eq!(unlocked, source.master);
        assert!(db::open_db(&active, &unlocked).is_ok());
        assert!(root.join("Backups").is_dir());
        // Nothing existed, so nothing is preserved and nothing is left staged.
        assert!(!root.join("EmergencySnapshots").exists());
        assert!(!vault_operation::pending(root));
        for leftover in [
            "legalmaster.restore.tmp",
            "security.restore.tmp",
            "attachments.restore.tmp",
        ] {
            assert!(!root.join(leftover).exists(), "{leftover}");
        }
    }

    #[test]
    fn a_v2_backup_restores_with_the_recovery_key_in_any_copied_form() {
        let source = source_with_backup();
        for typed in [
            RECOVERY.to_owned(),
            RECOVERY.to_uppercase(),
            format!("{}-{}", &RECOVERY[..32], &RECOVERY[32..]),
        ] {
            let destination = tempfile::tempdir().unwrap();
            let active = destination.path().join("legalmaster.sqlite");
            restore(
                &active,
                &destination.path().join("attachments"),
                &source.backup,
                None,
                Some(Credential::RecoveryKey(&typed)),
            )
            .unwrap();
            assert_eq!(client_numbers(&active, &source.master), ["CL-SOURCE"]);
            // The recovery key does not set a password; the backup's password still works.
            assert_eq!(
                unlock_with_password(destination.path(), PASSWORD).unwrap(),
                source.master
            );
        }
    }

    #[test]
    fn a_wrong_password_or_recovery_key_is_named_and_leaves_the_destination_untouched() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        fs::write(destination.path().join("note.txt"), b"existing").unwrap();
        let before = tree_snapshot(destination.path());
        let active = destination.path().join("legalmaster.sqlite");
        let attachments = destination.path().join("attachments");

        let wrong_password = restore(
            &active,
            &attachments,
            &source.backup,
            None,
            Some(Credential::Password("a different local password")),
        );
        assert!(matches!(wrong_password, Err(Error::InvalidPassword)));
        let mut wrong_key = RECOVERY.to_owned();
        wrong_key.replace_range(0..1, "4");
        let wrong_recovery = restore(
            &active,
            &attachments,
            &source.backup,
            None,
            Some(Credential::RecoveryKey(&wrong_key)),
        );
        assert!(matches!(wrong_recovery, Err(Error::InvalidRecovery)));
        assert_eq!(tree_snapshot(destination.path()), before);
        assert_eq!(Error::InvalidPassword.code(), "INVALID_PASSWORD");
        assert_eq!(Error::InvalidRecovery.code(), "RECOVERY_KEY_INVALID");
    }

    #[test]
    fn every_altered_header_field_or_the_body_is_refused_as_damage_and_changes_nothing() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let before = tree_snapshot(destination.path());
        let active = destination.path().join("legalmaster.sqlite");
        let attachments = destination.path().join("attachments");
        type Edit = fn(&mut BackupEnvelope);
        let edits: [(&str, Edit); 6] = [
            ("body", |e| e.ciphertext = flip_first_char(&e.ciphertext)),
            ("body nonce", |e| {
                let mut nonce = STANDARD.decode(&e.nonce).unwrap();
                nonce[0] ^= 1;
                e.nonce = STANDARD.encode(nonce);
            }),
            ("security version", |e| {
                e.security.as_mut().unwrap().version = 2
            }),
            ("recovery envelope", |e| {
                let envelope = &mut e.security.as_mut().unwrap().recovery_envelope;
                envelope.ciphertext = flip_first_char(&envelope.ciphertext);
            }),
            ("recovery nonce", |e| {
                let envelope = &mut e.security.as_mut().unwrap().recovery_envelope;
                envelope.nonce = flip_first_char(&envelope.nonce);
            }),
            ("a swapped-in header", |e| {
                let other = vault_security_for(&security::random_32(), PASSWORD, RECOVERY).0;
                e.security = Some(SecurityFile {
                    salt: other.salt.clone(),
                    ..other
                });
            }),
        ];
        for (name, edit) in edits {
            let altered = rewrite_envelope(&source.backup, edit);
            let result = restore(
                &active,
                &attachments,
                &altered,
                None,
                Some(Credential::Password(PASSWORD)),
            );
            // A swapped header still unwraps (to another master key), so the body
            // fails authentication like every other edit.
            assert!(
                matches!(result, Err(Error::BackupInvalid)),
                "{name}: {result:?}"
            );
            assert_eq!(tree_snapshot(destination.path()), before, "{name}");
        }
        // Damage to the password envelope itself cannot be told from a wrong password.
        let altered = rewrite_envelope(&source.backup, |e| {
            let envelope = &mut e.security.as_mut().unwrap().password_envelope;
            envelope.ciphertext = flip_first_char(&envelope.ciphertext);
        });
        assert!(matches!(
            restore(
                &active,
                &attachments,
                &altered,
                None,
                Some(Credential::Password(PASSWORD))
            ),
            Err(Error::InvalidPassword)
        ));
        assert_eq!(tree_snapshot(destination.path()), before);
    }

    #[test]
    fn truncated_garbage_and_non_backup_files_are_backup_corrupted() {
        let source = source_with_backup();
        let valid = fs::read(&source.backup).unwrap();
        let directory = tempfile::tempdir().unwrap();
        let destination = tempfile::tempdir().unwrap();
        let before = tree_snapshot(destination.path());
        let active = destination.path().join("legalmaster.sqlite");
        let attachments = destination.path().join("attachments");
        let cases: Vec<(&str, Vec<u8>)> = vec![
            ("truncated in half", valid[..valid.len() / 2].to_vec()),
            ("truncated to a few bytes", valid[..8].to_vec()),
            ("empty", Vec::new()),
            ("plain text", b"fictional corrupt archive".to_vec()),
            ("random bytes", security::random_32().to_vec()),
            (
                "json object without a version",
                br#"{"nonce":"","ciphertext":""}"#.to_vec(),
            ),
            ("json array", b"[]".to_vec()),
            (
                "version zero",
                br#"{"version":0,"nonce":"","ciphertext":""}"#.to_vec(),
            ),
            (
                "bad base64",
                br#"{"version":1,"nonce":"!!","ciphertext":"!!"}"#.to_vec(),
            ),
        ];
        for (name, bytes) in cases {
            let path = directory.path().join("case.lmsbackup");
            fs::write(&path, &bytes).unwrap();
            let path = path.to_string_lossy().into_owned();
            for credential in [None, Some(Credential::Password(PASSWORD))] {
                let result = restore(
                    &active,
                    &attachments,
                    &path,
                    Some(&source.master),
                    credential,
                );
                assert!(
                    matches!(result, Err(Error::BackupInvalid)),
                    "{name}: {result:?}"
                );
            }
            assert!(matches!(
                validate(&path, Some(&source.master), None),
                Err(Error::BackupInvalid)
            ));
            // The header check does not decode the cipher fields, so only a damaged
            // header fails here; the cipher fields are checked when the file is opened.
            if name != "bad base64" {
                assert!(
                    matches!(inspect(&path), Err(Error::BackupInvalid)),
                    "{name}"
                );
            }
        }
        assert_eq!(tree_snapshot(destination.path()), before);
        assert_eq!(Error::BackupInvalid.code(), "BACKUP_CORRUPTED");
    }

    #[test]
    fn a_missing_file_is_an_io_failure_not_a_damaged_backup() {
        let missing = tempfile::tempdir().unwrap().path().join("gone.lmsbackup");
        let result = validate(
            &missing.to_string_lossy(),
            Some(&security::random_32()),
            None,
        );
        assert!(matches!(result, Err(Error::Io(_))), "{result:?}");
    }

    #[test]
    fn a_newer_format_or_schema_is_refused_before_anything_is_staged() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let before = tree_snapshot(destination.path());
        let active = destination.path().join("legalmaster.sqlite");
        let attachments = destination.path().join("attachments");

        let future_format = rewrite_envelope(&source.backup, |e| e.version = 3);
        assert!(matches!(
            restore(
                &active,
                &attachments,
                &future_format,
                None,
                Some(Credential::Password(PASSWORD))
            ),
            Err(Error::BackupNewerVersion)
        ));
        assert!(matches!(
            inspect(&future_format),
            Err(Error::BackupNewerVersion)
        ));

        // A manifest that declares a schema this build does not know.
        let future_manifest = destination.path().join("future-manifest.lmsbackup");
        let (security_file, master) =
            vault_security_for(&security::random_32(), PASSWORD, RECOVERY);
        let database = b"encrypted database";
        let checksums = serde_json::to_vec(&BTreeMap::from([(
            "database.sqlite".to_owned(),
            checksum(database),
        )]))
        .unwrap();
        let manifest = serde_json::to_vec(&BackupManifest {
            format_version: FORMAT_V2,
            application_version: "future".into(),
            schema_version: db::latest_schema_version() + 1,
            created_at: db::now(),
            database_encrypted: true,
            managed_document_count: 0,
        })
        .unwrap();
        v2_archive_with_raw_entries(
            &future_manifest,
            &master,
            &security_file,
            &[
                ("database.sqlite", database),
                ("manifest.json", &manifest),
                ("checksums.json", &checksums),
            ],
        );
        let before_with_file = tree_snapshot(destination.path());
        assert!(matches!(
            restore(
                &active,
                &attachments,
                &future_manifest.to_string_lossy(),
                None,
                Some(Credential::Password(PASSWORD))
            ),
            Err(Error::BackupNewerVersion)
        ));
        assert_eq!(tree_snapshot(destination.path()), before_with_file);

        // A database that is newer than its manifest admits.
        let future_database = destination.path().join("future-database.lmsbackup");
        let database_path = destination.path().join("future.sqlite");
        migrated_database(&database_path, &master, "CL-FUTURE");
        db::open_db(&database_path, &master)
            .unwrap()
            .execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (999, 'future')",
                [],
            )
            .unwrap();
        let bytes = fs::read(&database_path).unwrap();
        fs::remove_file(&database_path).unwrap();
        let checksums = serde_json::to_vec(&BTreeMap::from([(
            "database.sqlite".to_owned(),
            checksum(&bytes),
        )]))
        .unwrap();
        let manifest = manifest_for(FORMAT_V2, 0);
        v2_archive_with_raw_entries(
            &future_database,
            &master,
            &security_file,
            &[
                ("database.sqlite", &bytes),
                ("manifest.json", &manifest),
                ("checksums.json", &checksums),
            ],
        );
        let before_with_files = tree_snapshot(destination.path());
        assert!(matches!(
            restore(
                &active,
                &attachments,
                &future_database.to_string_lossy(),
                None,
                Some(Credential::Password(PASSWORD))
            ),
            Err(Error::BackupNewerVersion)
        ));
        assert_eq!(tree_snapshot(destination.path()), before_with_files);
        assert!(before.len() <= before_with_files.len());
        assert_eq!(Error::BackupNewerVersion.code(), "BACKUP_NEWER_VERSION");
    }

    #[test]
    fn header_key_derivation_cost_is_bounded_before_any_derivation() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let before = tree_snapshot(destination.path());
        type Edit = fn(&mut SecurityFile);
        let edits: [Edit; 5] = [
            |s| s.memory_kib = u32::MAX,
            |s| s.iterations = u32::MAX,
            |s| s.parallelism = 4096,
            |s| s.iterations = 0,
            |s| s.memory_kib = 1,
        ];
        for edit in edits {
            let altered = rewrite_envelope(&source.backup, |e| edit(e.security.as_mut().unwrap()));
            let started = std::time::Instant::now();
            let result = restore(
                &destination.path().join("legalmaster.sqlite"),
                &destination.path().join("attachments"),
                &altered,
                None,
                Some(Credential::Password(PASSWORD)),
            );
            assert!(matches!(result, Err(Error::BackupInvalid)), "{result:?}");
            assert!(started.elapsed() < Duration::from_secs(2));
        }
        assert_eq!(tree_snapshot(destination.path()), before);
    }

    #[test]
    fn a_v1_archive_opens_only_with_its_own_installations_key() {
        let temp = tempfile::tempdir().unwrap();
        let master = security::random_32();
        let source = temp.path().join("v1.sqlite");
        migrated_database(&source, &master, "CL-V1");
        let database = fs::read(&source).unwrap();
        let archive = temp.path().join("v1.lmsbackup");
        archive_with_entries(
            &archive,
            &master,
            &database,
            &[("scan.pdf", b"v1 attachment")],
        );
        let archive = archive.to_string_lossy().into_owned();
        assert_eq!(inspect(&archive).unwrap(), FORMAT_V1);

        // The installation that made it restores it exactly as before.
        let active = temp.path().join("active.sqlite");
        let documents = temp.path().join("documents");
        migrated_database(&active, &master, "CL-OLD");
        fs::write(temp.path().join("security.json"), b"current security").unwrap();
        restore(&active, &documents, &archive, Some(&master), None).unwrap();
        assert_eq!(client_numbers(&active, &master), ["CL-V1"]);
        assert_eq!(
            fs::read(documents.join("scan.pdf")).unwrap(),
            b"v1 attachment"
        );
        assert_eq!(
            fs::read(temp.path().join("security.json")).unwrap(),
            b"current security"
        );

        // Another installation (or none) cannot derive its key.
        let other = tempfile::tempdir().unwrap();
        let before = tree_snapshot(other.path());
        let target = other.path().join("legalmaster.sqlite");
        for (active_master, credential) in [
            (Some(security::random_32()), None),
            (None, Some(Credential::Password(PASSWORD))),
            (
                Some(security::random_32()),
                Some(Credential::RecoveryKey(RECOVERY)),
            ),
        ] {
            let result = restore(
                &target,
                &other.path().join("attachments"),
                &archive,
                active_master.as_ref(),
                credential,
            );
            assert!(
                matches!(result, Err(Error::BackupKeyMismatch)),
                "{result:?}"
            );
        }
        assert_eq!(tree_snapshot(other.path()), before);
        assert_eq!(Error::BackupKeyMismatch.code(), "BACKUP_KEY_MISMATCH");
    }

    #[test]
    fn a_v1_header_with_key_material_or_a_v2_header_without_is_not_trusted() {
        let source = source_with_backup();
        let downgraded = rewrite_envelope(&source.backup, |e| e.version = 1);
        assert!(matches!(inspect(&downgraded), Err(Error::BackupInvalid)));
        let stripped = rewrite_envelope(&source.backup, |e| e.security = None);
        assert!(matches!(inspect(&stripped), Err(Error::BackupInvalid)));
    }

    #[test]
    fn a_v2_backup_made_elsewhere_is_a_key_mismatch_without_credentials() {
        let source = source_with_backup();
        // Unlocked vault of a different installation, restoring without typing anything.
        assert!(matches!(
            validate(&source.backup, Some(&security::random_32()), None),
            Err(Error::BackupKeyMismatch)
        ));
        assert!(validate(&source.backup, Some(&source.master), None).is_ok());
        // With the credentials of the backup it opens, whoever holds the vault.
        assert!(validate(&source.backup, None, Some(Credential::Password(PASSWORD))).is_ok());
    }

    #[test]
    fn restoring_into_the_same_installation_keeps_the_current_password() {
        let source = source_with_backup();
        // The installation later changed its password; its envelopes differ from the backup's.
        let (current_security, _) =
            vault_security_for(&source.master, "a newer local password", RECOVERY);
        for credential in [
            None,
            Some(Credential::Password(PASSWORD)),
            Some(Credential::RecoveryKey(RECOVERY)),
        ] {
            let destination = tempfile::tempdir().unwrap();
            let root = destination.path();
            let active = root.join("legalmaster.sqlite");
            migrated_database(&active, &source.master, "CL-LATER");
            fs::write(
                root.join("security.json"),
                serde_json::to_vec_pretty(&current_security).unwrap(),
            )
            .unwrap();
            restore(
                &active,
                &root.join("attachments"),
                &source.backup,
                Some(&source.master),
                credential,
            )
            .unwrap();
            assert_eq!(client_numbers(&active, &source.master), ["CL-SOURCE"]);
            assert_eq!(
                unlock_with_password(root, "a newer local password").unwrap(),
                source.master
            );
            assert!(unlock_with_password(root, PASSWORD).is_err());
        }
    }

    #[test]
    fn restoring_a_foreign_backup_into_an_unlocked_vault_adopts_its_password_and_keeps_the_old_generation(
    ) {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let root = destination.path();
        let own_master = security::random_32();
        let active = root.join("legalmaster.sqlite");
        let attachments = root.join("attachments");
        migrated_database(&active, &own_master, "CL-OWN");
        fs::create_dir(&attachments).unwrap();
        fs::write(attachments.join("own.pdf"), b"own attachment").unwrap();
        let (own_security, _) =
            vault_security_for(&own_master, "the machine's own password", RECOVERY);
        let own_security_bytes = serde_json::to_vec_pretty(&own_security).unwrap();
        fs::write(root.join("security.json"), &own_security_bytes).unwrap();

        restore(
            &active,
            &attachments,
            &source.backup,
            Some(&own_master),
            Some(Credential::Password(PASSWORD)),
        )
        .unwrap();

        assert_eq!(client_numbers(&active, &source.master), ["CL-SOURCE"]);
        assert_eq!(unlock_with_password(root, PASSWORD).unwrap(), source.master);
        assert!(unlock_with_password(root, "the machine's own password").is_err());
        assert_eq!(
            fs::read(attachments.join("scan.bin")).unwrap(),
            source.attachment
        );
        assert!(!attachments.join("own.pdf").exists());
        // The replaced generation is retained whole, with the password that opened it.
        let snapshot = fs::read_dir(root.join("EmergencySnapshots"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(
            fs::read(snapshot.join("security.json")).unwrap(),
            own_security_bytes
        );
        assert_eq!(
            client_numbers(&snapshot.join("database.sqlite"), &own_master),
            ["CL-OWN"]
        );
        assert_eq!(
            fs::read(snapshot.join("attachments/own.pdf")).unwrap(),
            b"own attachment"
        );
        assert!(!vault_operation::pending(root));
    }

    #[test]
    fn restoring_over_an_incomplete_installation_keeps_what_was_left_in_a_snapshot() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let root = destination.path();
        // Lost database: the security file and a stray attachment survive.
        let (stranded_security, _) =
            vault_security_for(&security::random_32(), "stranded password", RECOVERY);
        let stranded_bytes = serde_json::to_vec_pretty(&stranded_security).unwrap();
        fs::write(root.join("security.json"), &stranded_bytes).unwrap();
        fs::create_dir(root.join("attachments")).unwrap();
        fs::write(root.join("attachments/stranded.pdf"), b"stranded").unwrap();
        let active = root.join("legalmaster.sqlite");

        restore(
            &active,
            &root.join("attachments"),
            &source.backup,
            None,
            Some(Credential::Password(PASSWORD)),
        )
        .unwrap();

        assert_eq!(client_numbers(&active, &source.master), ["CL-SOURCE"]);
        assert_eq!(unlock_with_password(root, PASSWORD).unwrap(), source.master);
        let snapshot = fs::read_dir(root.join("EmergencySnapshots"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(
            fs::read(snapshot.join("security.json")).unwrap(),
            stranded_bytes
        );
        assert_eq!(
            fs::read(snapshot.join("attachments/stranded.pdf")).unwrap(),
            b"stranded"
        );
        assert!(!snapshot.join("database.sqlite").exists());
        assert!(!vault_operation::pending(root));
    }

    #[test]
    fn a_failed_restore_over_a_live_vault_leaves_every_file_unchanged() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let root = destination.path();
        let own_master = security::random_32();
        let active = root.join("legalmaster.sqlite");
        migrated_database(&active, &own_master, "CL-OWN");
        fs::create_dir(root.join("attachments")).unwrap();
        fs::write(root.join("attachments/own.pdf"), b"own").unwrap();
        fs::write(root.join("security.json"), b"own security").unwrap();
        let before = tree_snapshot(root);
        let result = restore(
            &active,
            &root.join("attachments"),
            &source.backup,
            Some(&own_master),
            Some(Credential::Password("not the password")),
        );
        assert!(matches!(result, Err(Error::InvalidPassword)));
        assert_eq!(tree_snapshot(root), before);
        // And the same backup with no credentials from a foreign vault.
        let result = restore(
            &active,
            &root.join("attachments"),
            &source.backup,
            Some(&own_master),
            None,
        );
        assert!(matches!(result, Err(Error::BackupKeyMismatch)));
        assert_eq!(tree_snapshot(root), before);
    }

    #[test]
    fn restore_refuses_to_start_while_an_operation_is_pending() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        fs::write(destination.path().join("vault-operation.json"), b"{}").unwrap();
        let before = tree_snapshot(destination.path());
        let result = restore(
            &destination.path().join("legalmaster.sqlite"),
            &destination.path().join("attachments"),
            &source.backup,
            None,
            Some(Credential::Password(PASSWORD)),
        );
        assert!(matches!(result, Err(Error::VaultInterrupted)));
        assert_eq!(tree_snapshot(destination.path()), before);
    }

    #[test]
    fn stale_staging_from_an_attempt_that_never_replaced_anything_is_cleared() {
        let source = source_with_backup();
        let destination = tempfile::tempdir().unwrap();
        let root = destination.path();
        fs::write(root.join("legalmaster.restore.tmp"), b"stale").unwrap();
        fs::write(root.join("security.restore.tmp"), b"stale").unwrap();
        fs::create_dir(root.join("attachments.restore.tmp")).unwrap();
        fs::write(root.join("attachments.restore.tmp/stale.pdf"), b"stale").unwrap();
        restore(
            &root.join("legalmaster.sqlite"),
            &root.join("attachments"),
            &source.backup,
            None,
            Some(Credential::Password(PASSWORD)),
        )
        .unwrap();
        assert!(!root.join("attachments/stale.pdf").exists());
        assert_eq!(unlock_with_password(root, PASSWORD).unwrap(), source.master);
    }

    #[test]
    fn a_new_backup_embeds_the_security_header_and_no_plaintext_secrets() {
        let source = source_with_backup();
        let text = fs::read_to_string(&source.backup).unwrap();
        let envelope: BackupEnvelope = serde_json::from_str(&text).unwrap();
        assert_eq!(envelope.version, FORMAT_V2);
        let header = envelope.security.unwrap();
        assert_eq!(header.salt, source.security.salt);
        assert_eq!(
            header.password_envelope.ciphertext,
            source.security.password_envelope.ciphertext
        );
        assert!(!text.contains(PASSWORD));
        assert!(!text.contains(RECOVERY));
        assert!(!text.contains(&hex::encode(source.master)));
        // The manifest inside carries the same format version as the envelope.
        let opened = open(&source.backup, Some(&source.master), None).unwrap();
        let mut archive = ZipArchive::new(Cursor::new(opened.plaintext)).unwrap();
        let manifest: BackupManifest =
            serde_json::from_reader(archive.by_name("manifest.json").unwrap()).unwrap();
        assert_eq!(manifest.format_version, FORMAT_V2);
        assert_eq!(manifest.schema_version, db::latest_schema_version());
    }

    fn manifest_for(format_version: u8, document_count: usize) -> Vec<u8> {
        serde_json::to_vec(&BackupManifest {
            format_version,
            application_version: "test".into(),
            schema_version: db::latest_schema_version(),
            created_at: db::now(),
            database_encrypted: true,
            managed_document_count: document_count,
        })
        .unwrap()
    }

    fn v2_archive_with_raw_entries(
        path: &Path,
        master: &[u8; 32],
        security_file: &SecurityFile,
        entries: &[(&str, &[u8])],
    ) {
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, content) in entries {
            archive
                .start_file(*name, SimpleFileOptions::default())
                .unwrap();
            archive.write_all(content).unwrap();
        }
        let plaintext = archive.finish().unwrap().into_inner();
        let nonce = security::random_32();
        let nonce_text = STANDARD.encode(&nonce[..NONCE_BYTES]);
        let key = Zeroizing::new(security::backup_key(master));
        let aad = header_aad(FORMAT_V2, security_file, &nonce_text);
        let ciphertext = XChaCha20Poly1305::new_from_slice(key.as_slice())
            .unwrap()
            .encrypt(
                XNonce::from_slice(&nonce[..NONCE_BYTES]),
                Payload {
                    msg: plaintext.as_ref(),
                    aad: &aad,
                },
            )
            .unwrap();
        let envelope = BackupEnvelope {
            version: FORMAT_V2,
            security: Some(security_file.clone()),
            nonce: nonce_text,
            ciphertext: STANDARD.encode(ciphertext),
        };
        fs::write(path, serde_json::to_vec(&envelope).unwrap()).unwrap();
    }
}
