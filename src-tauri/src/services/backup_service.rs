use crate::{
    backup, db,
    dto::{BackupSummaryDto, LatestSuccessfulBackupDto},
    errors::Error,
    repositories::backup_repository,
    security,
    services::{app_service, search_service},
    state::AppState,
    vault_operation,
};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use zeroize::Zeroizing;

const BACKUP_EXTENSION: &str = "lmsbackup";

fn backups_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    Ok(db::app_dir(app)?.join("Backups"))
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Creates a backup named after the lawyer's local `stamp` and returns its file name (never
/// its folder). The backup carries the vault's key envelope so a new installation can
/// restore it with the password or recovery key.
pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    stamp: &str,
) -> Result<String, Error> {
    let master = state.unlocked()?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let (security_path, db_path) = db::paths(app)?;
    let keyring = security::read_security(&security_path)?;
    let connection = db::open_db(&db_path, &master)?;
    let history_id = uuid::Uuid::new_v4().to_string();
    backup_repository::start(&connection, &history_id, &db::now())?;
    let destination = backups_dir(app)?;
    let documents = db::app_dir(app)?.join("attachments");
    let result = backup::create(
        &db_path,
        &master,
        &destination.to_string_lossy(),
        &documents,
        stamp,
        Some(&keyring),
    );
    match result {
        Ok(path) => {
            let size = std::fs::metadata(&path)
                .ok()
                .map(|metadata| metadata.len() as i64);
            backup_repository::finish(&connection, &history_id, true, size, None, &db::now())?;
            Ok(file_name(Path::new(&path)))
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
    let temporary = destination.with_extension("copying");
    let result = (|| -> Result<(), Error> {
        std::fs::copy(source, &temporary)?;
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

/// Checks a backup with this vault's key and describes it. A backup made by another
/// installation is reported as such instead of as damaged.
pub fn inspect<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    path: &Path,
) -> Result<BackupSummaryDto, Error> {
    let master = state.unlocked()?;
    match backup::summary(&path.to_string_lossy(), &master) {
        Ok(summary) => Ok(BackupSummaryDto {
            token: None,
            file_name: file_name(path),
            created_at: summary.created_at,
            document_count: summary.document_count,
        }),
        Err(Error::BackupInvalid) => {
            if let Ok(Some(keyring)) = backup::keyring(&path.to_string_lossy()) {
                let (security_path, _) = db::paths(app)?;
                let current = security::read_security(&security_path)?;
                if keyring.recovery_envelope != current.recovery_envelope {
                    return Err(Error::BackupFromOtherVault);
                }
            }
            Err(Error::BackupInvalid)
        }
        Err(error) => Err(error),
    }
}

/// Checks, before the picker opens, that a restore could run at all.
pub fn ensure_restorable<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    state.unlocked()?;
    let (security_path, _) = db::paths(app)?;
    security::read_security(&security_path)?;
    Ok(())
}

pub fn restore<R: Runtime>(app: &AppHandle<R>, state: &AppState, path: &Path) -> Result<(), Error> {
    let master = state.unlocked()?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let (security_path, active_db) = db::paths(app)?;
    security::read_security(&security_path)?;
    let documents = db::app_dir(app)?.join("attachments");
    if let Err(error) = backup::restore(&active_db, &master, &path.to_string_lossy(), &documents) {
        if vault_operation::pending(&db::app_dir(app)?) {
            app_service::lock(state)?;
            return Err(Error::VaultInterrupted);
        }
        return Err(error);
    }
    app_service::lock(state)
}

/// Checks, before the picker opens, that this is a new installation with no vault yet.
pub fn ensure_new_installation<R: Runtime>(app: &AppHandle<R>) -> Result<(), Error> {
    let root = db::app_dir(app)?;
    if root.exists() && db::has_vault_artifacts(&root)? {
        return Err(Error::Initialized);
    }
    Ok(())
}

/// Checks that a chosen file is a backup a new installation can open: one that carries
/// its key envelope (made by this version or later).
pub fn ensure_portable(path: &Path) -> Result<(), Error> {
    backup::keyring(&path.to_string_lossy())?.ok_or(Error::BackupNotPortable)?;
    Ok(())
}

/// How a backup is opened on a new installation: with the password in use when it was
/// made, or with the recovery key and a new password (the old one is forgotten).
pub enum BackupSecret<'a> {
    Password(&'a str),
    RecoveryKey { key: &'a str, new_password: &'a str },
}

/// Restores a backup onto a new installation (no vault yet). Both steps are journaled: an
/// empty vault sealed with the backup's own key envelope, then the ordinary restore into
/// it. The vault is left unlocked.
pub fn restore_new_vault<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    path: &Path,
    secret: BackupSecret<'_>,
    language: &str,
) -> Result<(), Error> {
    let valid = match secret {
        BackupSecret::Password(password) => !password.is_empty(),
        BackupSecret::RecoveryKey { key, new_password } => {
            !key.trim().is_empty() && new_password.chars().count() >= 12
        }
    };
    if !valid {
        return Err(Error::Validation);
    }
    let source = path.to_string_lossy();
    let keyring = backup::keyring(&source)?.ok_or(Error::BackupNotPortable)?;
    let master = Zeroizing::new(
        match secret {
            BackupSecret::Password(password) => security::master_from_password(&keyring, password),
            BackupSecret::RecoveryKey { key, .. } => {
                security::master_from_recovery_key(&keyring, key)
            }
        }
        .map_err(|_| Error::BackupSecretInvalid)?,
    );
    backup::validate(&source, &master)?;
    app_service::initialize_with_keyring(app, state, master.clone(), &keyring, language)?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let (security_path, active_db) = db::paths(app)?;
    let root = db::app_dir(app)?;
    if let Err(error) = backup::restore(&active_db, &master, &source, &root.join("attachments")) {
        app_service::lock(state)?;
        if vault_operation::pending(&root) {
            return Err(Error::VaultInterrupted);
        }
        // The restore rolled itself back; remove the empty vault made for it a moment ago
        // so the lawyer is back at the welcome screen, not in an empty office.
        discard_empty_vault(&root, &active_db, &security_path);
        return Err(error);
    }
    let _ = search_service::rebuild_with(&db::open_db(&active_db, &master)?);
    drop(_attachment_guard);
    if let BackupSecret::RecoveryKey { key, new_password } = secret {
        app_service::recover_access(app, state, key, new_password)?;
    }
    Ok(())
}

fn discard_empty_vault(root: &Path, db_path: &Path, security_path: &Path) {
    for path in [
        db_path.to_path_buf(),
        db_path.with_extension("sqlite-wal"),
        db_path.with_extension("sqlite-shm"),
        security_path.to_path_buf(),
    ] {
        let _ = std::fs::remove_file(path);
    }
    for folder in ["attachments", "EmergencySnapshots"] {
        let _ = std::fs::remove_dir_all(root.join(folder));
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
        assert!(!destination.with_extension("copying").exists());
    }
}
