use crate::{
    backup, db,
    dto::{
        BackupSelectionDto, LatestSuccessfulBackupDto, PreparedBackupDto, RestoreCredentialInput,
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
use tauri_plugin_dialog::DialogExt;

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    stamp: &str,
) -> Result<String, Error> {
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
        stamp,
    );
    match result {
        Ok(path) => {
            let size = std::fs::metadata(&path)
                .ok()
                .map(|metadata| metadata.len() as i64);
            backup_repository::finish(&connection, &history_id, true, size, None, &db::now())?;
            Ok(file_name(std::path::Path::new(&path)))
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

use std::path::{Path, PathBuf};
use tauri_plugin_opener::OpenerExt;
const BACKUP_EXTENSION: &str = "lmsbackup";
fn backups_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    Ok(db::app_dir(app)?.join("Backups"))
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// The most recently written backup file in the app's Backups folder.
pub fn latest_file<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    latest_in(&backups_dir(app)?)
}

fn latest_in(folder: &Path) -> Result<PathBuf, Error> {
    let entries = match std::fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(Error::BackupMissing)
        }
        Err(error) => return Err(error.into()),
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == BACKUP_EXTENSION))
        .filter_map(|path| Some((std::fs::metadata(&path).ok()?.modified().ok()?, path)))
        .max_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)))
        .map(|(_, path)| path)
        .ok_or(Error::BackupMissing)
}

/// Shows the latest backup selected in the system file manager, so the lawyer can copy it.
pub fn reveal_latest<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    state.unlocked()?;
    let path = latest_file(app)?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|_| Error::Operation)
}

/// Asks where to save a copy of the latest backup (a flash drive, another disk). It blocks
/// until the dialog closes, so it must run off the main thread (see `commands::threads`).
pub fn pick_copy_destination<R: Runtime>(
    app: &AppHandle<R>,
    suggested_name: &str,
) -> Result<PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    if let Some(path) = crate::desktop_e2e::selection("save-backup")? {
        return Ok(path);
    }
    app.dialog()
        .file()
        .set_file_name(suggested_name)
        .add_filter(
            "نسخة ليجال مصر الاحتياطية (Legal Masr backup)",
            &[BACKUP_EXTENSION],
        )
        .blocking_save_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

/// Copies `source` to `destination` (adding the backup extension if the name lacks it) and
/// checks the copy byte for byte. Returns the copy's file name.
pub fn save_copy(source: &Path, destination: &Path) -> Result<String, Error> {
    let destination = if destination
        .extension()
        .is_some_and(|ext| ext == BACKUP_EXTENSION)
    {
        destination.to_path_buf()
    } else {
        destination.with_extension(BACKUP_EXTENSION)
    };
    if destination == source {
        return Ok(file_name(&destination));
    }
    let temporary = destination.with_extension(format!("{}.copying", uuid::Uuid::new_v4()));
    let result = (|| -> Result<(), Error> {
        let mut target = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        std::io::copy(&mut std::fs::File::open(source)?, &mut target)?;
        target.sync_all()?;
        vault_operation::sync_file(&temporary)?;
        if std::fs::read(&temporary)? != std::fs::read(source)? {
            return Err(Error::Operation);
        }
        std::fs::rename(&temporary, &destination)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result.map(|()| file_name(&destination))
}

/// Shows the native picker for a backup file. It blocks until the dialog closes, so it
/// must run off the main thread (see `commands::threads`).
pub fn pick_backup<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    if let Some(path) = crate::desktop_e2e::selection("backup")? {
        return Ok(path);
    }
    app.dialog()
        .file()
        .add_filter(
            "نسخة ليجال مصر الاحتياطية (Legal Masr backup)",
            &[BACKUP_EXTENSION],
        )
        .blocking_pick_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

pub fn ensure_restore_allowed<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<(), Error> {
    if vault_operation::pending(&db::app_dir(app)?) {
        return Err(Error::VaultInterrupted);
    }
    let (security_path, db_path) = db::paths(app)?;
    if security_path.is_file() && db_path.is_file() && std::fs::metadata(db_path)?.len() > 0 {
        state.unlocked()?;
    }
    Ok(())
}

pub fn select<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    path: PathBuf,
    request: u64,
) -> Result<BackupSelectionDto, Error> {
    ensure_restore_allowed(app, state)?;
    backup::inspect(&path.to_string_lossy())?;
    let file_name = file_name(&path);
    let token = state.finish_restore_selection(request, path)?;
    Ok(BackupSelectionDto { token, file_name })
}

pub fn prepare<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    token: &str,
    input: Option<&RestoreCredentialInput>,
) -> Result<PreparedBackupDto, Error> {
    let generation = state.generation();
    ensure_restore_allowed(app, state)?;
    let path = state.peek_restore_selection(token)?;
    let active_master = state.unlocked().ok();
    let credential = input.map(|input| match input.kind {
        RestoreCredentialKind::Password => backup::Credential::Password(&input.secret),
        RestoreCredentialKind::RecoveryKey => backup::Credential::RecoveryKey(&input.secret),
    });
    if let Some(input) = input {
        if matches!(input.kind, RestoreCredentialKind::RecoveryKey)
            && (input.new_password != input.confirm_password
                || input
                    .new_password
                    .as_ref()
                    .is_none_or(|p| p.chars().count() < 12))
        {
            return Err(Error::Validation);
        }
    }
    let prepared = backup::prepare(
        &db::app_dir(app)?,
        &path.to_string_lossy(),
        active_master.as_deref(),
        credential,
        input.and_then(|i| i.new_password.as_deref()),
    )?;
    let result = PreparedBackupDto {
        token: uuid::Uuid::new_v4().to_string(),
        created_at: prepared.created_at.clone(),
        document_count: prepared.document_count,
        password_source: prepared.password_source.to_owned(),
    };
    state.store_prepared_restore(token, generation, result.token.clone(), prepared)?;
    Ok(result)
}

pub fn commit<R: Runtime>(app: &AppHandle<R>, state: &AppState, token: &str) -> Result<(), Error> {
    ensure_restore_allowed(app, state)?;
    let prepared = state.take_prepared_restore(token)?;
    let (_, active_db) = db::paths(app)?;
    let result = backup::commit(&active_db, &db::app_dir(app)?.join("attachments"), prepared);
    state.clear_restore_selection()?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_latest_backup_is_the_most_recently_written_one() {
        let folder = tempfile::tempdir().unwrap();
        assert!(matches!(
            latest_in(folder.path()),
            Err(Error::BackupMissing)
        ));
        assert!(matches!(
            latest_in(&folder.path().join("missing")),
            Err(Error::BackupMissing)
        ));
        let older = folder
            .path()
            .join("LegalMasr-backup-2026-10-08-1052.lmsbackup");
        std::fs::write(&older, b"older").unwrap();
        std::fs::write(folder.path().join("notes.txt"), b"not a backup").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        let newer = folder
            .path()
            .join("LegalMasr-backup-2026-10-09-0900.lmsbackup");
        std::fs::write(&newer, b"newer").unwrap();
        assert_eq!(latest_in(folder.path()).unwrap(), newer);
    }

    #[test]
    fn a_saved_copy_is_byte_identical_and_named_as_a_backup() {
        let folder = tempfile::tempdir().unwrap();
        let source = folder
            .path()
            .join("LegalMasr-backup-2026-10-08-1052.lmsbackup");
        std::fs::write(&source, b"encrypted backup bytes").unwrap();
        let usb = folder.path().join("usb");
        std::fs::create_dir(&usb).unwrap();

        let name = save_copy(&source, &usb.join("مكتب سامي")).unwrap();
        assert_eq!(name, "مكتب سامي.lmsbackup");
        assert_eq!(
            std::fs::read(usb.join("مكتب سامي.lmsbackup")).unwrap(),
            b"encrypted backup bytes"
        );
        assert!(!usb.join("مكتب سامي.copying").exists());
    }

    #[test]
    fn a_failed_copy_leaves_nothing_behind() {
        let folder = tempfile::tempdir().unwrap();
        let missing = folder.path().join("missing.lmsbackup");
        let destination = folder.path().join("copy.lmsbackup");
        assert!(save_copy(&missing, &destination).is_err());
        assert!(!destination.exists());
        assert_eq!(std::fs::read_dir(folder.path()).unwrap().count(), 0);
    }
    #[test]
    fn failed_publication_keeps_existing_destination_and_removes_temporary_copy() {
        let folder = tempfile::tempdir().unwrap();
        let source = folder.path().join("source.lmsbackup");
        std::fs::write(&source, b"synthetic encrypted bytes").unwrap();
        let destination = folder.path().join("destination.lmsbackup");
        std::fs::create_dir(&destination).unwrap();
        std::fs::write(destination.join("kept"), b"keep").unwrap();
        assert!(save_copy(&source, &destination).is_err());
        assert_eq!(std::fs::read(destination.join("kept")).unwrap(), b"keep");
        assert_eq!(std::fs::read_dir(folder.path()).unwrap().count(), 2);
    }
}
