//! Durable, native-owned setup/restore replacement. An immutable intent file is
//! flushed before the first live rename. Recovery rolls forward idempotently;
//! failures retain both staged data and the old generation for the next attempt.
use crate::errors::Error;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
};

const DELETE_JOURNAL: &str = "vault-delete.json";

const JOURNAL: &str = "vault-operation.json";

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Setup,
    Restore,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Intent {
    version: u8,
    id: String,
    kind: Kind,
    database: String,
    attachments: String,
    had_attachments: bool,
    had_database: bool,
    had_security: bool,
    adopt_security: bool,
}

pub fn pending(root: &Path) -> bool {
    root.join(JOURNAL).exists() || deletion_pending(root)
}

/// Unix directory fsync makes rename/unlink durable. Windows directory flush
/// support must be verified on supported devices; file contents are flushed on
/// all targets. Do not claim power-loss durability on Windows from Linux tests.
pub fn sync_directory(path: &Path) -> Result<(), Error> {
    #[cfg(unix)]
    fs::File::open(path)?.sync_all()?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

pub fn sync_file(path: &Path) -> Result<(), Error> {
    fs::OpenOptions::new().write(true).open(path)?.sync_all()?;
    Ok(())
}

fn basename(path: &Path) -> Result<String, Error> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(Error::VaultIncomplete)?;
    check_name(name)?;
    Ok(name.to_owned())
}

fn check_name(name: &str) -> Result<(), Error> {
    if name.is_empty()
        || name.contains(['/', '\\', ':'])
        || !matches!(
            Path::new(name).components().next(),
            Some(Component::Normal(_))
        )
        || Path::new(name).components().count() != 1
    {
        return Err(Error::VaultIncomplete);
    }
    Ok(())
}

fn write_intent(root: &Path, intent: &Intent) -> Result<(), Error> {
    let bytes = serde_json::to_vec(intent)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join(JOURNAL))?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    sync_directory(root)
}

fn flush_tree(root: &Path) -> Result<(), Error> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            return Err(Error::VaultIncomplete);
        }
        sync_file(&entry.path())?;
    }
    sync_directory(root)
}

pub fn install_setup(root: &Path) -> Result<(), Error> {
    sync_file(&root.join("legalmaster.tmp"))?;
    sync_file(&root.join("security.tmp"))?;
    sync_directory(root)?;
    write_intent(
        root,
        &Intent {
            version: 1,
            id: uuid::Uuid::new_v4().to_string(),
            kind: Kind::Setup,
            database: "legalmaster.sqlite".into(),
            attachments: "attachments".into(),
            had_attachments: false,
            had_database: false,
            had_security: false,
            adopt_security: false,
        },
    )?;
    recover(root)
}

/// Replaces the vault database and attachments with the staged `*.restore.tmp`
/// copies. With `adopt_security` a staged `security.restore.tmp` replaces
/// `security.json` too (a backup from another installation brings its own
/// password and recovery envelopes). Whatever existed is moved, never deleted,
/// into `EmergencySnapshots/<operation-id>/`; missing pieces (a fresh or
/// incomplete installation) are skipped.
pub fn install_restore(
    active: &Path,
    attachments: &Path,
    adopt_security: bool,
) -> Result<(), Error> {
    let root = active.parent().ok_or(Error::VaultIncomplete)?;
    if attachments.parent() != Some(root) {
        return Err(Error::VaultIncomplete);
    }
    let intent = Intent {
        version: 1,
        id: uuid::Uuid::new_v4().to_string(),
        kind: Kind::Restore,
        database: basename(active)?,
        attachments: basename(attachments)?,
        had_attachments: attachments.exists(),
        had_database: active.exists(),
        had_security: root.join("security.json").exists(),
        adopt_security,
    };
    sync_file(&active.with_extension("restore.tmp"))?;
    flush_tree(&attachments.with_extension("restore.tmp"))?;
    if adopt_security {
        sync_file(&root.join("security.restore.tmp"))?;
    }
    let snapshots = root.join("EmergencySnapshots");
    let snapshot = snapshots.join(&intent.id);
    let preserves_something = intent.had_database || intent.had_attachments || intent.had_security;
    if preserves_something {
        fs::create_dir_all(&snapshots)?;
        fs::create_dir(&snapshot)?;
    }
    let security = root.join("security.json");
    // A kept security file is copied now; a replaced one is moved during
    // recovery, where the move can be resumed after an interruption.
    if intent.had_security && !adopt_security {
        let preserved = snapshot.join("security.json");
        fs::copy(security, &preserved)?;
        sync_file(&preserved)?;
    }
    if preserves_something {
        sync_directory(&snapshot)?;
        sync_directory(&snapshots)?;
    }
    sync_directory(root)?;
    write_intent(root, &intent)?;
    recover(root)
}

fn move_if_staged(staged: &Path, active: &Path) -> Result<(), Error> {
    if staged.exists() {
        // Refuse unexpected live artifacts rather than replacing them. Recovery
        // owns only names declared in the previously flushed operation intent.
        if active.exists() {
            return Err(Error::VaultIncomplete);
        }
        fs::rename(staged, active)?;
        sync_directory(active.parent().ok_or(Error::VaultIncomplete)?)?;
    } else if !active.exists() {
        return Err(Error::VaultIncomplete);
    }
    Ok(())
}

pub fn recover(root: &Path) -> Result<(), Error> {
    if deletion_pending(root) {
        let (_, failed) = finish_delete(root)?;
        if failed > 0 {
            return Err(Error::VaultInterrupted);
        }
    }
    recover_with_checkpoint(root, |_| Ok(()))
}

fn recover_with_checkpoint(
    root: &Path,
    mut checkpoint: impl FnMut(u8) -> Result<(), Error>,
) -> Result<(), Error> {
    let journal = root.join(JOURNAL);
    if !journal.exists() {
        return Ok(());
    }
    if fs::metadata(&journal)?.len() > 65_536 {
        return Err(Error::VaultIncomplete);
    }
    let intent: Intent =
        serde_json::from_slice(&fs::read(&journal)?).map_err(|_| Error::VaultIncomplete)?;
    if intent.version != 1 || uuid::Uuid::parse_str(&intent.id).is_err() {
        return Err(Error::VaultIncomplete);
    }
    check_name(&intent.database)?;
    check_name(&intent.attachments)?;
    let active = root.join(&intent.database);
    let documents = root.join(&intent.attachments);
    match intent.kind {
        Kind::Setup => {
            if intent.database != "legalmaster.sqlite" || intent.attachments != "attachments" {
                return Err(Error::VaultIncomplete);
            }
            move_if_staged(&root.join("legalmaster.tmp"), &active)?;
            checkpoint(1)?;
            move_if_staged(&root.join("security.tmp"), &root.join("security.json"))?;
            checkpoint(2)?;
            fs::create_dir_all(&documents)?;
            fs::create_dir_all(root.join("Backups"))?;
            sync_directory(root)?;
        }
        Kind::Restore => {
            let snapshot: PathBuf = root.join("EmergencySnapshots").join(&intent.id);
            let old_db = snapshot.join("database.sqlite");
            let old_documents = snapshot.join("attachments");
            let old_security = snapshot.join("security.json");
            let active_security = root.join("security.json");
            if intent.had_database && !old_db.exists() {
                // The staged DB must still exist before admitting the first
                // destructive rename. A damaged intent cannot consume a vault.
                if !active.with_extension("restore.tmp").is_file() {
                    return Err(Error::VaultIncomplete);
                }
                fs::create_dir_all(&snapshot)?;
                fs::rename(&active, &old_db)?;
                sync_directory(&snapshot)?;
                sync_directory(root)?;
            }
            checkpoint(1)?;
            if intent.had_attachments && !old_documents.exists() {
                if !documents.with_extension("restore.tmp").is_dir() {
                    return Err(Error::VaultIncomplete);
                }
                fs::create_dir_all(&snapshot)?;
                fs::rename(&documents, &old_documents)?;
                sync_directory(&snapshot)?;
                sync_directory(root)?;
            }
            if intent.adopt_security && intent.had_security && !old_security.exists() {
                if !root.join("security.restore.tmp").is_file() {
                    return Err(Error::VaultIncomplete);
                }
                fs::create_dir_all(&snapshot)?;
                fs::rename(&active_security, &old_security)?;
                sync_directory(&snapshot)?;
                sync_directory(root)?;
            }
            checkpoint(2)?;
            move_if_staged(&documents.with_extension("restore.tmp"), &documents)?;
            checkpoint(3)?;
            move_if_staged(&active.with_extension("restore.tmp"), &active)?;
            if intent.adopt_security {
                move_if_staged(&root.join("security.restore.tmp"), &active_security)?;
            }
            fs::create_dir_all(root.join("Backups"))?;
            checkpoint(4)?;
        }
    }
    checkpoint(5)?;
    fs::remove_file(journal)?;
    sync_directory(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_setup_interruption_recovers_a_complete_pair() {
        for stop in [1, 2, 5] {
            let temp = tempfile::tempdir().unwrap();
            let root = temp.path();
            fs::write(root.join("legalmaster.tmp"), b"new db").unwrap();
            fs::write(root.join("security.tmp"), b"new security").unwrap();
            write_intent(
                root,
                &Intent {
                    version: 1,
                    id: uuid::Uuid::new_v4().to_string(),
                    kind: Kind::Setup,
                    database: "legalmaster.sqlite".into(),
                    attachments: "attachments".into(),
                    had_attachments: false,
                    had_database: false,
                    had_security: false,
                    adopt_security: false,
                },
            )
            .unwrap();
            let _ = recover_with_checkpoint(root, |step| {
                if step == stop {
                    Err(Error::Operation)
                } else {
                    Ok(())
                }
            });
            recover(root).unwrap();
            recover(root).unwrap();
            assert_eq!(
                fs::read(root.join("legalmaster.sqlite")).unwrap(),
                b"new db"
            );
            assert_eq!(
                fs::read(root.join("security.json")).unwrap(),
                b"new security"
            );
            assert!(!pending(root));
        }
    }

    #[test]
    fn every_restore_interruption_preserves_old_and_installs_new() {
        for had_attachments in [true, false] {
            for stop in 1..=5 {
                let temp = tempfile::tempdir().unwrap();
                let root = temp.path();
                let id = uuid::Uuid::new_v4().to_string();
                let snapshot = root.join("EmergencySnapshots").join(&id);
                fs::create_dir_all(&snapshot).unwrap();
                fs::write(root.join("legalmaster.sqlite"), b"old db").unwrap();
                fs::write(root.join("legalmaster.restore.tmp"), b"new db").unwrap();
                fs::write(root.join("security.json"), b"old security").unwrap();
                fs::write(snapshot.join("security.json"), b"old security").unwrap();
                if had_attachments {
                    fs::create_dir(root.join("attachments")).unwrap();
                    fs::write(root.join("attachments/later.pdf"), b"post-backup file").unwrap();
                }
                fs::create_dir(root.join("attachments.restore.tmp")).unwrap();
                fs::write(
                    root.join("attachments.restore.tmp/original.pdf"),
                    b"snapshot file",
                )
                .unwrap();
                write_intent(
                    root,
                    &Intent {
                        version: 1,
                        id,
                        kind: Kind::Restore,
                        database: "legalmaster.sqlite".into(),
                        attachments: "attachments".into(),
                        had_attachments,
                        had_database: true,
                        had_security: true,
                        adopt_security: false,
                    },
                )
                .unwrap();
                assert!(recover_with_checkpoint(root, |step| if step == stop {
                    Err(Error::Operation)
                } else {
                    Ok(())
                })
                .is_err());
                recover(root).unwrap();
                recover(root).unwrap();
                assert_eq!(
                    fs::read(root.join("legalmaster.sqlite")).unwrap(),
                    b"new db"
                );
                assert_eq!(
                    fs::read(root.join("attachments/original.pdf")).unwrap(),
                    b"snapshot file"
                );
                assert_eq!(
                    fs::read(snapshot.join("database.sqlite")).unwrap(),
                    b"old db"
                );
                assert_eq!(
                    fs::read(snapshot.join("security.json")).unwrap(),
                    b"old security"
                );
                if had_attachments {
                    assert_eq!(
                        fs::read(snapshot.join("attachments/later.pdf")).unwrap(),
                        b"post-backup file"
                    );
                }
                assert!(!pending(root));
            }
        }
    }

    #[test]
    fn malformed_or_path_escape_intents_leave_active_contents_untouched() {
        for journal in [
            "{}",
            r#"{"version":1,"id":"00000000-0000-0000-0000-000000000000","kind":"Restore","database":"../outside","attachments":"attachments","had_attachments":true}"#,
        ] {
            let temp = tempfile::tempdir().unwrap();
            fs::write(temp.path().join("legalmaster.sqlite"), b"old db").unwrap();
            fs::write(temp.path().join(JOURNAL), journal).unwrap();
            assert!(recover(temp.path()).is_err());
            assert_eq!(
                fs::read(temp.path().join("legalmaster.sqlite")).unwrap(),
                b"old db"
            );
            assert!(pending(temp.path()));
        }
    }

    #[test]
    fn blocked_rename_retains_the_intent_and_both_generations() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        fs::write(root.join("legalmaster.tmp"), b"new db").unwrap();
        fs::write(root.join("security.tmp"), b"new security").unwrap();
        fs::write(root.join("legalmaster.sqlite"), b"unexpected live db").unwrap();
        assert!(install_setup(root).is_err());
        assert_eq!(
            fs::read(root.join("legalmaster.sqlite")).unwrap(),
            b"unexpected live db"
        );
        assert_eq!(fs::read(root.join("legalmaster.tmp")).unwrap(), b"new db");
        assert!(pending(root));
    }

    /// Replaces whatever was there, in every combination of what existed and
    /// whether the archive's security file is adopted, at every interruption.
    #[test]
    fn every_interrupted_replacement_of_database_attachments_and_security_rolls_forward() {
        for had_database in [true, false] {
            for had_attachments in [true, false] {
                for had_security in [true, false] {
                    for adopt_security in [true, false] {
                        for stop in 1..=5 {
                            let temp = tempfile::tempdir().unwrap();
                            let root = temp.path();
                            let id = uuid::Uuid::new_v4().to_string();
                            let snapshot = root.join("EmergencySnapshots").join(&id);
                            if had_database {
                                fs::write(root.join("legalmaster.sqlite"), b"old db").unwrap();
                            }
                            if had_attachments {
                                fs::create_dir(root.join("attachments")).unwrap();
                                fs::write(root.join("attachments/old.pdf"), b"old file").unwrap();
                            }
                            if had_security {
                                fs::write(root.join("security.json"), b"old security").unwrap();
                                if !adopt_security {
                                    fs::create_dir_all(&snapshot).unwrap();
                                    fs::write(snapshot.join("security.json"), b"old security")
                                        .unwrap();
                                }
                            }
                            fs::write(root.join("legalmaster.restore.tmp"), b"new db").unwrap();
                            fs::create_dir(root.join("attachments.restore.tmp")).unwrap();
                            fs::write(root.join("attachments.restore.tmp/new.pdf"), b"new file")
                                .unwrap();
                            if adopt_security {
                                fs::write(root.join("security.restore.tmp"), b"new security")
                                    .unwrap();
                            }
                            write_intent(
                                root,
                                &Intent {
                                    version: 1,
                                    id,
                                    kind: Kind::Restore,
                                    database: "legalmaster.sqlite".into(),
                                    attachments: "attachments".into(),
                                    had_attachments,
                                    had_database,
                                    had_security,
                                    adopt_security,
                                },
                            )
                            .unwrap();
                            let _ = recover_with_checkpoint(root, |step| {
                                if step == stop {
                                    Err(Error::Operation)
                                } else {
                                    Ok(())
                                }
                            });
                            recover(root).unwrap();
                            recover(root).unwrap();
                            let case = format!(
                                "db={had_database} files={had_attachments} security={had_security} adopt={adopt_security} stop={stop}"
                            );
                            assert_eq!(
                                fs::read(root.join("legalmaster.sqlite")).unwrap(),
                                b"new db",
                                "{case}"
                            );
                            assert_eq!(
                                fs::read(root.join("attachments/new.pdf")).unwrap(),
                                b"new file",
                                "{case}"
                            );
                            assert!(!root.join("attachments/old.pdf").exists(), "{case}");
                            let expected_security: Option<&[u8]> = if adopt_security {
                                Some(b"new security")
                            } else if had_security {
                                Some(b"old security")
                            } else {
                                None
                            };
                            assert_eq!(
                                fs::read(root.join("security.json")).ok().as_deref(),
                                expected_security,
                                "{case}"
                            );
                            if had_database {
                                assert_eq!(
                                    fs::read(snapshot.join("database.sqlite")).unwrap(),
                                    b"old db",
                                    "{case}"
                                );
                            }
                            if had_attachments {
                                assert_eq!(
                                    fs::read(snapshot.join("attachments/old.pdf")).unwrap(),
                                    b"old file",
                                    "{case}"
                                );
                            }
                            if had_security {
                                assert_eq!(
                                    fs::read(snapshot.join("security.json")).unwrap(),
                                    b"old security",
                                    "{case}"
                                );
                            }
                            assert!(root.join("Backups").is_dir(), "{case}");
                            assert!(!root.join("security.restore.tmp").exists(), "{case}");
                            assert!(!pending(root), "{case}");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn an_incomplete_intent_is_refused_without_changing_live_files() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        let id = uuid::Uuid::new_v4().to_string();
        let snapshot = root.join("EmergencySnapshots").join(&id);
        fs::create_dir_all(&snapshot).unwrap();
        fs::write(snapshot.join("security.json"), b"old security").unwrap();
        fs::write(root.join("security.json"), b"old security").unwrap();
        fs::write(root.join("legalmaster.sqlite"), b"old db").unwrap();
        fs::write(root.join("legalmaster.restore.tmp"), b"new db").unwrap();
        fs::create_dir(root.join("attachments.restore.tmp")).unwrap();
        fs::write(
            root.join(JOURNAL),
            format!(
                r#"{{"version":1,"id":"{id}","kind":"Restore","database":"legalmaster.sqlite","attachments":"attachments","had_attachments":false}}"#
            ),
        )
        .unwrap();
        assert!(recover(root).is_err());
        assert_eq!(
            fs::read(root.join("legalmaster.sqlite")).unwrap(),
            b"old db"
        );
        assert_eq!(
            fs::read(root.join("security.json")).unwrap(),
            b"old security"
        );
        assert_eq!(
            fs::read(root.join("legalmaster.restore.tmp")).unwrap(),
            b"new db"
        );
        assert!(pending(root));
    }

    #[test]
    fn a_journal_with_fields_this_build_does_not_know_fails_closed() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("legalmaster.sqlite"), b"live").unwrap();
        fs::write(
            temp.path().join(JOURNAL),
            r#"{"version":1,"id":"00000000-0000-0000-0000-000000000000","kind":"Restore","database":"legalmaster.sqlite","attachments":"attachments","had_attachments":false,"from_the_future":true}"#,
        )
        .unwrap();
        assert!(recover(temp.path()).is_err());
        assert_eq!(
            fs::read(temp.path().join("legalmaster.sqlite")).unwrap(),
            b"live"
        );
        assert!(pending(temp.path()));
    }
}

// Whole-vault reset uses the same native recovery boundary as setup/restore.
// The fixed marker contains no credentials, legal records or document paths.
pub fn deletion_pending(root: &Path) -> bool {
    root.join(DELETE_JOURNAL).exists()
}

pub fn begin_delete(root: &Path) -> Result<(), Error> {
    if pending(root) {
        return Err(Error::VaultInterrupted);
    }
    let mut marker = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join(DELETE_JOURNAL))?;
    marker.write_all(b"{\"version\":1,\"kind\":\"DeleteAll\"}")?;
    marker.sync_all()?;
    sync_directory(root)
}
pub fn cancel_delete(root: &Path) -> Result<(), Error> {
    fs::remove_file(root.join(DELETE_JOURNAL))?;
    sync_directory(root)
}
fn is_vault_artifact(name: &str) -> bool {
    name.starts_with("legalmaster.")
        || name.starts_with("security.")
        || name.starts_with("attachments")
        || matches!(
            name,
            "Backups" | "EmergencySnapshots" | "vault-operation.json"
        )
}
pub(crate) fn count_files(path: &Path) -> Result<u64, Error> {
    let meta = fs::symlink_metadata(path)?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Ok(1);
    }
    let mut count = 0;
    for entry in fs::read_dir(path)? {
        count += count_files(&entry?.path())?;
    }
    Ok(count)
}
pub fn deletion_file_count(root: &Path) -> Result<u64, Error> {
    let mut count = 0;
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if is_vault_artifact(&entry.file_name().to_string_lossy()) {
            count += count_files(&entry.path())?;
        }
    }
    Ok(count)
}
fn remove_tree(
    path: &Path,
    managed: bool,
    remove: &impl Fn(&Path) -> std::io::Result<()>,
) -> (u64, u64) {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return (0, 0),
        Err(_) => return (0, 1),
    };
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return if remove(path).is_ok() {
            (0, 0)
        } else {
            (u64::from(managed), 1)
        };
    }
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return (0, 1),
    };
    let mut failed = (0, 0);
    for entry in entries {
        match entry {
            Ok(entry) => {
                let result = remove_tree(&entry.path(), managed, remove);
                failed.0 += result.0;
                failed.1 += result.1;
            }
            Err(_) => failed.1 += 1,
        }
    }
    if failed.1 == 0 && fs::remove_dir(path).is_err() {
        failed.1 += 1;
    }
    failed
}
/// Idempotent after a crash or file-sharing failure. Never follows directory
/// symlinks; unknown files and the running diagnostic logger are outside the vault.
pub fn finish_delete(root: &Path) -> Result<(u64, u64), Error> {
    finish_delete_with(root, &|path| fs::remove_file(path))
}
fn finish_delete_with(
    root: &Path,
    remove: &impl Fn(&Path) -> std::io::Result<()>,
) -> Result<(u64, u64), Error> {
    if !deletion_pending(root) {
        return Err(Error::Validation);
    }
    let marker = match fs::read(root.join(DELETE_JOURNAL)) {
        Ok(bytes) => bytes,
        Err(_) => return Ok((0, 1)),
    };
    if marker != b"{\"version\":1,\"kind\":\"DeleteAll\"}" {
        return Err(Error::VaultIncomplete);
    }
    let mut failed = (0, 0);
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return Ok((0, 1)),
    };
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                failed.1 += 1;
                continue;
            }
        };
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if is_vault_artifact(&name) {
            let result = remove_tree(&entry.path(), name.starts_with("attachments"), remove);
            failed.0 += result.0;
            failed.1 += result.1;
        }
    }
    if failed.1 == 0 && (sync_directory(root).is_err() || cancel_delete(root).is_err()) {
        failed.1 += 1;
    }
    Ok(failed)
}

#[cfg(test)]
mod deletion_tests {
    use super::*;
    #[test]
    fn whole_vault_file_failures_are_counted_and_recovery_retries_without_following_symlinks() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("attachments")).unwrap();
        fs::write(root.path().join("attachments/file.pdf"), b"test").unwrap();
        fs::write(root.path().join("legalmaster.sqlite"), b"db").unwrap();
        begin_delete(root.path()).unwrap();
        let result = finish_delete_with(root.path(), &|path| {
            if path.extension().is_some_and(|ext| ext == "pdf") {
                Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "injected",
                ))
            } else {
                fs::remove_file(path)
            }
        })
        .unwrap();
        assert_eq!(result, (1, 1));
        assert!(deletion_pending(root.path()));
        assert!(!root.path().join("legalmaster.sqlite").exists());
        recover(root.path()).unwrap();
        assert!(!deletion_pending(root.path()));
        assert!(!crate::db::has_vault_artifacts(root.path()).unwrap());
    }
    #[test]
    fn restart_finishes_an_authorized_reset_at_each_partial_unlink() {
        for removed in 0..3 {
            let root = tempfile::tempdir().unwrap();
            for name in [
                "legalmaster.sqlite",
                "security.json",
                "legalmaster.sqlite-wal",
            ] {
                fs::write(root.path().join(name), b"test").unwrap();
            }
            begin_delete(root.path()).unwrap();
            for name in [
                "legalmaster.sqlite",
                "security.json",
                "legalmaster.sqlite-wal",
            ]
            .iter()
            .take(removed)
            {
                fs::remove_file(root.path().join(name)).unwrap();
            }
            recover(root.path()).unwrap();
            recover(root.path()).unwrap();
            assert!(!crate::db::has_vault_artifacts(root.path()).unwrap());
        }
    }
    #[cfg(unix)]
    #[test]
    fn whole_reset_unlinks_symlinks_and_leaves_their_targets_untouched() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("keep.pdf"), b"keep").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.path().join("attachments")).unwrap();
        begin_delete(root.path()).unwrap();
        assert_eq!(finish_delete(root.path()).unwrap(), (0, 0));
        assert_eq!(fs::read(outside.path().join("keep.pdf")).unwrap(), b"keep");
    }
}
