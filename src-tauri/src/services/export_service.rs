//! User-requested plaintext domain exports. This is deliberately not a backup.
use crate::{backup::safe_attachment_name, db, errors::Error, vault_operation};
use rusqlite::{types::ValueRef, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File, OpenOptions},
    io::{BufWriter, Read, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub token: String,
    pub folder_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    format_version: u8,
    application_version: &'static str,
    schema_version: i64,
    created_at: String,
    encrypted: bool,
    scope: &'static str,
    case_id: Option<String>,
    files: BTreeMap<String, FileEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    row_count: Option<u64>,
    size_bytes: u64,
    sha256: String,
}

// Fixed projections are the v1 public contract. Never SELECT * or enumerate tables.
struct Table {
    name: &'static str,
    columns: &'static str,
    filter: &'static str,
}
const TABLES: &[Table] = &[
    Table { name: "clients", columns: "id,internal_number,full_name,national_id,primary_phone,email,address,notes,archived_at,(archived_at IS NOT NULL) AS archived,created_at,updated_at", filter: "id IN (SELECT id FROM selected_clients)" },
    Table { name: "cases", columns: "id,internal_number,official_number,official_year,judicial_year,case_type,litigation_degree,court_name,circuit_name,status,filed_on,closed_on,subject,notes,archived_at,(archived_at IS NOT NULL) AS archived,created_at,updated_at", filter: "id IN (SELECT id FROM selected_cases)" },
    Table { name: "powers_of_attorney", columns: "id,internal_sequence,official_number,issue_year,issue_date,notary_office,notes,archived_at,(archived_at IS NOT NULL) AS archived,created_at,updated_at", filter: "id IN (SELECT id FROM selected_poas)" },
    Table { name: "case_clients", columns: "case_id,client_id,legal_capacity,notes,created_at,updated_at", filter: "case_id IN (SELECT id FROM selected_cases)" },
    Table { name: "case_opponents", columns: "id,case_id,full_name,legal_capacity,lawyer_name,phone,address,notes,created_at,updated_at", filter: "case_id IN (SELECT id FROM selected_cases)" },
    Table { name: "power_of_attorney_clients", columns: "power_of_attorney_id,client_id,created_at", filter: "power_of_attorney_id IN (SELECT id FROM selected_poas) AND client_id IN (SELECT id FROM selected_clients)" },
    Table { name: "power_of_attorney_lawyers", columns: "id,power_of_attorney_id,full_name,bar_number,notes,created_at,updated_at", filter: "power_of_attorney_id IN (SELECT id FROM selected_poas)" },
    Table { name: "hearings", columns: "id,case_id,CASE WHEN ?1 IS NULL OR previous_hearing_id IN (SELECT id FROM hearings WHERE case_id = ?1) THEN previous_hearing_id ELSE NULL END AS previous_hearing_id,hearing_date,hearing_time,hearing_type,location,circuit_name,required_documents,notes,decision_text,status,completed_at,created_at,updated_at", filter: "case_id IN (SELECT id FROM selected_cases)" },
    Table { name: "tasks", columns: "id,client_id,case_id,title,details,notes,due_date,completed,completed_at,created_at,updated_at", filter: "?1 IS NULL OR case_id = ?1" },
    Table { name: "case_fee_agreements", columns: "id,case_id,amount_minor,agreement_date,notes,created_at,updated_at", filter: "case_id IN (SELECT id FROM selected_cases)" },
    Table { name: "payments", columns: "id,case_id,payer_client_id,amount_minor,payment_date,payment_method,notes,created_at,updated_at", filter: "case_id IN (SELECT id FROM selected_cases)" },
    Table { name: "expenses", columns: "id,case_id,client_id,amount_minor,expense_date,expense_type,notes,created_at,updated_at", filter: "id IN (SELECT id FROM selected_expenses)" },
    Table { name: "attachments", columns: "id,client_id,case_id,power_of_attorney_id,expense_id,original_filename,stored_filename,relative_path,('documents/' || stored_filename) AS export_path,mime_type,file_size_bytes,sha256,category,description,document_date,created_at,updated_at", filter: "?1 IS NULL OR case_id = ?1 OR client_id IN (SELECT id FROM selected_clients) OR power_of_attorney_id IN (SELECT id FROM selected_poas) OR expense_id IN (SELECT id FROM selected_expenses)" },
];
const SCOPE: &str = "WITH selected_cases AS (SELECT id FROM cases WHERE ?1 IS NULL OR id = ?1),
selected_clients AS (SELECT id FROM clients WHERE ?1 IS NULL OR id IN (SELECT client_id FROM case_clients WHERE case_id = ?1)),
selected_poas AS (SELECT id FROM powers_of_attorney WHERE ?1 IS NULL OR id IN (SELECT power_of_attorney_id FROM client_current_poa WHERE client_id IN (SELECT id FROM selected_clients))),
selected_expenses AS (SELECT id FROM expenses WHERE ?1 IS NULL OR case_id = ?1)";

pub fn pick_folder<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, Error> {
    #[cfg(feature = "desktop-e2e")]
    if let Some(path) = crate::desktop_e2e::selection("export-folder")? {
        return Ok(path);
    }
    app.dialog()
        .file()
        .blocking_pick_folder()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

/// Resolve native picker output and reject managed-vault destinations, including
/// symlink aliases. The renderer cannot supply an arbitrary filesystem path.
pub fn destination_outside_vault(root: &Path, selected: &Path) -> Result<PathBuf, Error> {
    let destination = selected.canonicalize()?;
    if !destination.is_dir() || destination.starts_with(root.canonicalize()?) {
        return Err(Error::Validation);
    }
    Ok(destination)
}

/// Local calendar stamp supplied by the same renderer clock used for backup names.
fn folder_name(conn: &Connection, case_id: Option<&str>, stamp: &str) -> Result<String, Error> {
    let format = time::macros::format_description!("[year]-[month]-[day]-[hour][minute]");
    if stamp.len() != 15 || time::PrimitiveDateTime::parse(stamp, format).is_err() {
        return Err(Error::Validation);
    }
    let suffix = match case_id {
        None => String::new(),
        Some(id) => {
            let number: String = conn
                .query_row(
                    "SELECT internal_number FROM cases WHERE id = ?1",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|error| {
                    if matches!(error, rusqlite::Error::QueryReturnedNoRows) {
                        Error::CaseNotFound
                    } else {
                        error.into()
                    }
                })?;
            // Encode unsafe UTF-8 bytes as ~HH, preserving the complete internal
            // number without traversal, Windows device names or lossy collisions.
            let encoded: String = number
                .chars()
                .map(|c| {
                    if c.is_alphanumeric() || c == '-' || c == '_' {
                        c.to_string()
                    } else {
                        c.to_string().bytes().map(|b| format!("~{b:02X}")).collect()
                    }
                })
                .collect();
            format!("-case-{encoded}")
        }
    };
    Ok(format!("LegalMasr-export-{stamp}{suffix}"))
}

fn text_cell(value: &str) -> String {
    // Reversible spreadsheet-formula guard, including leading whitespace and
    // apostrophes (so a decoder can remove exactly one guard unambiguously).
    let guarded = value.starts_with('\'')
        || value.starts_with(['\t', '\r', '\n'])
        || value.trim_start().starts_with(['=', '+', '-', '@']);
    format!(
        "\"{}{}\"",
        if guarded { "'" } else { "" },
        value.replace('"', "\"\"")
    )
}

fn write_csv(
    conn: &Connection,
    root: &Path,
    table: &Table,
    case_id: Option<&str>,
    check: &mut impl FnMut() -> Result<(), Error>,
) -> Result<u64, Error> {
    let sql = format!(
        "{SCOPE} SELECT {} FROM {} WHERE {} ORDER BY 1,2",
        table.columns, table.name, table.filter
    );
    let mut statement = conn.prepare(&sql)?;
    let headers = statement.column_names().join(",");
    let columns = statement.column_count();
    let mut rows = statement.query([case_id])?;
    let mut writer = BufWriter::new(new_file(&root.join(format!("{}.csv", table.name)))?);
    writer.write_all(b"\xEF\xBB\xBF")?;
    write!(writer, "{headers}\r\n")?;
    let mut count = 0;
    while let Some(row) = rows.next()? {
        check()?;
        for index in 0..columns {
            if index > 0 {
                writer.write_all(b",")?;
            }
            match row.get_ref(index)? {
                ValueRef::Null => {}
                ValueRef::Integer(value) => write!(writer, "{value}")?,
                ValueRef::Text(value) => writer.write_all(
                    text_cell(std::str::from_utf8(value).map_err(|_| Error::Validation)?)
                        .as_bytes(),
                )?,
                _ => return Err(Error::Validation),
            }
        }
        writer.write_all(b"\r\n")?;
        count += 1;
    }
    writer.flush()?;
    writer.get_ref().sync_all()?;
    Ok(count)
}

fn new_file(path: &Path) -> Result<File, Error> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    Ok(options.open(path)?)
}

fn hash_file(
    path: &Path,
    check: &mut impl FnMut() -> Result<(), Error>,
) -> Result<FileEntry, Error> {
    let mut source = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 65536];
    let mut size = 0;
    loop {
        check()?;
        let length = source.read(&mut buffer)?;
        if length == 0 {
            break;
        }
        hasher.update(&buffer[..length]);
        size += length as u64;
    }
    Ok(FileEntry {
        row_count: None,
        size_bytes: size,
        sha256: hex::encode(hasher.finalize()),
    })
}

// Linux rename must refuse even an empty target directory created after the
// initial check. Windows' rename already refuses an existing destination.
#[cfg(target_os = "linux")]
fn publish(source: &Path, target: &Path) -> Result<(), Error> {
    use std::{ffi::CString, os::unix::ffi::OsStrExt};
    unsafe extern "C" {
        fn renameat2(
            oldfd: i32,
            old: *const std::ffi::c_char,
            newfd: i32,
            new: *const std::ffi::c_char,
            flags: u32,
        ) -> i32;
    }
    let source = CString::new(source.as_os_str().as_bytes()).map_err(|_| Error::Validation)?;
    let target = CString::new(target.as_os_str().as_bytes()).map_err(|_| Error::Validation)?;
    // SAFETY: both C strings live through the call; AT_FDCWD=-100 and
    // RENAME_NOREPLACE=1 have the Linux ABI values. No pointers escape.
    if unsafe { renameat2(-100, source.as_ptr(), -100, target.as_ptr(), 1) } != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}
#[cfg(not(target_os = "linux"))]
fn publish(source: &Path, target: &Path) -> Result<(), Error> {
    // macOS is outside this launch; do not silently use overwrite-capable rename.
    if !cfg!(target_os = "windows") {
        return Err(Error::Operation);
    }
    fs::rename(source, target)?;
    Ok(())
}

struct Staging(PathBuf);
impl Drop for Staging {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Caller holds the operation gate and attachment guard. A read transaction
/// fixes all CSVs to one DB snapshot; cancellation/session checks run during IO.
pub fn create(
    conn: &mut Connection,
    documents: &Path,
    destination: &Path,
    case_id: Option<&str>,
    stamp: &str,
    mut check: impl FnMut() -> Result<(), Error>,
) -> Result<PathBuf, Error> {
    check()?;
    let tx = conn.transaction()?;
    let name = folder_name(&tx, case_id, stamp)?;
    let output = destination.join(&name);
    if output.symlink_metadata().is_ok() {
        return Err(Error::Operation);
    }
    let staged_path = destination.join(format!(
        ".LegalMasr-export-{}.partial",
        uuid::Uuid::new_v4()
    ));
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(&staged_path)?;
    let staging = Staging(staged_path);
    builder.create(staging.0.join("documents"))?;
    let mut files = BTreeMap::new();
    for table in TABLES {
        let count = write_csv(&tx, &staging.0, table, case_id, &mut check)?;
        let name = format!("{}.csv", table.name);
        let mut entry = hash_file(&staging.0.join(&name), &mut check)?;
        entry.row_count = Some(count);
        files.insert(name, entry);
    }
    let attachment_table = TABLES.last().ok_or(Error::Operation)?;
    let sql = format!("{SCOPE} SELECT relative_path,stored_filename,file_size_bytes,sha256 FROM attachments WHERE {} ORDER BY id", attachment_table.filter);
    let mut statement = tx.prepare(&sql)?;
    let mut rows = statement.query([case_id])?;
    let mut names = BTreeSet::new();
    while let Some(row) = rows.next()? {
        check()?;
        let relative: String = row.get(0)?;
        let stored: String = row.get(1)?;
        let size: i64 = row.get(2)?;
        let hash: String = row.get(3)?;
        if relative != stored
            || !safe_attachment_name(&stored)
            || !names.insert(stored.to_lowercase())
        {
            return Err(Error::Validation);
        }
        let source = documents.join(relative);
        if !source.symlink_metadata()?.file_type().is_file() {
            return Err(Error::Validation);
        }
        let name = format!("documents/{stored}");
        let path = staging.0.join(&name);
        let mut from = File::open(source)?;
        let mut to = new_file(&path)?;
        let mut buffer = [0; 65536];
        loop {
            check()?;
            let length = from.read(&mut buffer)?;
            if length == 0 {
                break;
            }
            to.write_all(&buffer[..length])?;
        }
        to.sync_all()?;
        let entry = hash_file(&path, &mut check)?;
        if entry.size_bytes != size as u64 || entry.sha256 != hash {
            return Err(Error::Validation);
        }
        files.insert(name, entry);
    }
    drop(rows);
    drop(statement);
    let manifest = Manifest {
        format_version: 1,
        application_version: env!("CARGO_PKG_VERSION"),
        schema_version: db::schema_version(&tx),
        created_at: db::now(),
        encrypted: false,
        scope: if case_id.is_some() {
            "case"
        } else {
            "installation"
        },
        case_id: case_id.map(str::to_owned),
        files,
    };
    let mut file = new_file(&staging.0.join("manifest.json"))?;
    file.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
    file.sync_all()?;
    drop(file);
    tx.commit()?;
    vault_operation::sync_directory(&staging.0.join("documents"))?;
    vault_operation::sync_directory(&staging.0)?;
    check()?;
    publish(&staging.0, &output)?;
    // Publication has succeeded. Directory sync failures cannot roll it back;
    // callers still receive the completed export (Windows flush is a no-op).
    let _ = vault_operation::sync_directory(destination);
    Ok(output)
}

#[cfg(test)]
mod tests;
