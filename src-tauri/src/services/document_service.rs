use crate::{
    db,
    dto::{DocumentDto, DocumentListInput, DocumentReferenceInput, DocumentUpdateInput},
    errors::Error,
    normalize,
    repositories::{document_repository, search_repository},
    state::AppState,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Runtime};
use uuid::Uuid;
const CATEGORIES: &[&str] = &[
    "PLEADING",
    "COURT_DECISION",
    "EVIDENCE",
    "CONTRACT",
    "POWER_OF_ATTORNEY",
    "IDENTIFICATION",
    "RECEIPT",
    "CORRESPONDENCE",
    "OTHER",
];
fn dto(
    i: &DocumentReferenceInput,
    id: String,
    mode: &str,
    name: String,
    size: i64,
    now: String,
) -> DocumentDto {
    DocumentDto {
        id,
        client_id: i.client_id.clone(),
        case_id: i.case_id.clone(),
        storage_mode: mode.into(),
        original_filename: name,
        category: i.category.clone(),
        description: i.description.clone(),
        document_date: i.document_date.clone(),
        mime_type: None,
        file_size_bytes: Some(size),
        missing_at: None,
        created_at: now,
    }
}
fn index(c: &rusqlite::Connection, d: &DocumentDto, now: &str) -> Result<(), Error> {
    search_repository::upsert(
        c,
        "document",
        &d.id,
        &d.original_filename,
        Some(&d.category),
        &normalize::normalize_text(&format!(
            "{} {}",
            d.original_filename,
            d.description.clone().unwrap_or_default()
        )),
        now,
    )
}
fn check(i: &DocumentReferenceInput) -> Result<(), Error> {
    if !CATEGORIES.contains(&i.category.as_str()) {
        return Err(Error::Validation);
    }
    if i.path.trim().is_empty() || !Path::new(&i.path).is_file() {
        return Err(Error::DocumentSourceMissing);
    }
    Ok(())
}
pub fn add_reference<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: DocumentReferenceInput,
) -> Result<DocumentDto, Error> {
    check(&i)?;
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let source = Path::new(&i.path);
    let name = source
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or(Error::Validation)?
        .to_owned();
    let d = dto(
        &i,
        Uuid::new_v4().to_string(),
        "EXTERNAL_REFERENCE",
        name,
        fs::metadata(source)?.len() as i64,
        now.clone(),
    );
    let tx = c.unchecked_transaction()?;
    document_repository::insert(&tx, &d, None, None, Some(&i.path), None, &now)?;
    index(&tx, &d, &now)?;
    tx.commit()?;
    Ok(d)
}
pub fn import_managed<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: DocumentReferenceInput,
) -> Result<DocumentDto, Error> {
    check(&i)?;
    let m = s.unlocked()?;
    let root = db::app_dir(a)?.join("documents");
    fs::create_dir_all(&root)?;
    let source = Path::new(&i.path);
    let name = source
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or(Error::Validation)?
        .to_owned();
    let id = Uuid::new_v4().to_string();
    let ext = source
        .extension()
        .and_then(|x| x.to_str())
        .map(|x| format!(".{x}"))
        .unwrap_or_default();
    let stored = format!("{id}{ext}");
    let target = root.join(&stored);
    let temporary = root.join(format!(".{stored}.partial"));
    fs::copy(source, &temporary)?;
    let bytes = match fs::read(&temporary) {
        Ok(bytes) => bytes,
        Err(error) => {
            let _ = fs::remove_file(&temporary);
            return Err(error.into());
        }
    };
    let checksum = hex::encode(Sha256::digest(&bytes));
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let d = dto(
        &i,
        id,
        "MANAGED_COPY",
        name,
        bytes.len() as i64,
        now.clone(),
    );
    let write_result = (|| -> Result<(), Error> {
        let tx = c.unchecked_transaction()?;
        document_repository::insert(
            &tx,
            &d,
            Some(&stored),
            Some(&stored),
            None,
            Some(&checksum),
            &now,
        )?;
        index(&tx, &d, &now)?;
        fs::rename(&temporary, &target)?;
        tx.commit()?;
        Ok(())
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary);
        let _ = fs::remove_file(&target);
        return Err(error);
    }
    Ok(d)
}
pub fn list<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: DocumentListInput,
) -> Result<Vec<DocumentDto>, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    document_repository::list(
        &db::open_db(&p, &m)?,
        i.case_id.as_deref(),
        i.client_id.as_deref(),
        i.include_archived,
    )
}
pub fn update<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    i: DocumentUpdateInput,
) -> Result<DocumentDto, Error> {
    if !CATEGORIES.contains(&i.category.as_str()) {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let now = db::now();
    let tx = c.unchecked_transaction()?;
    let d = document_repository::update(
        &tx,
        &i.id,
        &i.category,
        i.description.as_deref(),
        i.document_date.as_deref(),
        &now,
    )?;
    index(&tx, &d, &now)?;
    tx.commit()?;
    Ok(d)
}
pub fn check_missing<R: Runtime>(a: &AppHandle<R>, s: &AppState, id: &str) -> Result<bool, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let (mode, relative, external, _) = document_repository::paths(&c, id)?;
    let path = if mode == "MANAGED_COPY" {
        db::app_dir(a)?
            .join("documents")
            .join(relative.unwrap_or_default())
    } else {
        PathBuf::from(external.unwrap_or_default())
    };
    let missing = !path.is_file();
    document_repository::set_missing(&c, id, missing, &db::now())?;
    Ok(missing)
}
pub fn remove<R: Runtime>(a: &AppHandle<R>, s: &AppState, id: &str) -> Result<(), Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let (mode, relative, _, _) = document_repository::paths(&c, id)?;
    // Move the managed copy out of its live location before deleting metadata.
    // If the database transaction fails, put it back so a record never points
    // at a silently missing file.
    let pending_delete = if mode == "MANAGED_COPY" {
        let live = db::app_dir(a)?
            .join("documents")
            .join(relative.unwrap_or_default());
        if live.exists() {
            let pending = live.with_extension("deleting");
            fs::rename(&live, &pending)?;
            Some((live, pending))
        } else {
            None
        }
    } else {
        None
    };
    let delete_result = (|| -> Result<(), Error> {
        let tx = c.unchecked_transaction()?;
        document_repository::delete(&tx, id)?;
        search_repository::delete(&tx, "document", id)?;
        tx.commit()?;
        Ok(())
    })();
    if let Err(error) = delete_result {
        if let Some((live, pending)) = pending_delete {
            let _ = fs::rename(pending, live);
        }
        return Err(error);
    }
    if let Some((_, pending)) = pending_delete {
        fs::remove_file(pending)?;
    }
    Ok(())
}
