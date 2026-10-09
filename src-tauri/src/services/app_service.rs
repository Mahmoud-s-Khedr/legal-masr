use crate::{
    db,
    dto::{InitializeInput, InitializeResult, Status, VaultState},
    errors::Error,
    repositories::settings_repository,
    security,
    state::AppState,
    vault_operation,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use hex;
use std::fs;
use tauri::{AppHandle, Runtime};
use zeroize::Zeroizing;

pub fn get_status<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<Status, Error> {
    let _security_guard = state.lock_security_operations()?;
    let (security_path, db_path) = db::paths(app)?;
    if vault_operation::recover(&db::app_dir(app)?).is_err() {
        lock(state)?;
        return Ok(Status {
            initialized: true,
            unlocked: false,
            vault_state: VaultState::Interrupted,
        });
    }
    security::recover_interrupted_security_write(&security_path)?;
    let unlocked = state
        .master_key
        .lock()
        .map_err(|_| Error::Locked)?
        .is_some();
    let complete =
        security_path.is_file() && db_path.is_file() && fs::metadata(&db_path)?.len() > 0;
    if !complete && unlocked {
        lock(state)?;
    }
    let artifacts = db::has_vault_artifacts(&db::app_dir(app)?)?;
    let vault_state = if !artifacts {
        VaultState::Empty
    } else if !complete {
        VaultState::Incomplete
    } else if unlocked {
        VaultState::Unlocked
    } else {
        VaultState::Locked
    };
    Ok(Status {
        initialized: artifacts,
        unlocked: complete && unlocked,
        vault_state,
    })
}

pub fn initialize<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: InitializeInput,
) -> Result<InitializeResult, Error> {
    let _security_guard = state.lock_security_operations()?;
    if input.password.chars().count() < 12
        || input.full_name.trim().is_empty()
        || !matches!(input.language.as_str(), "ar" | "en")
        || !(1..=1440).contains(&input.lock_timeout_minutes)
    {
        return Err(Error::Validation);
    }
    let (security_path, db_path) = db::paths(app)?;
    vault_operation::recover(&db::app_dir(app)?)?;
    security::recover_interrupted_security_write(&security_path)?;
    if db::has_vault_artifacts(&db::app_dir(app)?)? {
        return Err(Error::Initialized);
    }
    let data_dir = db::app_dir(app)?;

    let master = Zeroizing::new(security::random_32());
    let salt = security::random_32();
    let password_key = Zeroizing::new(security::derive_password(
        &input.password,
        &salt,
        19_456,
        2,
        1,
    )?);
    let recovery_bytes = Zeroizing::new(security::random_32());
    let recovery_key = hex::encode(recovery_bytes.as_slice());
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
        let conn = db::create_db(&temp_db, &master)?;
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
    if let Err(error) = security::write_security_atomically(&temp_security, &security_file) {
        let _ = fs::remove_file(&temp_db);
        return Err(error);
    }
    // The complete staged pair is durable before installing either artifact.
    // On failure retain the journal and staged pair for startup recovery.
    vault_operation::install_setup(&data_dir)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(InitializeResult { recovery_key })
}

pub fn unlock<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    password: &str,
) -> Result<(), Error> {
    let _security_guard = state.lock_security_operations()?;
    let (security_path, db_path) = db::paths(app)?;
    vault_operation::recover(&db::app_dir(app)?)?;
    security::recover_interrupted_security_write(&security_path)?;
    let security_file = security::read_security(&security_path)?;
    let salt = STANDARD
        .decode(security_file.salt)
        .map_err(|_| Error::InvalidPassword)?;
    let derived = Zeroizing::new(security::derive_password(
        password,
        &salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?);
    let master = Zeroizing::new(security::unwrap(
        &derived,
        &security_file.password_envelope,
    )?);
    let connection = db::open_db(&db_path, &master)?;
    db::migrate(&connection)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

pub fn lock(state: &AppState) -> Result<(), Error> {
    drop(state.master_key.lock().map_err(|_| Error::Locked)?.take());
    state.clear_document_sources()?;
    state.clear_restore_selection()?;
    Ok(())
}

pub fn change_password<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    current_password: &str,
    new_password: &str,
) -> Result<(), Error> {
    let _security_guard = state.lock_security_operations()?;
    state.unlocked()?;
    if current_password.is_empty()
        || new_password == current_password
        || new_password.chars().count() < 12
    {
        return Err(Error::Validation);
    }
    let (security_path, _) = db::paths(app)?;
    vault_operation::recover(&db::app_dir(app)?)?;
    security::recover_interrupted_security_write(&security_path)?;
    let mut security_file = security::read_security(&security_path)?;
    let old_salt = STANDARD
        .decode(&security_file.salt)
        .map_err(|_| Error::InvalidPassword)?;
    let old_key = Zeroizing::new(security::derive_password(
        current_password,
        &old_salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?);
    let master = Zeroizing::new(security::unwrap(
        &old_key,
        &security_file.password_envelope,
    )?);
    let salt = security::random_32();
    let new_key = Zeroizing::new(security::derive_password(
        new_password,
        &salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?);
    security_file.salt = STANDARD.encode(salt);
    security_file.password_envelope = security::wrap(&new_key, &master)?;
    security::write_security_atomically(&security_path, &security_file)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

pub fn recover_access<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    recovery_key: &str,
    new_password: &str,
) -> Result<(), Error> {
    let _security_guard = state.lock_security_operations()?;
    if new_password.chars().count() < 12 {
        return Err(Error::Validation);
    }
    let (security_path, db_path) = db::paths(app)?;
    vault_operation::recover(&db::app_dir(app)?)?;
    security::recover_interrupted_security_write(&security_path)?;
    let mut security_file = security::read_security(&security_path)?;
    let master = Zeroizing::new(
        security::unwrap(
            &security::recovery_key_material(recovery_key),
            &security_file.recovery_envelope,
        )
        .map_err(|_| Error::InvalidRecovery)?,
    );
    let connection = db::open_db(&db_path, &master)?;
    db::migrate(&connection)?;
    let salt = security::random_32();
    let password_key = Zeroizing::new(security::derive_password(
        new_password,
        &salt,
        security_file.memory_kib,
        security_file.iterations,
        security_file.parallelism,
    )?);
    security_file.salt = STANDARD.encode(salt);
    security_file.password_envelope = security::wrap(&password_key, &master)?;
    security::write_security_atomically(&security_path, &security_file)?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn lock_clears_the_master_key_and_pending_document_sources() {
        let state = AppState::default();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let token = state
            .store_document_source(PathBuf::from("/selected-by-native-dialog.pdf"))
            .unwrap();

        lock(&state).unwrap();

        assert!(matches!(state.unlocked(), Err(Error::Locked)));
        assert!(matches!(
            state.take_document_source(&token),
            Err(Error::Locked)
        ));
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        assert!(matches!(
            state.take_document_source(&token),
            Err(Error::AttachmentSourceMissing)
        ));
    }
}
