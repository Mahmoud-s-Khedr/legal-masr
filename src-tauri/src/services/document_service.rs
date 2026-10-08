use crate::{
    db,
    dto::{
        AttachmentDto, AttachmentInput, AttachmentListInput, AttachmentSourceSelection,
        AttachmentUpdateInput,
    },
    errors::Error,
    repositories::document_repository,
    state::AppState,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use time::{format_description::BorrowedFormatItem, macros::format_description, Date};
use uuid::Uuid;
const CATEGORIES: &[&str] = &[
    "IDENTIFICATION",
    "POWER_OF_ATTORNEY",
    "CASE_FILE",
    "COURT_DECISION",
    "EVIDENCE",
    "RECEIPT",
    "CORRESPONDENCE",
    "OTHER",
];
const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
fn valid_date(value: Option<&str>) -> bool {
    value.is_none_or(|date| date.len() == 10 && Date::parse(date, DATE_FORMAT).is_ok())
}
fn clean(value: Option<String>) -> Option<String> {
    value.and_then(|value| (!value.trim().is_empty()).then(|| value.trim().to_owned()))
}
fn root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    let path = db::app_dir(app)?.join("attachments");
    fs::create_dir_all(&path)?;
    Ok(path)
}
fn validate_owner(input: &AttachmentInput) -> Result<(), Error> {
    let owners = [
        input.client_id.as_ref(),
        input.case_id.as_ref(),
        input.power_of_attorney_id.as_ref(),
        input.expense_id.as_ref(),
    ]
    .iter()
    .filter(|id| id.is_some())
    .count();
    if owners != 1
        || !CATEGORIES.contains(&input.category.as_str())
        || !valid_date(input.document_date.as_deref())
    {
        Err(Error::Validation)
    } else {
        Ok(())
    }
}
fn validate_owners(conn: &rusqlite::Connection, input: &AttachmentInput) -> Result<(), Error> {
    let exists = |table: &str, id: &str| {
        conn.query_row(
            &format!("SELECT 1 FROM {table} WHERE id = ?1"),
            [id],
            |_| Ok(()),
        )
        .is_ok()
    };
    if input
        .client_id
        .as_deref()
        .is_some_and(|id| !exists("clients", id))
    {
        return Err(Error::ClientNotFound);
    }
    if input
        .case_id
        .as_deref()
        .is_some_and(|id| !exists("cases", id))
    {
        return Err(Error::CaseNotFound);
    }
    if input
        .power_of_attorney_id
        .as_deref()
        .is_some_and(|id| !exists("powers_of_attorney", id))
    {
        return Err(Error::PowerOfAttorneyNotFound);
    }
    if input
        .expense_id
        .as_deref()
        .is_some_and(|id| !exists("expenses", id))
    {
        return Err(Error::ExpenseNotFound);
    }
    Ok(())
}

// Injectable operations keep failure tests deterministic without global hooks.
trait ManagedFiles {
    fn copy(&self, source: &Path, target: &Path) -> std::io::Result<u64>;
    fn read(&self, path: &Path) -> std::io::Result<Vec<u8>>;
    fn rename(&self, source: &Path, target: &Path) -> std::io::Result<()>;
    fn remove(&self, path: &Path) -> std::io::Result<()>;
}
struct NativeFiles;
impl ManagedFiles for NativeFiles {
    fn copy(&self, source: &Path, target: &Path) -> std::io::Result<u64> {
        fs::copy(source, target)
    }
    fn read(&self, path: &Path) -> std::io::Result<Vec<u8>> {
        fs::read(path)
    }
    fn rename(&self, source: &Path, target: &Path) -> std::io::Result<()> {
        fs::rename(source, target)
    }
    fn remove(&self, path: &Path) -> std::io::Result<()> {
        fs::remove_file(path)
    }
}
fn copy_bytes(
    files: &impl ManagedFiles,
    source: &Path,
    temporary: &Path,
) -> Result<Vec<u8>, Error> {
    let result = files
        .copy(source, temporary)
        .and_then(|_| files.read(temporary));
    if result.is_err() {
        let _ = files.remove(temporary);
    }
    result.map_err(Into::into)
}

fn persist_managed_copy_with(
    files: &impl ManagedFiles,
    conn: &rusqlite::Connection,
    temporary: &Path,
    target: &Path,
    attachment: &AttachmentDto,
) -> Result<(), Error> {
    let result = (|| -> Result<(), Error> {
        let tx = conn.unchecked_transaction()?;
        document_repository::insert(&tx, attachment)?;
        files.rename(temporary, target)?;
        tx.commit()?;
        Ok(())
    })();
    if result.is_err() {
        let _ = files.remove(temporary);
        let _ = files.remove(target);
    }
    result
}

fn remove_managed_attachment_with(
    files: &impl ManagedFiles,
    conn: &rusqlite::Connection,
    attachments_root: &Path,
    id: &str,
) -> Result<(), Error> {
    let attachment = document_repository::get(conn, id)?;
    let live = attachments_root.join(&attachment.relative_path);
    let staged = live.with_extension("deleting");
    if live.exists() {
        files.rename(&live, &staged)?;
    }
    let result = document_repository::delete(conn, id);
    if let Err(error) = result {
        if staged.exists() {
            files.rename(&staged, &live)?;
        }
        return Err(error);
    }
    if staged.exists() {
        files.remove(&staged)?;
    }
    Ok(())
}
/// Shows the native file picker and waits for the lawyer's choice. It blocks until the
/// dialog closes, so it must run off the main thread (see `commands::threads`).
pub fn pick_source<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    if let Some(path) = crate::desktop_e2e::selection("attachment")? {
        return Ok(path);
    }
    app.dialog()
        .file()
        .blocking_pick_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

/// Turns a picked file into a one-time source token for `add`.
pub fn register_source(
    state: &AppState,
    path: PathBuf,
) -> Result<AttachmentSourceSelection, Error> {
    state.unlocked()?;
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(Error::Validation)?
        .to_owned();
    if !path.is_file() {
        return Err(Error::AttachmentSourceMissing);
    }
    Ok(AttachmentSourceSelection {
        source_token: state.store_document_source(path)?,
        filename,
    })
}
pub fn add<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: AttachmentInput,
) -> Result<AttachmentDto, Error> {
    validate_owner(&input)?;
    let _attachment_guard = state.lock_attachment_operations()?;
    let source = state.take_document_source(&input.source_token)?;
    if !source.is_file() {
        return Err(Error::AttachmentSourceMissing);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    validate_owners(&conn, &input)?;
    let root = root(app)?;
    let id = Uuid::new_v4().to_string();
    let extension = source
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| format!(".{extension}"))
        .unwrap_or_default();
    let stored_filename = format!("{id}{extension}");
    let temporary = root.join(format!(".{stored_filename}.partial"));
    let target = root.join(&stored_filename);
    let original_filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(Error::Validation)?
        .to_owned();
    let bytes = copy_bytes(&NativeFiles, &source, &temporary)?;
    let now = db::now();
    let attachment = AttachmentDto {
        id,
        client_id: input.client_id,
        case_id: input.case_id,
        power_of_attorney_id: input.power_of_attorney_id,
        expense_id: input.expense_id,
        original_filename,
        stored_filename: stored_filename.clone(),
        relative_path: stored_filename,
        mime_type: None,
        file_size_bytes: bytes.len() as i64,
        sha256: hex::encode(Sha256::digest(&bytes)),
        category: input.category,
        description: clean(input.description),
        document_date: input.document_date,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    persist_managed_copy_with(&NativeFiles, &conn, &temporary, &target, &attachment)?;
    Ok(attachment)
}
pub fn list<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: AttachmentListInput,
) -> Result<Vec<AttachmentDto>, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    document_repository::list(
        &db::open_db(&path, &master)?,
        input.case_id.as_deref(),
        input.client_id.as_deref(),
        input.power_of_attorney_id.as_deref(),
        input.expense_id.as_deref(),
    )
}
pub fn update<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: AttachmentUpdateInput,
) -> Result<AttachmentDto, Error> {
    if !CATEGORIES.contains(&input.category.as_str()) || !valid_date(input.document_date.as_deref())
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let mut attachment = document_repository::get(&conn, &input.id)?;
    attachment.category = input.category;
    attachment.description = clean(input.description);
    attachment.document_date = input.document_date;
    attachment.updated_at = db::now();
    document_repository::update(&conn, &attachment)?;
    Ok(attachment)
}
fn managed_path(root: &Path, conn: &rusqlite::Connection, id: &str) -> Result<PathBuf, Error> {
    let attachment = document_repository::get(conn, id)?;
    let path = root.join(attachment.relative_path);
    if path.is_file() {
        Ok(path)
    } else {
        Err(Error::AttachmentSourceMissing)
    }
}
fn dispatch_managed(
    root: &Path,
    conn: &rusqlite::Connection,
    id: &str,
    opener: impl FnOnce(PathBuf) -> Result<(), Error>,
) -> Result<(), Error> {
    opener(managed_path(root, conn, id)?)
}
pub fn open<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    dispatch_managed(&root(app)?, &db::open_db(&db_path, &master)?, id, |path| {
        app.opener()
            .open_path(path.to_string_lossy().into_owned(), None::<&str>)
            .map_err(|_| Error::Operation)
    })
}
pub fn reveal<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    dispatch_managed(&root(app)?, &db::open_db(&db_path, &master)?, id, |path| {
        app.opener()
            .reveal_item_in_dir(path)
            .map_err(|_| Error::Operation)
    })
}

pub fn remove<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let _attachment_guard = state.lock_attachment_operations()?;
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    remove_managed_attachment_with(&NativeFiles, &conn, &root(app)?, id)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db, repositories::document_repository};

    fn attachment(id: String, client_id: String, stored_filename: &str) -> AttachmentDto {
        AttachmentDto {
            id,
            client_id: Some(client_id),
            case_id: None,
            power_of_attorney_id: None,
            expense_id: None,
            original_filename: "source.pdf".into(),
            stored_filename: stored_filename.into(),
            relative_path: stored_filename.into(),
            mime_type: None,
            file_size_bytes: 7,
            sha256: "a".repeat(64),
            category: "OTHER".into(),
            description: None,
            document_date: None,
            created_at: "now".into(),
            updated_at: "now".into(),
        }
    }

    fn test_connection() -> (tempfile::TempDir, rusqlite::Connection, String) {
        let directory = tempfile::tempdir().unwrap();
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        let client_id = Uuid::new_v4().to_string();
        connection
            .execute(
                "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'أحمد', 'now', 'now')",
                [&client_id],
            )
            .unwrap();
        (directory, connection, client_id)
    }

    #[test]
    fn attachment_requires_one_owner_and_a_date_only_value() {
        let input = AttachmentInput {
            client_id: Some("a".into()),
            case_id: None,
            power_of_attorney_id: None,
            expense_id: None,
            source_token: "token".into(),
            category: "OTHER".into(),
            description: None,
            document_date: Some("2026-08-24".into()),
        };
        assert!(validate_owner(&input).is_ok());
        assert!(!valid_date(Some("2026-08-24T00:00:00Z")));
    }

    #[test]
    fn managed_copy_is_durable_and_cleans_up_when_metadata_cannot_be_written() {
        let (directory, connection, client_id) = test_connection();
        let root = directory.path().join("attachments");
        fs::create_dir(&root).unwrap();
        let first = attachment(Uuid::new_v4().to_string(), client_id.clone(), "first.pdf");
        let temporary = root.join(".first.partial");
        let target = root.join("first.pdf");
        fs::write(&temporary, b"durable").unwrap();
        persist_managed_copy_with(&NativeFiles, &connection, &temporary, &target, &first).unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"durable");
        assert_eq!(
            document_repository::get(&connection, &first.id).unwrap().id,
            first.id
        );

        let duplicate = attachment(first.id.clone(), client_id, "duplicate.pdf");
        let duplicate_temporary = root.join(".duplicate.partial");
        let duplicate_target = root.join("duplicate.pdf");
        fs::write(&duplicate_temporary, b"discard").unwrap();
        assert!(persist_managed_copy_with(
            &NativeFiles,
            &connection,
            &duplicate_temporary,
            &duplicate_target,
            &duplicate
        )
        .is_err());
        assert!(!duplicate_temporary.exists());
        assert!(!duplicate_target.exists());
    }

    #[test]
    fn removing_an_attachment_removes_its_managed_copy_and_metadata() {
        let (directory, connection, client_id) = test_connection();
        let root = directory.path().join("attachments");
        fs::create_dir(&root).unwrap();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "remove.pdf");
        document_repository::insert(&connection, &item).unwrap();
        fs::write(root.join("remove.pdf"), b"remove me").unwrap();

        remove_managed_attachment_with(&NativeFiles, &connection, &root, &item.id).unwrap();
        assert!(!root.join("remove.pdf").exists());
        assert!(document_repository::get(&connection, &item.id).is_err());
    }
    struct FailingFiles {
        operation: &'static str,
    }
    impl ManagedFiles for FailingFiles {
        fn copy(&self, source: &Path, target: &Path) -> std::io::Result<u64> {
            if self.operation == "copy" {
                fs::write(target, b"partial")?;
                return Err(std::io::Error::other("injected"));
            }
            fs::copy(source, target)
        }
        fn read(&self, path: &Path) -> std::io::Result<Vec<u8>> {
            if self.operation == "read" {
                return Err(std::io::Error::other("injected"));
            }
            fs::read(path)
        }
        fn rename(&self, source: &Path, target: &Path) -> std::io::Result<()> {
            if self.operation == "rename" {
                return Err(std::io::Error::other("injected"));
            }
            fs::rename(source, target)
        }
        fn remove(&self, path: &Path) -> std::io::Result<()> {
            if self.operation == "remove" {
                return Err(std::io::Error::other("injected"));
            }
            fs::remove_file(path)
        }
    }

    #[test]
    fn partial_copy_and_read_failures_clean_up_without_changing_source() {
        for operation in ["copy", "read"] {
            let directory = tempfile::tempdir().unwrap();
            let source = directory.path().join("original.pdf");
            let partial = directory.path().join(".managed.partial");
            fs::write(&source, b"fictional original").unwrap();
            assert!(copy_bytes(&FailingFiles { operation }, &source, &partial).is_err());
            assert!(!partial.exists());
            assert_eq!(fs::read(&source).unwrap(), b"fictional original");
        }
    }

    #[test]
    fn rename_failure_rolls_back_database_and_removes_partial() {
        let (directory, connection, client_id) = test_connection();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "managed.pdf");
        let partial = directory.path().join(".managed.partial");
        let target = directory.path().join("managed.pdf");
        fs::write(&partial, b"fictional").unwrap();
        assert!(persist_managed_copy_with(
            &FailingFiles {
                operation: "rename"
            },
            &connection,
            &partial,
            &target,
            &item
        )
        .is_err());
        assert!(!partial.exists());
        assert!(!target.exists());
        assert!(document_repository::get(&connection, &item.id).is_err());
    }

    #[test]
    fn commit_failure_removes_renamed_copy_and_rolls_back_metadata() {
        let (directory, connection, client_id) = test_connection();
        connection.execute_batch("CREATE TABLE deferred_failure (id TEXT REFERENCES clients(id) DEFERRABLE INITIALLY DEFERRED); CREATE TRIGGER reject_commit AFTER INSERT ON attachments BEGIN INSERT INTO deferred_failure VALUES ('missing'); END;").unwrap();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "managed.pdf");
        let partial = directory.path().join(".managed.partial");
        let target = directory.path().join("managed.pdf");
        fs::write(&partial, b"fictional").unwrap();
        assert!(
            persist_managed_copy_with(&NativeFiles, &connection, &partial, &target, &item).is_err()
        );
        assert!(!partial.exists());
        assert!(!target.exists());
        assert!(document_repository::get(&connection, &item.id).is_err());
    }

    #[test]
    fn deletion_staging_failure_preserves_live_file_and_metadata() {
        let (directory, connection, client_id) = test_connection();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "managed.pdf");
        document_repository::insert(&connection, &item).unwrap();
        fs::write(directory.path().join("managed.pdf"), b"fictional").unwrap();
        assert!(remove_managed_attachment_with(
            &FailingFiles {
                operation: "rename"
            },
            &connection,
            directory.path(),
            &item.id
        )
        .is_err());
        assert!(document_repository::get(&connection, &item.id).is_ok());
        assert_eq!(
            fs::read(directory.path().join("managed.pdf")).unwrap(),
            b"fictional"
        );
        assert!(!directory.path().join("managed.deleting").exists());
    }

    #[test]
    fn rejected_deletion_restores_staged_copy_and_metadata() {
        let (directory, connection, client_id) = test_connection();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "managed.pdf");
        document_repository::insert(&connection, &item).unwrap();
        fs::write(directory.path().join("managed.pdf"), b"fictional").unwrap();
        connection.execute_batch("CREATE TRIGGER reject_delete BEFORE DELETE ON attachments BEGIN SELECT RAISE(ABORT, 'injected'); END;").unwrap();
        assert!(remove_managed_attachment_with(
            &NativeFiles,
            &connection,
            directory.path(),
            &item.id
        )
        .is_err());
        assert!(document_repository::get(&connection, &item.id).is_ok());
        assert_eq!(
            fs::read(directory.path().join("managed.pdf")).unwrap(),
            b"fictional"
        );
        assert!(!directory.path().join("managed.deleting").exists());
    }

    #[test]
    fn post_commit_cleanup_failure_is_reported_with_metadata_already_removed() {
        let (directory, connection, client_id) = test_connection();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "managed.pdf");
        document_repository::insert(&connection, &item).unwrap();
        fs::write(directory.path().join("managed.pdf"), b"fictional").unwrap();
        assert!(remove_managed_attachment_with(
            &FailingFiles {
                operation: "remove"
            },
            &connection,
            directory.path(),
            &item.id
        )
        .is_err());
        assert!(document_repository::get(&connection, &item.id).is_err());
        assert!(!directory.path().join("managed.pdf").exists());
        assert_eq!(
            fs::read(directory.path().join("managed.deleting")).unwrap(),
            b"fictional"
        );
    }

    #[test]
    fn missing_managed_file_can_be_removed_but_cannot_be_opened_or_revealed() {
        let (directory, connection, client_id) = test_connection();
        let item = attachment(Uuid::new_v4().to_string(), client_id, "managed.pdf");
        document_repository::insert(&connection, &item).unwrap();
        for _ in 0..2 {
            assert!(matches!(
                dispatch_managed(directory.path(), &connection, &item.id, |_| panic!(
                    "opener must not run"
                )),
                Err(Error::AttachmentSourceMissing)
            ));
        }
        fs::write(directory.path().join("managed.pdf"), b"fictional").unwrap();
        for _ in 0..2 {
            assert!(matches!(
                dispatch_managed(directory.path(), &connection, &item.id, |_| Err(
                    Error::Operation
                )),
                Err(Error::Operation)
            ));
            assert!(document_repository::get(&connection, &item.id).is_ok());
        }
        fs::remove_file(directory.path().join("managed.pdf")).unwrap();
        remove_managed_attachment_with(&NativeFiles, &connection, directory.path(), &item.id)
            .unwrap();
        assert!(document_repository::get(&connection, &item.id).is_err());
    }
}
