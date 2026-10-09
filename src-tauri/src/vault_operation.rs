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
    /// Intents written before these fields existed always had a database to
    /// preserve and never replaced `security.json`.
    #[serde(default = "default_true")]
    had_database: bool,
    #[serde(default)]
    had_security: bool,
    #[serde(default)]
    adopt_security: bool,
}

fn default_true() -> bool {
    true
}

pub fn pending(root: &Path) -> bool {
    root.join(JOURNAL).exists()
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
    fn an_intent_written_before_the_security_fields_existed_still_recovers() {
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
        recover(root).unwrap();
        assert_eq!(
            fs::read(root.join("legalmaster.sqlite")).unwrap(),
            b"new db"
        );
        assert_eq!(
            fs::read(root.join("security.json")).unwrap(),
            b"old security"
        );
        assert_eq!(
            fs::read(snapshot.join("database.sqlite")).unwrap(),
            b"old db"
        );
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
