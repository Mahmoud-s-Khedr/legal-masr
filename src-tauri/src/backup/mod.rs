use crate::{db, errors::Error, security};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

#[derive(Serialize, Deserialize)]
struct BackupEnvelope {
    version: u8,
    nonce: String,
    ciphertext: String,
}

pub fn create(db_path: &Path, master: &[u8; 32], destination: &str) -> Result<String, Error> {
    let destination = PathBuf::from(destination);
    fs::create_dir_all(&destination)?;
    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    archive.start_file("manifest.json", SimpleFileOptions::default())?;
    archive.write_all(
        format!(
            r#"{{"formatVersion":1,"createdAt":"{}","databaseEncrypted":true}}"#,
            db::now()
        )
        .as_bytes(),
    )?;
    archive.start_file("database.sqlite", SimpleFileOptions::default())?;
    archive.write_all(&fs::read(db_path)?)?;
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
        time::OffsetDateTime::now_utc().unix_timestamp()
    ));
    let temp = output.with_extension("tmp");
    fs::write(&temp, payload)?;
    fs::rename(temp, &output)?;
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
    if !manifest.contains("formatVersion") {
        return Err(Error::BackupInvalid);
    }
    Ok(())
}

pub fn restore(active_db: &Path, master: &[u8; 32], path: &str) -> Result<(), Error> {
    let bytes = decrypt(path, master)?;
    let mut archive = ZipArchive::new(Cursor::new(bytes))?;
    let mut db_bytes = Vec::new();
    archive
        .by_name("database.sqlite")
        .map_err(|_| Error::BackupInvalid)?
        .read_to_end(&mut db_bytes)?;
    let staging = active_db.with_extension("restore.tmp");
    fs::write(&staging, db_bytes)?;
    let restored = db::open_db(&staging, master).map_err(|_| Error::BackupInvalid)?;
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
    let emergency = active_db.with_extension("pre-restore.bak");
    fs::copy(active_db, &emergency)?;
    fs::rename(&staging, active_db)?;
    Ok(())
}
