use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand::{rngs::OsRng, RngCore};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};
use thiserror::Error;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const SECURITY_FILE: &str = "security.json";
const DB_FILE: &str = "legalmaster.sqlite";
const MIGRATION: &str = include_str!("../migrations/0001_foundation.sql");

#[derive(Default)]
struct AppState {
    master_key: Mutex<Option<[u8; 32]>>,
}
#[derive(Serialize)]
struct ApiError {
    code: &'static str,
    message: &'static str,
    details: Option<()>,
}
#[derive(Error, Debug)]
enum Error {
    #[error("invalid password")]
    InvalidPassword,
    #[error("application is locked")]
    Locked,
    #[error("application already initialized")]
    Initialized,
    #[error("invalid recovery key")]
    InvalidRecovery,
    #[error("backup is invalid")]
    BackupInvalid,
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Sql(#[from] rusqlite::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Zip(#[from] zip::result::ZipError),
}
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let (code, message) = match self {
            Self::InvalidPassword => ("INVALID_PASSWORD", "كلمة المرور غير صحيحة."),
            Self::Locked => ("APP_LOCKED", "التطبيق مقفل."),
            Self::Initialized => ("ALREADY_INITIALIZED", "تم إعداد التطبيق بالفعل."),
            Self::InvalidRecovery => ("RECOVERY_KEY_INVALID", "مفتاح الاسترداد غير صحيح."),
            Self::BackupInvalid => ("BACKUP_CORRUPTED", "ملف النسخة الاحتياطية غير صالح."),
            _ => ("OPERATION_FAILED", "تعذر إتمام العملية بأمان."),
        };
        ApiError {
            code,
            message,
            details: None,
        }
        .serialize(serializer)
    }
}

#[derive(Serialize)]
struct Status {
    initialized: bool,
    unlocked: bool,
}
#[derive(Serialize)]
struct InitializeResult {
    recovery_key: String,
}
#[derive(Serialize, Deserialize)]
struct Envelope {
    nonce: String,
    ciphertext: String,
}
#[derive(Serialize, Deserialize)]
struct SecurityFile {
    version: u8,
    salt: String,
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
    password_envelope: Envelope,
    recovery_envelope: Envelope,
}
#[derive(Serialize, Deserialize)]
struct BackupEnvelope {
    version: u8,
    nonce: String,
    ciphertext: String,
}

fn app_dir(app: &AppHandle) -> Result<PathBuf, Error> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|_| Error::Io(std::io::Error::other("app data path unavailable")))?
        .join("LegalMasterSolo");
    fs::create_dir_all(&path)?;
    Ok(path)
}
fn paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), Error> {
    let root = app_dir(app)?;
    Ok((root.join(SECURITY_FILE), root.join(DB_FILE)))
}
fn now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}
fn random_32() -> [u8; 32] {
    let mut v = [0; 32];
    OsRng.fill_bytes(&mut v);
    v
}
fn derive_password(
    password: &str,
    salt: &[u8],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; 32], Error> {
    let mut output = [0; 32];
    let params = Params::new(memory_kib, iterations, parallelism, Some(32))
        .map_err(|_| Error::InvalidPassword)?;
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|_| Error::InvalidPassword)?;
    Ok(output)
}
fn wrap(key: &[u8; 32], value: &[u8; 32]) -> Result<Envelope, Error> {
    let nonce = random_32();
    let cipher = XChaCha20Poly1305::new_from_slice(key).map_err(|_| Error::InvalidPassword)?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce[..24]), value.as_ref())
        .map_err(|_| Error::InvalidPassword)?;
    Ok(Envelope {
        nonce: STANDARD.encode(&nonce[..24]),
        ciphertext: STANDARD.encode(ciphertext),
    })
}
fn unwrap(key: &[u8; 32], envelope: &Envelope) -> Result<[u8; 32], Error> {
    let nonce = STANDARD
        .decode(&envelope.nonce)
        .map_err(|_| Error::InvalidPassword)?;
    let ciphertext = STANDARD
        .decode(&envelope.ciphertext)
        .map_err(|_| Error::InvalidPassword)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key).map_err(|_| Error::InvalidPassword)?;
    let bytes = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| Error::InvalidPassword)?;
    bytes.try_into().map_err(|_| Error::InvalidPassword)
}
fn recovery_key_material(key: &str) -> [u8; 32] {
    Sha256::digest(key.replace('-', "").as_bytes()).into()
}
fn read_security(path: &Path) -> Result<SecurityFile, Error> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
fn open_db(path: &Path, master: &[u8; 32]) -> Result<Connection, Error> {
    let db = Connection::open(path)?;
    db.pragma_update(None, "key", format!("x'{}'", hex::encode(master)))?;
    db.execute_batch("PRAGMA cipher_memory_security = ON; PRAGMA foreign_keys = ON; SELECT count(*) FROM sqlite_master;")?;
    Ok(db)
}
fn migrate(db: &Connection) -> Result<(), Error> {
    db.execute_batch(MIGRATION)?;
    db.execute("INSERT OR IGNORE INTO app_metadata (id, installation_uuid, schema_version, created_at, updated_at) VALUES (1, lower(hex(randomblob(16))), 1, ?1, ?1)", [now()])?;
    Ok(())
}
fn unlocked(state: &AppState) -> Result<[u8; 32], Error> {
    state
        .master_key
        .lock()
        .map_err(|_| Error::Locked)?
        .as_ref()
        .copied()
        .ok_or(Error::Locked)
}

#[tauri::command]
fn app_get_status(app: AppHandle, state: State<AppState>) -> Result<Status, Error> {
    let (security, _) = paths(&app)?;
    Ok(Status {
        initialized: security.exists(),
        unlocked: state
            .master_key
            .lock()
            .map_err(|_| Error::Locked)?
            .is_some(),
    })
}
#[tauri::command]
fn app_initialize(
    app: AppHandle,
    state: State<AppState>,
    password: String,
) -> Result<InitializeResult, Error> {
    if password.chars().count() < 12 {
        return Err(Error::InvalidPassword);
    }
    let (security_path, db_path) = paths(&app)?;
    if security_path.exists() {
        return Err(Error::Initialized);
    }
    let master = random_32();
    let salt = random_32();
    let password_key = derive_password(&password, &salt, 19_456, 2, 1)?;
    let recovery_bytes = random_32();
    let recovery_key = hex::encode(recovery_bytes);
    let security = SecurityFile {
        version: 1,
        salt: STANDARD.encode(salt),
        memory_kib: 19_456,
        iterations: 2,
        parallelism: 1,
        password_envelope: wrap(&password_key, &master)?,
        recovery_envelope: wrap(&recovery_key_material(&recovery_key), &master)?,
    };
    let temp_db = db_path.with_extension("tmp");
    {
        let db = open_db(&temp_db, &master)?;
        migrate(&db)?;
        db.execute("INSERT INTO spike_records (id, value, created_at) VALUES (lower(hex(randomblob(16))), 'initialization-probe', ?1)", [now()])?;
    }
    fs::rename(temp_db, &db_path)?;
    fs::write(&security_path, serde_json::to_vec_pretty(&security)?)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(InitializeResult { recovery_key })
}
#[tauri::command]
fn app_unlock(app: AppHandle, state: State<AppState>, password: String) -> Result<(), Error> {
    let (security_path, db_path) = paths(&app)?;
    let security = read_security(&security_path)?;
    let salt = STANDARD
        .decode(security.salt)
        .map_err(|_| Error::InvalidPassword)?;
    let derived = derive_password(
        &password,
        &salt,
        security.memory_kib,
        security.iterations,
        security.parallelism,
    )?;
    let master = unwrap(&derived, &security.password_envelope)?;
    let _ = open_db(&db_path, &master)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}
#[tauri::command]
fn app_lock(state: State<AppState>) -> Result<(), Error> {
    *state.master_key.lock().map_err(|_| Error::Locked)? = None;
    Ok(())
}
#[tauri::command]
fn app_change_password(
    app: AppHandle,
    state: State<AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), Error> {
    if new_password.chars().count() < 12 {
        return Err(Error::InvalidPassword);
    }
    let (security_path, _) = paths(&app)?;
    let mut security = read_security(&security_path)?;
    let old_salt = STANDARD
        .decode(&security.salt)
        .map_err(|_| Error::InvalidPassword)?;
    let old_key = derive_password(
        &current_password,
        &old_salt,
        security.memory_kib,
        security.iterations,
        security.parallelism,
    )?;
    let master = unwrap(&old_key, &security.password_envelope)?;
    let salt = random_32();
    let new_key = derive_password(
        &new_password,
        &salt,
        security.memory_kib,
        security.iterations,
        security.parallelism,
    )?;
    security.salt = STANDARD.encode(salt);
    security.password_envelope = wrap(&new_key, &master)?;
    fs::write(security_path, serde_json::to_vec_pretty(&security)?)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}
#[tauri::command]
fn app_recover_access(
    app: AppHandle,
    state: State<AppState>,
    recovery_key: String,
    new_password: String,
) -> Result<(), Error> {
    if new_password.chars().count() < 12 {
        return Err(Error::InvalidPassword);
    }
    let (security_path, db_path) = paths(&app)?;
    let mut security = read_security(&security_path)?;
    let master = unwrap(
        &recovery_key_material(&recovery_key),
        &security.recovery_envelope,
    )
    .map_err(|_| Error::InvalidRecovery)?;
    let _ = open_db(&db_path, &master)?;
    let salt = random_32();
    let password_key = derive_password(
        &new_password,
        &salt,
        security.memory_kib,
        security.iterations,
        security.parallelism,
    )?;
    security.salt = STANDARD.encode(salt);
    security.password_envelope = wrap(&password_key, &master)?;
    fs::write(security_path, serde_json::to_vec_pretty(&security)?)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

fn backup_key(master: &[u8; 32]) -> [u8; 32] {
    Sha256::digest([master.as_slice(), b"LegalMasterSolo/backup/v1"].concat()).into()
}
#[tauri::command]
fn backup_create(
    app: AppHandle,
    state: State<AppState>,
    destination: String,
) -> Result<String, Error> {
    let master = unlocked(&state)?;
    let (_, db_path) = paths(&app)?;
    let destination = PathBuf::from(destination);
    fs::create_dir_all(&destination)?;
    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    archive.start_file("manifest.json", SimpleFileOptions::default())?;
    archive.write_all(
        format!(
            r#"{{"formatVersion":1,"createdAt":"{}","databaseEncrypted":true}}"#,
            now()
        )
        .as_bytes(),
    )?;
    archive.start_file("database.sqlite", SimpleFileOptions::default())?;
    archive.write_all(&fs::read(db_path)?)?;
    let plaintext = archive.finish()?.into_inner();
    let key = backup_key(&master);
    let wrapped = wrap(&key, &Sha256::digest(&plaintext).into())?;
    let nonce = STANDARD
        .decode(wrapped.nonce)
        .map_err(|_| Error::BackupInvalid)?;
    let cipher = XChaCha20Poly1305::new_from_slice(&key).map_err(|_| Error::BackupInvalid)?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|_| Error::BackupInvalid)?;
    let payload = serde_json::to_vec(&BackupEnvelope {
        version: 1,
        nonce: STANDARD.encode(nonce),
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
fn read_backup(path: &str, master: &[u8; 32]) -> Result<Vec<u8>, Error> {
    let payload: BackupEnvelope = serde_json::from_slice(&fs::read(path)?)?;
    if payload.version != 1 {
        return Err(Error::BackupInvalid);
    }
    let key = backup_key(master);
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
#[tauri::command]
fn backup_validate(state: State<AppState>, path: String) -> Result<(), Error> {
    let bytes = read_backup(&path, &unlocked(&state)?)?;
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

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
        .invoke_handler(tauri::generate_handler![
            app_get_status,
            app_initialize,
            app_unlock,
            app_lock,
            app_change_password,
            app_recover_access,
            backup_create,
            backup_validate
        ])
        .run(tauri::generate_context!())
        .expect("error while running LegalMaster Solo");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_envelope_round_trip_rejects_wrong_password() {
        let salt = random_32();
        let master = random_32();
        let correct = derive_password("a secure local password", &salt, 19_456, 2, 1).unwrap();
        let incorrect = derive_password("a different local password", &salt, 19_456, 2, 1).unwrap();
        let envelope = wrap(&correct, &master).unwrap();
        assert_eq!(unwrap(&correct, &envelope).unwrap(), master);
        assert!(unwrap(&incorrect, &envelope).is_err());
    }

    #[test]
    fn recovery_key_material_is_stable_and_distinct() {
        assert_eq!(
            recovery_key_material("abcd-ef01"),
            recovery_key_material("abcdef01")
        );
        assert_ne!(
            recovery_key_material("abcdef01"),
            recovery_key_material("abcdef02")
        );
    }

    #[test]
    fn backup_key_is_separate_from_the_database_master_key() {
        let master = random_32();
        assert_ne!(backup_key(&master), master);
    }
}
