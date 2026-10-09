use crate::{
    backup, db,
    dto::{
        BackupSelectionDto, LatestSuccessfulBackupDto, RestoreCredentialInput,
        RestoreCredentialKind,
    },
    errors::Error,
    repositories::backup_repository,
    security,
    services::app_service,
    state::AppState,
    vault_operation,
};
use tauri::{AppHandle, Runtime};
#[cfg(not(feature = "desktop-e2e"))]
use tauri_plugin_dialog::DialogExt;

pub fn create<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<String, Error> {
    let master = state.unlocked()?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let (security_path, db_path) = db::paths(app)?;
    // The backup carries the current password and recovery envelopes so it can be
    // opened without this installation. Read them once; do not hold the lock
    // for the whole backup, which would stall status checks.
    let security_file = {
        let _security_guard = state.lock_security_operations()?;
        security::recover_interrupted_security_write(&security_path)?;
        security::read_security(&security_path)?
    };
    let connection = db::open_db(&db_path, &master)?;
    let history_id = uuid::Uuid::new_v4().to_string();
    backup_repository::start(&connection, &history_id, &db::now())?;
    let data_dir = db::app_dir(app)?;
    let destination = data_dir.join("Backups");
    let documents = data_dir.join("attachments");
    let result = backup::create(
        &db_path,
        &master,
        &security_file,
        &destination.to_string_lossy(),
        &documents,
    );
    match result {
        Ok(path) => {
            let size = std::fs::metadata(&path)
                .ok()
                .map(|metadata| metadata.len() as i64);
            backup_repository::finish(&connection, &history_id, true, size, None, &db::now())?;
            Ok(path)
        }
        Err(error) => {
            backup_repository::finish(
                &connection,
                &history_id,
                false,
                None,
                Some(error.code()),
                &db::now(),
            )?;
            Err(error)
        }
    }
}

pub fn latest_successful<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<Option<LatestSuccessfulBackupDto>, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    backup_repository::latest_successful(&db::open_db(&db_path, &master)?)
}

fn choose_backup<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    {
        let _ = app;
        crate::desktop_e2e::selection("backup")
    }
    #[cfg(not(feature = "desktop-e2e"))]
    app.dialog()
        .file()
        .add_filter(
            "نسخة ليجال مصر الاحتياطية (Legal Masr backup)",
            &["lmsbackup"],
        )
        .blocking_pick_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

pub fn validate<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    let path = choose_backup(app)?;
    let master = state.unlocked()?;
    backup::validate(&path.to_string_lossy(), Some(&master), None)
}

pub fn restore<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    let master = state.unlocked()?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let _security_guard = state.lock_security_operations()?;
    let (security_path, active_db) = db::paths(app)?;
    security::recover_interrupted_security_write(&security_path)?;
    security::read_security(&security_path)?;
    let path = choose_backup(app)?;
    let documents = db::app_dir(app)?.join("attachments");
    finish_restore(
        app,
        state,
        backup::restore(
            &active_db,
            &documents,
            &path.to_string_lossy(),
            Some(&master),
            None,
        ),
    )
}

fn finish_restore<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    result: Result<(), Error>,
) -> Result<(), Error> {
    match result {
        Ok(()) => app_service::lock(state),
        Err(error) => {
            if vault_operation::pending(&db::app_dir(app)?) {
                app_service::lock(state)?;
                return Err(Error::VaultInterrupted);
            }
            Err(error)
        }
    }
}

/// Restoring is allowed on an empty or incomplete installation and on an
/// unlocked vault. A healthy locked vault cannot be replaced from the lock
/// screen, and a pending journal must finish first.
fn ensure_restore_allowed<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    let root = db::app_dir(app)?;
    if vault_operation::pending(&root) {
        return Err(Error::VaultInterrupted);
    }
    let (security_path, db_path) = db::paths(app)?;
    let complete =
        security_path.is_file() && db_path.is_file() && std::fs::metadata(&db_path)?.len() > 0;
    if complete {
        state.unlocked()?;
    }
    Ok(())
}

/// Opens the native picker and keeps the chosen path in Rust. The renderer gets
/// a one-time token and the file's format version, nothing else.
pub fn select_for_restore<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<BackupSelectionDto, Error> {
    ensure_restore_allowed(app, state)?;
    let path = choose_backup(app)?;
    let format_version = backup::inspect(&path.to_string_lossy())?;
    let token = state.store_restore_selection(path)?;
    Ok(BackupSelectionDto {
        token,
        format_version,
    })
}

pub fn restore_selected<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    token: &str,
    credential: &RestoreCredentialInput,
) -> Result<(), Error> {
    let active_master = state.unlocked().ok();
    let _attachment_guard = state.lock_attachment_operations()?;
    let _security_guard = state.lock_security_operations()?;
    ensure_restore_allowed(app, state)?;
    let path = state.peek_restore_selection(token)?;
    let (security_path, active_db) = db::paths(app)?;
    security::recover_interrupted_security_write(&security_path)?;
    let documents = db::app_dir(app)?.join("attachments");
    let credential = match credential.kind {
        RestoreCredentialKind::Password => backup::Credential::Password(&credential.secret),
        RestoreCredentialKind::RecoveryKey => backup::Credential::RecoveryKey(&credential.secret),
    };
    let result = backup::restore(
        &active_db,
        &documents,
        &path.to_string_lossy(),
        active_master.as_deref(),
        Some(credential),
    );
    // A mistyped secret keeps the selection so it can be retried without
    // choosing the file again; every other outcome ends it.
    if !matches!(result, Err(Error::InvalidPassword | Error::InvalidRecovery)) {
        state.clear_restore_selection()?;
    }
    finish_restore(app, state, result)
}
