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
use std::{
    fs,
    path::{Path, PathBuf},
};
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
    let (security_path, _) = db::paths(app)?;
    vault_operation::recover(&db::app_dir(app)?)?;
    security::recover_interrupted_security_write(&security_path)?;
    if db::has_vault_artifacts(&db::app_dir(app)?)? {
        return Err(Error::Initialized);
    }

    let master = Zeroizing::new(security::random_32());
    let salt = security::random_32();
    let password_key = Zeroizing::new(security::derive_password(
        &input.password,
        &salt,
        19_456,
        2,
        1,
    )?);
    let recovery_key = new_recovery_key();
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
    install_new_vault(
        app,
        state,
        master,
        &security_file,
        &input.full_name,
        &input.language,
        input.lock_timeout_minutes,
    )?;
    Ok(InitializeResult { recovery_key })
}

/// Stages a new, empty vault sealed with `master` and `security_file`, installs it through
/// the setup journal and unlocks it. The caller holds the security guard and has checked
/// that no vault exists yet.
fn install_new_vault<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    master: Zeroizing<[u8; 32]>,
    security_file: &security::SecurityFile,
    full_name: &str,
    language: &str,
    lock_timeout_minutes: u32,
) -> Result<(), Error> {
    let (security_path, db_path) = db::paths(app)?;
    let data_dir = db::app_dir(app)?;
    let temp_db = db_path.with_extension("tmp");
    let database_setup = (|| -> Result<(), Error> {
        let conn = db::create_db(&temp_db, &master)?;
        db::migrate(&conn)?;
        settings_repository::insert_initial_profile_and_settings(
            &conn,
            full_name,
            language,
            lock_timeout_minutes,
        )?;
        Ok(())
    })();
    if let Err(error) = database_setup {
        let _ = fs::remove_file(&temp_db);
        return Err(error);
    }
    let temp_security = security_path.with_extension("tmp");
    if let Err(error) = security::write_security_atomically(&temp_security, security_file) {
        let _ = fs::remove_file(&temp_db);
        return Err(error);
    }
    // The complete staged pair is durable before installing either artifact.
    // On failure retain the journal and staged pair for startup recovery.
    vault_operation::install_setup(&data_dir)?;
    state.advance_generation();
    state.clear_restore_selection()?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
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
    // Keeps search current for vaults indexed by an earlier version. A failure leaves the
    // previous index in place and must not keep the lawyer out.
    let _ = crate::services::search_service::rebuild_with(&connection);
    state.advance_generation();
    state.clear_restore_selection()?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

pub fn lock(state: &AppState) -> Result<(), Error> {
    state.advance_generation();
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
    state.advance_generation();
    state.clear_restore_selection()?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

fn new_recovery_key() -> String {
    hex::encode(Zeroizing::new(security::random_32()).as_slice())
}

/// Issues a new recovery key (for a lost or exposed one) after the current password is
/// confirmed. The old key stops opening this vault; backups made earlier still carry it.
pub fn replace_recovery_key<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    current_password: &str,
) -> Result<String, Error> {
    let _security_guard = state.lock_security_operations()?;
    state.unlocked()?;
    if current_password.is_empty() {
        return Err(Error::Validation);
    }
    let (security_path, _) = db::paths(app)?;
    vault_operation::recover(&db::app_dir(app)?)?;
    security::recover_interrupted_security_write(&security_path)?;
    let mut security_file = security::read_security(&security_path)?;
    let master = Zeroizing::new(security::master_from_password(
        &security_file,
        current_password,
    )?);
    let recovery_key = new_recovery_key();
    security_file.recovery_envelope =
        security::wrap(&security::recovery_key_material(&recovery_key), &master)?;
    security::write_security_atomically(&security_path, &security_file)?;
    state.advance_generation();
    state.clear_restore_selection()?;
    Ok(recovery_key)
}

/// The text of the recovery-key file the lawyer saves to a flash drive: the key in groups
/// of eight, as the app shows it. A UTF-8 mark lets older Windows editors show the Arabic.
pub fn recovery_key_document(key: &str) -> Result<Zeroizing<String>, Error> {
    let compact = Zeroizing::new(
        key.chars()
            .filter(|character| !character.is_whitespace() && *character != '-')
            .collect::<String>(),
    );
    if compact.len() != 64
        || !compact
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(Error::Validation);
    }
    let grouped = Zeroizing::new(
        compact
            .as_bytes()
            .chunks(8)
            .map(|group| String::from_utf8_lossy(group).into_owned())
            .collect::<Vec<_>>()
            .join(" "),
    );
    Ok(Zeroizing::new(format!(
        "\u{feff}مفتاح استرداد ليجال مصر\r\nLegal Masr recovery key\r\n\r\n{}\r\n\r\n\
         يفتح هذا المفتاح ملفاتك إذا نسيت كلمة المرور. احفظ هذا الملف على فلاشة أو اطبعه، \
         وأبعده عن هذا الجهاز وعن ملفات النسخ الاحتياطية.\r\n\
         This key opens your files if you forget your password. Keep it away from this \
         computer and from your backup files.\r\n",
        grouped.as_str()
    )))
}

/// Asks where to save the recovery-key file. It blocks until the dialog closes, so it must
/// run off the main thread (see `commands::threads`).
pub fn pick_recovery_key_destination<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_file_name("مفتاح-استرداد-ليجال-مصر.txt")
        .add_filter("نص (Text)", &["txt"])
        .blocking_save_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

pub fn save_recovery_key(destination: &Path, document: &str) -> Result<(), Error> {
    fs::write(destination, document.as_bytes())?;
    vault_operation::sync_file(destination)
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
    state.advance_generation();
    state.clear_restore_selection()?;
    *state.master_key.lock().map_err(|_| Error::Locked)? = Some(master);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_recovery_key_file_shows_the_key_in_groups_and_refuses_anything_else() {
        let key = "0123456789abcdef".repeat(4);
        let document = recovery_key_document(&key).unwrap();
        assert!(document.starts_with('\u{feff}'));
        assert!(document
            .contains("01234567 89abcdef 01234567 89abcdef 01234567 89abcdef 01234567 89abcdef"));
        // The grouped form the app shows is accepted as typed or pasted.
        assert_eq!(
            recovery_key_document(
                "01234567 89abcdef-01234567 89abcdef 01234567 89abcdef 01234567 89abcdef"
            )
            .unwrap()
            .as_str(),
            document.as_str()
        );
        for bad in [
            "",
            "not a key",
            &key[..63],
            &format!("{key}0"),
            &"zz".repeat(32),
        ] {
            assert!(matches!(recovery_key_document(bad), Err(Error::Validation)));
        }
    }

    #[test]
    fn a_saved_recovery_key_file_holds_exactly_the_document() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("مفتاح.txt");
        let document = recovery_key_document(&"ab".repeat(32)).unwrap();
        save_recovery_key(&path, &document).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), document.as_str());
        assert!(save_recovery_key(&folder.path().join("missing/x.txt"), &document).is_err());
    }
    use std::path::PathBuf;

    #[test]
    fn lock_clears_the_master_key_and_pending_document_sources() {
        let state = AppState::default();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let token = state
            .store_document_source(PathBuf::from("/selected-by-native-dialog.pdf"))
            .unwrap();
        let backup = state
            .store_restore_selection(PathBuf::from("/chosen.lmsbackup"))
            .unwrap();

        lock(&state).unwrap();

        assert!(matches!(state.unlocked(), Err(Error::Locked)));
        assert!(matches!(
            state.peek_restore_selection(&backup),
            Err(Error::Validation)
        ));
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
