use crate::{
    backup, db, dto::LatestSuccessfulBackupDto, errors::Error, repositories::backup_repository,
    services::app_service, state::AppState,
};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

pub fn create<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<String, Error> {
    let master = state.unlocked()?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let (_, db_path) = db::paths(app)?;
    let connection = db::open_db(&db_path, &master)?;
    let history_id = uuid::Uuid::new_v4().to_string();
    backup_repository::start(&connection, &history_id, &db::now())?;
    let data_dir = db::app_dir(app)?;
    let destination = data_dir.join("Backups");
    let documents = data_dir.join("attachments");
    let result = backup::create(
        &db_path,
        &master,
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

/// Shows the native picker for a backup file. It blocks until the dialog closes, so it
/// must run off the main thread (see `commands::threads`).
pub fn pick_backup<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    if let Some(path) = crate::desktop_e2e::selection("backup")? {
        return Ok(path);
    }
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

pub fn validate(state: &AppState, path: &std::path::Path) -> Result<(), Error> {
    let master = state.unlocked()?;
    backup::validate(&path.to_string_lossy(), &master)
}

/// Checks, before the picker opens, that a restore could run at all.
pub fn ensure_restorable<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    state.unlocked()?;
    let (security_path, _) = db::paths(app)?;
    crate::security::read_security(&security_path)?;
    Ok(())
}

pub fn restore<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    path: &std::path::Path,
) -> Result<(), Error> {
    let master = state.unlocked()?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let (security_path, active_db) = db::paths(app)?;
    crate::security::read_security(&security_path)?;
    let documents = db::app_dir(app)?.join("attachments");
    if let Err(error) = backup::restore(&active_db, &master, &path.to_string_lossy(), &documents) {
        if crate::vault_operation::pending(&db::app_dir(app)?) {
            app_service::lock(state)?;
            return Err(Error::VaultInterrupted);
        }
        return Err(error);
    }
    app_service::lock(state)
}
