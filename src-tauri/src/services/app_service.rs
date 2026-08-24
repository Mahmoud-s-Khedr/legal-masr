use crate::{
    db,
    dto::{InitializeInput, InitializeResult, Status},
    errors::Error,
    repositories::settings_repository,
    security,
    state::AppState,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use hex;
use std::fs;
use tauri::{AppHandle, Runtime};
use zeroize::Zeroize;

pub fn get_status<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<Status, Error> {
    let (security_path, _) = db::paths(app)?;
    let master = state
        .master_key
        .lock()
        .map_err(|_| Error::Locked)?
        .as_ref()
        .copied();
    Ok(Status {
        initialized: security_path.exists(),
        unlocked: master.is_some(),
    })
}

pub fn initialize<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: InitializeInput,
) -> Result<InitializeResult, Error> {
    if input.password.chars().count() < 12
        || input.full_name.trim().is_empty()
        || !matches!(input.language.as_str(), "ar" | "en")
        || input.lock_timeout_minutes == 0
    {
        return Err(Error::Validation);
    }
    let (security_path, db_path) = db::paths(app)?;
    if security_path.exists() {
        return Err(Error::Initialized);
    }
    let data_dir = db::app_dir(app)?;
    fs::create_dir_all(data_dir.join("attachments"))?;
    fs::create_dir_all(data_dir.join("Backups"))?;
    let master = security::random_32();
    let salt = security::random_32();
    let password_key = security::derive_password(&input.password, &salt, 19_456, 2, 1)?;
    let recovery_bytes = security::random_32();
    let recovery_key = hex::encode(recovery_bytes);
    let security_file = security::SecurityFile {
        version: 1,
        salt: STANDARD.encode(salt),
        memory_kib: 19_456,
        iterations: 2,
        parallelism: 1,
        password_envelope: security::wrap(&password_key, &master)?,
        recovery_envelope: security::wrap(
            &security::recovery_key_material(&recovery_key),
            &master,
        )?,
    };
    let temp_db = db_path.with_extension("tmp");
    let database_setup = (|| -> Result<(), Error> {
        let conn = db::open_db(&temp_db, &master)?;
        db::migrate(&conn)?;
        settings_repository::insert_initial_profile_and_settings(
            &conn,
            &input.full_name,
            &input.language,
            input.lock_timeout_minutes,
        )?;
        Ok(())
    })();
    if let Err(error) = database_setup {
        let _ = fs::remove_file(&temp_db);
        return Err(error);
    }
    let temp_security = security_path.with_extension("tmp");
    if let Err(error) = fs::write(&temp_security, serde_json::to_vec_pretty(&security_file)?) {
        let _ = fs::remove_file(&temp_db);
        return Err(error.into());
    }
    if let Err(error) = fs::rename(&temp_db, &db_path) {
        let _ = fs::remove_file(&temp_db);
        let _ = fs::remove_file(&temp_security);
        return Err(error.into());
    }
    if let Err(error) = fs::rename(&temp_security, &security_path) {
        let _ = fs::remove_file(&db_path);
        let _ = fs::remove_file(&temp_security);
        return Err(error.into());
    }
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(InitializeResult { recovery_key })
}

pub fn unlock<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    password: &str,
) -> Result<(), Error> {
    let (security_path, db_path) = db::paths(app)?;
    let security_file = security::read_security(&security_path)?;
    let salt = STANDARD
        .decode(security_file.salt)
        .map_err(|_| Error::InvalidPassword)?;
    let derived = security::derive_password(
        password,
        &salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?;
    let master = security::unwrap(&derived, &security_file.password_envelope)?;
    let _ = db::open_db(&db_path, &master)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

pub fn lock(state: &AppState) -> Result<(), Error> {
    if let Some(mut key) = state.master_key.lock().map_err(|_| Error::Locked)?.take() {
        key.zeroize();
    }
    Ok(())
}

pub fn change_password<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    current_password: &str,
    new_password: &str,
) -> Result<(), Error> {
    if new_password.chars().count() < 12 {
        return Err(Error::Validation);
    }
    let (security_path, _) = db::paths(app)?;
    let mut security_file = security::read_security(&security_path)?;
    let old_salt = STANDARD
        .decode(&security_file.salt)
        .map_err(|_| Error::InvalidPassword)?;
    let old_key = security::derive_password(
        current_password,
        &old_salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?;
    let master = security::unwrap(&old_key, &security_file.password_envelope)?;
    let salt = security::random_32();
    let new_key = security::derive_password(
        new_password,
        &salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?;
    security_file.salt = STANDARD.encode(salt);
    security_file.password_envelope = security::wrap(&new_key, &master)?;
    fs::write(security_path, serde_json::to_vec_pretty(&security_file)?)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

pub fn recover_access<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    recovery_key: &str,
    new_password: &str,
) -> Result<(), Error> {
    if new_password.chars().count() < 12 {
        return Err(Error::Validation);
    }
    let (security_path, db_path) = db::paths(app)?;
    let mut security_file = security::read_security(&security_path)?;
    let master = security::unwrap(
        &security::recovery_key_material(recovery_key),
        &security_file.recovery_envelope,
    )
    .map_err(|_| Error::InvalidRecovery)?;
    let _ = db::open_db(&db_path, &master)?;
    let salt = security::random_32();
    let password_key = security::derive_password(
        new_password,
        &salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?;
    security_file.salt = STANDARD.encode(salt);
    security_file.password_envelope = security::wrap(&password_key, &master)?;
    fs::write(security_path, serde_json::to_vec_pretty(&security_file)?)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}
