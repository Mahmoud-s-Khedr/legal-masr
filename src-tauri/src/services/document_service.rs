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

fn persist_managed_copy(
    conn: &rusqlite::Connection,
    temporary: &Path,
    target: &Path,
    attachment: &AttachmentDto,
) -> Result<(), Error> {
    let result = (|| -> Result<(), Error> {
        let tx = conn.unchecked_transaction()?;
        document_repository::insert(&tx, attachment)?;
        fs::rename(temporary, target)?;
        tx.commit()?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
        let _ = fs::remove_file(target);
    }
    result
}

fn remove_managed_attachment(
    conn: &rusqlite::Connection,
    attachments_root: &Path,
    id: &str,
) -> Result<(), Error> {
    let attachment = document_repository::get(conn, id)?;
    let live = attachments_root.join(&attachment.relative_path);
    let staged = live.with_extension("deleting");
    if live.exists() {
        fs::rename(&live, &staged)?;
    }
    let result = document_repository::delete(conn, id);
    if let Err(error) = result {
        if staged.exists() {
            let _ = fs::rename(staged, live);
        }
        return Err(error);
    }
    if staged.exists() {
        fs::remove_file(staged)?;
    }
    Ok(())
}
pub fn select_source<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<AttachmentSourceSelection, Error> {
    state.unlocked()?;
    let path = app
        .dialog()
        .file()
        .blocking_pick_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)?;
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
    fs::copy(&source, &temporary)?;
    let bytes = match fs::read(&temporary) {
        Ok(bytes) => bytes,
        Err(error) => {
            let _ = fs::remove_file(&temporary);
            return Err(error.into());
        }
    };
    let now = db::now();
    let original_filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(Error::Validation)?
        .to_owned();
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
    persist_managed_copy(&conn, &temporary, &target, &attachment)?;
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
fn path<R: Runtime>(
    app: &AppHandle<R>,
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<PathBuf, Error> {
    let attachment = document_repository::get(conn, id)?;
    let path = root(app)?.join(attachment.relative_path);
    if path.is_file() {
        Ok(path)
    } else {
        Err(Error::AttachmentSourceMissing)
    }
}
pub fn open<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    app.opener()
        .open_path(
            path(app, &db::open_db(&db_path, &master)?, id)?
                .to_string_lossy()
                .into_owned(),
            None::<&str>,
        )
        .map_err(|_| Error::Operation)
}
pub fn reveal<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    app.opener()
        .reveal_item_in_dir(path(app, &db::open_db(&db_path, &master)?, id)?)
        .map_err(|_| Error::Operation)
}
pub fn remove<R: Runtime>(app: &AppHandle<R>, state: &AppState, id: &str) -> Result<(), Error> {
    let _attachment_guard = state.lock_attachment_operations()?;
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    remove_managed_attachment(&conn, &root(app)?, id)
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
        persist_managed_copy(&connection, &temporary, &target, &first).unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"durable");
        assert_eq!(
            document_repository::get(&connection, &first.id).unwrap().id,
            first.id
        );

        let duplicate = attachment(first.id.clone(), client_id, "duplicate.pdf");
        let duplicate_temporary = root.join(".duplicate.partial");
        let duplicate_target = root.join("duplicate.pdf");
        fs::write(&duplicate_temporary, b"discard").unwrap();
        assert!(persist_managed_copy(
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

        remove_managed_attachment(&connection, &root, &item.id).unwrap();
        assert!(!root.join("remove.pdf").exists());
        assert!(document_repository::get(&connection, &item.id).is_err());
    }
}
