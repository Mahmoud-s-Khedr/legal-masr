//! Guided deletion: native preview capability, one SQL transaction, durable file outbox.
use crate::{
    db,
    dto::{DeletionInput, DeletionPreview, DeletionResult, DeletionTarget},
    errors::Error,
    security,
    services::{app_service, backup_service, search_service},
    state::AppState,
    vault_operation,
};
use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, path::Path};
use tauri::{AppHandle, Runtime};
use zeroize::Zeroizing;

pub struct PreparedDeletion {
    token: String,
    target: DeletionTarget,
    fingerprint: Vec<u8>,
    generation: u64,
    word: String,
}

// Dependency order matters: payments RESTRICT removal of case-client links;
// tasks/expenses would otherwise survive with NULL owners.
const TABLES: &[(&str, &str)] = &[
    ("attachments", "client_id IN (SELECT id FROM delete_clients) OR case_id IN (SELECT id FROM delete_cases) OR power_of_attorney_id IN (SELECT id FROM delete_poas) OR expense_id IN (SELECT id FROM expenses WHERE client_id IN (SELECT id FROM delete_clients) OR case_id IN (SELECT id FROM delete_cases))"),
    ("payments", "case_id IN (SELECT id FROM delete_cases)"),
    ("expenses", "client_id IN (SELECT id FROM delete_clients) OR case_id IN (SELECT id FROM delete_cases)"),
    ("tasks", "client_id IN (SELECT id FROM delete_clients) OR case_id IN (SELECT id FROM delete_cases)"),
    ("hearings", "case_id IN (SELECT id FROM delete_cases)"),
    ("case_fee_agreements", "case_id IN (SELECT id FROM delete_cases)"),
    ("case_opponents", "case_id IN (SELECT id FROM delete_cases)"),
    ("case_clients", "case_id IN (SELECT id FROM delete_cases)"),
    ("cases", "id IN (SELECT id FROM delete_cases)"),
    ("power_of_attorney_lawyers", "power_of_attorney_id IN (SELECT id FROM delete_poas)"),
    ("power_of_attorney_clients", "power_of_attorney_id IN (SELECT id FROM delete_poas)"),
    ("powers_of_attorney", "id IN (SELECT id FROM delete_poas)"),
    ("clients", "id IN (SELECT id FROM delete_clients)"),
];
const LOCAL_TABLES: &[&str] = &[
    "lawyer_profile",
    "app_settings",
    "app_metadata",
    "spike_records",
    "usage_counters",
    "backup_history",
    "pending_file_deletions",
    "search_index",
];

fn scalar(conn: &Connection, sql: &str) -> Result<u64, Error> {
    Ok(conn.query_row(sql, [], |row| row.get(0))?)
}
fn strings(conn: &Connection, sql: &str) -> Result<Vec<String>, Error> {
    Ok(conn
        .prepare(sql)?
        .query_map([], |row| row.get(0))?
        .collect::<Result<_, _>>()?)
}
fn archived(conn: &Connection, table: &str, id: &str) -> Result<(), Error> {
    let value: Option<Option<String>> = conn
        .query_row(
            &format!("SELECT archived_at FROM {table} WHERE id=?1"),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    match value {
        Some(Some(_)) => Ok(()),
        Some(None) => Err(Error::DeletionNotArchived),
        None if table == "clients" => Err(Error::ClientNotFound),
        None => Err(Error::CaseNotFound),
    }
}

fn targets(conn: &Connection, target: &DeletionTarget) -> Result<(), Error> {
    conn.execute_batch("DROP TABLE IF EXISTS temp.delete_clients; DROP TABLE IF EXISTS temp.delete_cases; DROP TABLE IF EXISTS temp.delete_poas;
        CREATE TEMP TABLE delete_clients (id TEXT PRIMARY KEY);
        CREATE TEMP TABLE delete_cases (id TEXT PRIMARY KEY);
        CREATE TEMP TABLE delete_poas (id TEXT PRIMARY KEY);")?;
    match target {
        DeletionTarget::Client { id } => {
            archived(conn, "clients", id)?;
            conn.execute("INSERT INTO delete_clients VALUES (?1)", [id])?;
            conn.execute(
                "INSERT INTO delete_cases SELECT case_id FROM case_clients WHERE client_id=?1",
                [id],
            )?;
            conn.execute("INSERT INTO delete_poas SELECT power_of_attorney_id FROM power_of_attorney_clients WHERE client_id=?1", [id])?;
            if scalar(conn, "SELECT count(*) FROM case_clients WHERE case_id IN (SELECT id FROM delete_cases) AND client_id NOT IN (SELECT id FROM delete_clients)")? > 0
                || scalar(conn, "SELECT count(*) FROM power_of_attorney_clients WHERE power_of_attorney_id IN (SELECT id FROM delete_poas) AND client_id NOT IN (SELECT id FROM delete_clients)")? > 0 {
                return Err(Error::DeletionSharedIntegrity);
            }
            if scalar(conn, "SELECT count(*) FROM cases WHERE id IN (SELECT id FROM delete_cases) AND archived_at IS NULL")? > 0
                || scalar(conn, "SELECT count(*) FROM powers_of_attorney WHERE id IN (SELECT id FROM delete_poas) AND archived_at IS NULL")? > 0 {
                return Err(Error::DeletionNotArchived);
            }
        }
        DeletionTarget::Case { id } => {
            archived(conn, "cases", id)?;
            conn.execute("INSERT INTO delete_cases VALUES (?1)", [id])?;
            // A shared case is another client's record too. Refuse rather than
            // silently deleting that client's hearings, accounts and documents.
            if scalar(
                conn,
                "SELECT count(*) FROM case_clients WHERE case_id IN (SELECT id FROM delete_cases)",
            )? > 1
            {
                return Err(Error::DeletionSharedIntegrity);
            }
        }
        DeletionTarget::All => {
            conn.execute_batch(
                "INSERT INTO delete_clients SELECT id FROM clients;
                INSERT INTO delete_cases SELECT id FROM cases;
                INSERT INTO delete_poas SELECT id FROM powers_of_attorney;",
            )?;
        }
    }
    // Historical/hand-edited data can chain a hearing across cases. SET NULL
    // would mutate a retained hearing, so refuse that boundary too.
    if scalar(conn, "SELECT count(*) FROM hearings WHERE case_id NOT IN (SELECT id FROM delete_cases) AND previous_hearing_id IN (SELECT id FROM hearings WHERE case_id IN (SELECT id FROM delete_cases))")? > 0 {
        return Err(Error::DeletionSharedIntegrity);
    }
    Ok(())
}

// All managed copies are flat native-generated basenames. No traversal or
// directory symlink may turn deletion into access outside this vault.
fn managed_path(root: &Path, name: &str) -> Result<std::path::PathBuf, Error> {
    if name.is_empty() || name.contains(['/', '\\', ':']) || matches!(name, "." | "..") {
        return Err(Error::Validation);
    }
    let directory = root.join("attachments");
    if fs::symlink_metadata(&directory).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err(Error::Validation);
    }
    Ok(directory.join(name))
}

struct Plan {
    counts: BTreeMap<String, u64>,
    files: Vec<String>,
    managed_files: u64,
    vault_files: u64,
    fingerprint: Vec<u8>,
}
fn plan(conn: &Connection, root: &Path, target: &DeletionTarget) -> Result<Plan, Error> {
    targets(conn, target)?;
    let all = *target == DeletionTarget::All;
    let mut counts = BTreeMap::new();
    let mut hash = Sha256::new();
    // Hash the complete domain, including retained memberships and row content.
    // Any change since preview requires a new review, even if counts match.
    for (table, filter) in TABLES {
        counts.insert(
            (*table).into(),
            scalar(
                conn,
                &format!(
                    "SELECT count(*) FROM {table} WHERE {}",
                    if all { "1" } else { filter }
                ),
            )?,
        );
        hash.update(table.as_bytes());
        let mut statement = conn.prepare(&format!("SELECT * FROM {table} ORDER BY rowid"))?;
        let columns = statement.column_count();
        let mut rows = statement.query([])?;
        while let Some(row) = rows.next()? {
            for index in 0..columns {
                let value = format!("{:?}", row.get_ref(index)?);
                hash.update((value.len() as u64).to_le_bytes());
                hash.update(value.as_bytes());
            }
        }
    }
    if all {
        for table in LOCAL_TABLES {
            counts.insert(
                (*table).into(),
                scalar(conn, &format!("SELECT count(*) FROM {table}"))?,
            );
        }
    }
    let filter = if all { "1" } else { TABLES[0].1 };
    let files = strings(
        conn,
        &format!(
            "SELECT DISTINCT relative_path FROM attachments WHERE {filter} ORDER BY relative_path"
        ),
    )?;
    for file in &files {
        managed_path(root, file)?;
        // Malformed historical data must not leave another owner's metadata
        // pointing at a file removed by this flow.
        let retained: u64 = conn.query_row(
            &format!("SELECT count(*) FROM attachments WHERE relative_path=?1 AND NOT COALESCE(({filter}), 0)"),
            [file],
            |r| r.get(0),
        )?;
        if retained > 0 {
            return Err(Error::DeletionSharedIntegrity);
        }
    }
    let managed_files = if all {
        match fs::symlink_metadata(root.join("attachments")) {
            Ok(_) => vault_operation::count_files(&root.join("attachments"))?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => 0,
            Err(e) => return Err(e.into()),
        }
    } else {
        let mut count = 0;
        for file in &files {
            match fs::symlink_metadata(managed_path(root, file)?) {
                Ok(_) => count += 1,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(e.into()),
            }
        }
        count
    };
    let vault_files = if all {
        vault_operation::deletion_file_count(root)?
    } else {
        0
    };
    hash.update(managed_files.to_le_bytes());
    hash.update(vault_files.to_le_bytes());
    Ok(Plan {
        counts,
        files,
        managed_files,
        vault_files,
        fingerprint: hash.finalize().to_vec(),
    })
}

pub fn preview<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    target: DeletionTarget,
    language: &str,
) -> Result<DeletionPreview, Error> {
    let word = match language {
        "ar" => "حذف",
        "en" => "DELETE",
        _ => return Err(Error::Validation),
    };
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let plan = plan(&conn, &db::app_dir(app)?, &target)?;
    let token = uuid::Uuid::new_v4().to_string();
    *state.deletion.lock().map_err(|_| Error::Operation)? = Some(PreparedDeletion {
        token: token.clone(),
        target,
        fingerprint: plan.fingerprint,
        generation: state.generation(),
        word: word.into(),
    });
    Ok(DeletionPreview {
        token,
        counts: plan.counts,
        managed_files: plan.managed_files,
        vault_files: plan.vault_files,
        confirmation_word: word.into(),
    })
}

fn verify(
    prepared: &PreparedDeletion,
    input: &DeletionInput,
    generation: u64,
    fingerprint: &[u8],
) -> Result<(), Error> {
    if prepared.generation != generation
        || prepared.token != input.token
        || prepared.target != input.target
        || prepared.fingerprint != fingerprint
    {
        return Err(Error::DeletionPreviewExpired);
    }
    if input.confirmation.trim() != prepared.word {
        return Err(Error::DeletionConfirmation);
    }
    Ok(())
}

fn delete_rows(conn: &Connection, target: &DeletionTarget) -> Result<(), Error> {
    let all = *target == DeletionTarget::All;
    let tx = conn.unchecked_transaction()?;
    for (table, filter) in TABLES {
        if *table == "attachments" && !all {
            tx.execute(&format!("INSERT OR IGNORE INTO pending_file_deletions SELECT relative_path FROM attachments WHERE {filter}"), [])?;
        }
        tx.execute(
            &format!(
                "DELETE FROM {table} WHERE {}",
                if all { "1" } else { filter }
            ),
            [],
        )?;
    }
    if all {
        for table in LOCAL_TABLES {
            tx.execute(&format!("DELETE FROM {table}"), [])?;
        }
    } else {
        search_service::refresh_with(&tx)?;
    }
    tx.commit()?;
    Ok(())
}

/// Missing files count as already cleaned. Failures remain in the encrypted DB
/// and can be retried without retaining legal-record metadata or exposing paths.
pub fn cleanup_pending(conn: &Connection, root: &Path) -> Result<u64, Error> {
    cleanup_pending_with(conn, root, &|path| fs::remove_file(path))
}
fn cleanup_pending_with(
    conn: &Connection,
    root: &Path,
    remove: &impl Fn(&Path) -> std::io::Result<()>,
) -> Result<u64, Error> {
    cleanup_paths(
        conn,
        root,
        strings(conn, "SELECT relative_path FROM pending_file_deletions")?,
        remove,
    )
}
fn cleanup_paths(
    conn: &Connection,
    root: &Path,
    names: Vec<String>,
    remove: &impl Fn(&Path) -> std::io::Result<()>,
) -> Result<u64, Error> {
    let mut failed = 0;
    for name in names {
        let result = managed_path(root, &name).and_then(|path| {
            // A retained attachment always wins over stale/malformed outbox data.
            if conn.query_row(
                "SELECT count(*) FROM attachments WHERE relative_path=?1",
                [&name],
                |r| r.get::<_, u64>(0),
            )? > 0
            {
                return Err(Error::DeletionSharedIntegrity);
            }
            match remove(&path) {
                Ok(()) => (),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(e.into()),
            }
            // Persist the unlink before acknowledging it in SQL. On platforms
            // with directory fsync, a crash cannot resurrect an untracked file.
            if root.join("attachments").exists() {
                vault_operation::sync_directory(&root.join("attachments"))?;
            }
            Ok(())
        });
        if result.is_ok() {
            if conn
                .execute(
                    "DELETE FROM pending_file_deletions WHERE relative_path=?1",
                    [&name],
                )
                .is_err()
            {
                failed += 1;
            }
        } else {
            failed += 1;
        }
    }
    Ok(failed)
}

pub fn commit<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: &DeletionInput,
    backup_destination: Option<&Path>,
) -> Result<DeletionResult, Error> {
    let generation = state.generation();
    let master = state.unlocked()?;
    let root = db::app_dir(app)?;
    let (security_path, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    let plan = plan(&conn, &root, &input.target)?;
    {
        let guard = state.deletion.lock().map_err(|_| Error::Operation)?;
        verify(
            guard.as_ref().ok_or(Error::DeletionPreviewExpired)?,
            input,
            generation,
            &plan.fingerprint,
        )?;
    }
    let all = input.target == DeletionTarget::All;
    if all {
        let file = security::read_security(&security_path)?;
        let authenticated = Zeroizing::new(security::master_from_password(&file, &input.password)?);
        if *authenticated != *master {
            return Err(Error::InvalidPassword);
        }
    }
    if input.backup_first {
        if all {
            let destination = backup_destination.ok_or(Error::Validation)?;
            // The chosen file's parent must already exist. Canonicalization
            // resolves symlinks so an in-vault backup cannot be erased below.
            let parent = destination
                .parent()
                .ok_or(Error::Validation)?
                .canonicalize()?;
            if parent.starts_with(root.canonicalize()?) {
                return Err(Error::Validation);
            }
        }
        let stamp = time::OffsetDateTime::now_utc()
            .format(time::macros::format_description!(
                "[year]-[month]-[day]-[hour]-[minute]-[second]"
            ))
            .map_err(|_| Error::Operation)?;
        let filename = backup_service::create(app, state, &stamp)?;
        if let Some(destination) = backup_destination {
            backup_service::save_copy(&root.join("Backups").join(filename), destination)?;
        }
    }
    // Lock may run while a worker creates a backup. It invalidates preview and
    // prevents any later deletion, even after a subsequent unlock.
    state.check_generation(generation)?;
    state.deletion.lock().map_err(|_| Error::Operation)?.take();
    let _attachments = state.lock_attachment_operations()?;
    if all {
        vault_operation::begin_delete(&root)?;
    }
    if let Err(error) = delete_rows(&conn, &input.target) {
        if all {
            vault_operation::cancel_delete(&root)?;
        }
        return Err(error);
    }
    if all {
        drop(conn); // Windows cannot unlink an open SQLCipher connection.
        app_service::lock(state)?;
        let (failed_managed_files, failed_vault_entries) = vault_operation::finish_delete(&root)?;
        Ok(DeletionResult {
            failed_managed_files,
            failed_vault_entries,
            reset_complete: failed_vault_entries == 0,
            backup_created: input.backup_first,
        })
    } else {
        Ok(DeletionResult {
            failed_managed_files: cleanup_paths(&conn, &root, plan.files, &|path| {
                fs::remove_file(path)
            })?,
            backup_created: input.backup_first,
            ..Default::default()
        })
    }
}

pub fn retry_cleanup<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<DeletionResult, Error> {
    let root = db::app_dir(app)?;
    if vault_operation::deletion_pending(&root) {
        app_service::lock(state)?;
        let (failed_managed_files, failed_vault_entries) = vault_operation::finish_delete(&root)?;
        return Ok(DeletionResult {
            failed_managed_files,
            failed_vault_entries,
            reset_complete: failed_vault_entries == 0,
            ..Default::default()
        });
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    Ok(DeletionResult {
        failed_managed_files: cleanup_pending(&conn, &root)?,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn id(n: u32) -> String {
        format!("00000000-0000-0000-0000-{n:012}")
    }
    fn fixture() -> (Connection, tempfile::TempDir) {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("attachments")).unwrap();
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", true).unwrap();
        db::migrate(&conn).unwrap();
        for n in [1, 2] {
            conn.execute("INSERT INTO clients(id,internal_number,full_name,archived_at,created_at,updated_at) VALUES (?1,?1,?1,'now','now','now')", [id(n)]).unwrap();
        }
        for (case, client) in [(10, 1), (11, 2)] {
            conn.execute("INSERT INTO cases(id,internal_number,archived_at,created_at,updated_at) VALUES (?1,?1,'now','now','now')", [id(case)]).unwrap();
            conn.execute("INSERT INTO case_clients(case_id,client_id,created_at,updated_at) VALUES (?1,?2,'now','now')", [id(case), id(client)]).unwrap();
            conn.execute("INSERT INTO payments(id,case_id,payer_client_id,amount_minor,payment_date,created_at,updated_at) VALUES (?1,?2,?3,125,'2026-10-21','now','now')", [id(case+50),id(case),id(client)]).unwrap();
            conn.execute("INSERT INTO hearings(id,case_id,hearing_date,created_at,updated_at) VALUES (?1,?2,'2026-10-21','now','now')", [id(case+20),id(case)]).unwrap();
        }
        conn.execute("INSERT INTO powers_of_attorney(id,internal_sequence,archived_at,created_at,updated_at) VALUES (?1,?1,'now','now','now')", [id(20)]).unwrap();
        conn.execute(
            "INSERT INTO power_of_attorney_clients VALUES (?1,?2,'now')",
            [id(20), id(1)],
        )
        .unwrap();
        conn.execute("INSERT INTO power_of_attorney_lawyers(id,power_of_attorney_id,full_name,created_at,updated_at) VALUES (?1,?2,'lawyer','now','now')", [id(21),id(20)]).unwrap();
        conn.execute("INSERT INTO case_opponents(id,case_id,full_name,created_at,updated_at) VALUES (?1,?2,'opponent','now','now')", [id(22),id(10)]).unwrap();
        conn.execute("INSERT INTO case_fee_agreements(id,case_id,amount_minor,created_at,updated_at) VALUES (?1,?2,500,'now','now')", [id(23),id(10)]).unwrap();
        for (n, column, owner) in [
            (40, "case_id", Some(10)),
            (41, "client_id", Some(1)),
            (42, "client_id", None),
        ] {
            conn.execute(&format!("INSERT INTO tasks(id,{column},title,due_date,created_at,updated_at) VALUES (?1,?2,'task','2026-10-21','now','now')"), rusqlite::params![id(n),owner.map(id)]).unwrap();
        }
        for (n, column, owner) in [
            (50, "case_id", Some(10)),
            (51, "client_id", Some(1)),
            (52, "client_id", None),
        ] {
            conn.execute(&format!("INSERT INTO expenses(id,{column},amount_minor,expense_date,expense_type,created_at,updated_at) VALUES (?1,?2,99,'2026-10-21','OTHER','now','now')"), rusqlite::params![id(n),owner.map(id)]).unwrap();
        }
        for (n, column, owner) in [
            (70, "client_id", 1),
            (71, "case_id", 10),
            (72, "power_of_attorney_id", 20),
            (73, "expense_id", 50),
            (74, "expense_id", 51),
            (75, "client_id", 2),
        ] {
            let name = format!("{}.pdf", id(n));
            conn.execute(&format!("INSERT INTO attachments(id,{column},original_filename,stored_filename,relative_path,file_size_bytes,sha256,created_at,updated_at) VALUES (?1,?2,'test.pdf',?3,?3,4,?4,'now','now')"), rusqlite::params![id(n),id(owner),name,"a".repeat(64)]).unwrap();
            fs::write(root.path().join("attachments").join(name), b"test").unwrap();
        }
        search_service::rebuild_with(&conn).unwrap();
        (conn, root)
    }
    fn input(target: DeletionTarget) -> DeletionInput {
        DeletionInput {
            target,
            token: "capability".into(),
            confirmation: "حذف".into(),
            password: String::new(),
            backup_first: false,
        }
    }
    fn prepared(input: &DeletionInput, plan: &Plan) -> PreparedDeletion {
        PreparedDeletion {
            token: input.token.clone(),
            target: input.target.clone(),
            fingerprint: plan.fingerprint.clone(),
            generation: 4,
            word: "حذف".into(),
        }
    }
    fn check_fk(conn: &Connection) {
        assert_eq!(
            scalar(conn, "SELECT count(*) FROM pragma_foreign_key_check").unwrap(),
            0
        );
    }

    #[test]
    fn client_preview_and_transaction_remove_exclusive_records_and_keep_other_clients_and_office_work(
    ) {
        let (conn, root) = fixture();
        let target = DeletionTarget::Client { id: id(1) };
        let preview = plan(&conn, root.path(), &target).unwrap();
        for (table, count) in [
            ("clients", 1),
            ("cases", 1),
            ("powers_of_attorney", 1),
            ("hearings", 1),
            ("tasks", 2),
            ("payments", 1),
            ("expenses", 2),
            ("attachments", 5),
            ("case_clients", 1),
            ("case_opponents", 1),
            ("case_fee_agreements", 1),
            ("power_of_attorney_clients", 1),
            ("power_of_attorney_lawyers", 1),
        ] {
            assert_eq!(preview.counts[table], count, "{table}");
        }
        assert_eq!(preview.managed_files, 5);
        let input = input(target.clone());
        verify(&prepared(&input, &preview), &input, 4, &preview.fingerprint).unwrap();
        delete_rows(&conn, &target).unwrap();
        assert_eq!(cleanup_pending(&conn, root.path()).unwrap(), 0);
        for table in [
            "clients",
            "cases",
            "hearings",
            "tasks",
            "payments",
            "expenses",
            "attachments",
        ] {
            assert_eq!(
                scalar(&conn, &format!("SELECT count(*) FROM {table}")).unwrap(),
                1,
                "{table}"
            );
        }
        assert_eq!(
            scalar(&conn, "SELECT count(*) FROM powers_of_attorney").unwrap(),
            0
        );
        assert_eq!(
            scalar(&conn, "SELECT count(*) FROM search_index").unwrap(),
            2
        );
        assert_eq!(
            fs::read_dir(root.path().join("attachments"))
                .unwrap()
                .count(),
            1
        );
        check_fk(&conn);
    }
    #[test]
    fn case_preview_removes_case_scoped_work_and_preserves_client_poa_and_direct_client_records() {
        let (conn, root) = fixture();
        let target = DeletionTarget::Case { id: id(10) };
        let preview = plan(&conn, root.path(), &target).unwrap();
        assert_eq!(preview.counts["clients"], 0);
        assert_eq!(preview.counts["powers_of_attorney"], 0);
        assert_eq!(preview.counts["attachments"], 2);
        assert_eq!(preview.managed_files, 2);
        assert_eq!(preview.counts["expenses"], 1);
        assert_eq!(preview.counts["tasks"], 1);
        delete_rows(&conn, &target).unwrap();
        assert_eq!(cleanup_pending(&conn, root.path()).unwrap(), 0);
        assert_eq!(scalar(&conn, "SELECT count(*) FROM clients").unwrap(), 2);
        assert_eq!(
            scalar(&conn, "SELECT count(*) FROM powers_of_attorney").unwrap(),
            1
        );
        assert_eq!(scalar(&conn, "SELECT count(*) FROM tasks").unwrap(), 2);
        assert_eq!(scalar(&conn, "SELECT count(*) FROM expenses").unwrap(), 2);
        assert_eq!(
            fs::read_dir(root.path().join("attachments"))
                .unwrap()
                .count(),
            4
        );
        check_fk(&conn);
    }
    #[test]
    fn client_and_case_require_archiving_in_preview_and_commit_recheck() {
        for (table, target) in [
            ("clients", DeletionTarget::Client { id: id(1) }),
            ("cases", DeletionTarget::Case { id: id(10) }),
        ] {
            let (conn, root) = fixture();
            plan(&conn, root.path(), &target).unwrap();
            conn.execute(&format!("UPDATE {table} SET archived_at=NULL"), [])
                .unwrap();
            assert!(matches!(
                plan(&conn, root.path(), &target),
                Err(Error::DeletionNotArchived)
            ));
            assert_eq!(
                scalar(&conn, "SELECT count(*) FROM attachments").unwrap(),
                6
            );
        }
        for table in ["cases", "powers_of_attorney"] {
            let (conn, root) = fixture();
            conn.execute(&format!("UPDATE {table} SET archived_at=NULL"), [])
                .unwrap();
            assert!(matches!(
                plan(&conn, root.path(), &DeletionTarget::Client { id: id(1) }),
                Err(Error::DeletionNotArchived)
            ));
        }
    }
    #[test]
    fn shared_cases_and_poas_block_client_and_shared_case_deletion() {
        for table in ["case_clients", "power_of_attorney_clients"] {
            let (conn, root) = fixture();
            let owner = if table == "case_clients" { 10 } else { 20 };
            let values = if table == "case_clients" {
                "?1,?2,NULL,NULL,NULL,'now','now'"
            } else {
                "?1,?2,'now'"
            };
            conn.execute(
                &format!("INSERT INTO {table} VALUES ({values})"),
                [id(owner), id(2)],
            )
            .unwrap();
            assert!(matches!(
                plan(&conn, root.path(), &DeletionTarget::Client { id: id(1) }),
                Err(Error::DeletionSharedIntegrity)
            ));
            if table == "case_clients" {
                assert!(matches!(
                    plan(&conn, root.path(), &DeletionTarget::Case { id: id(10) }),
                    Err(Error::DeletionSharedIntegrity)
                ));
            }
            check_fk(&conn);
        }
    }
    #[test]
    fn retained_hearing_and_duplicate_managed_path_block_partial_deletion() {
        for target in [
            DeletionTarget::Client { id: id(1) },
            DeletionTarget::Case { id: id(10) },
        ] {
            let (conn, root) = fixture();
            conn.execute(
                "UPDATE hearings SET previous_hearing_id=?1 WHERE id=?2",
                [id(30), id(31)],
            )
            .unwrap();
            assert!(matches!(
                plan(&conn, root.path(), &target),
                Err(Error::DeletionSharedIntegrity)
            ));
            conn.execute("UPDATE hearings SET previous_hearing_id=NULL", [])
                .unwrap();
            conn.execute(
                "UPDATE attachments SET relative_path=?1 WHERE id=?2",
                [format!("{}.pdf", id(71)), id(75)],
            )
            .unwrap();
            assert!(matches!(
                plan(&conn, root.path(), &target),
                Err(Error::DeletionSharedIntegrity)
            ));
        }
    }
    #[test]
    fn all_three_targets_verify_text_token_target_and_session_and_reject_stale_same_count_edits() {
        for target in [
            DeletionTarget::Client { id: id(1) },
            DeletionTarget::Case { id: id(10) },
            DeletionTarget::All,
        ] {
            let (conn, root) = fixture();
            let plan = plan(&conn, root.path(), &target).unwrap();
            let mut input = input(target);
            let prepared = prepared(&input, &plan);
            input.confirmation = "wrong".into();
            assert!(matches!(
                verify(&prepared, &input, 4, &plan.fingerprint),
                Err(Error::DeletionConfirmation)
            ));
            input.confirmation = "حذف".into();
            input.token = "fabricated".into();
            assert!(matches!(
                verify(&prepared, &input, 4, &plan.fingerprint),
                Err(Error::DeletionPreviewExpired)
            ));
            input.token = prepared.token.clone();
            let original = input.target.clone();
            input.target = DeletionTarget::Client { id: id(999) };
            assert!(matches!(
                verify(&prepared, &input, 4, &plan.fingerprint),
                Err(Error::DeletionPreviewExpired)
            ));
            input.target = original;
            assert!(matches!(
                verify(&prepared, &input, 5, &plan.fingerprint),
                Err(Error::DeletionPreviewExpired)
            ));
            conn.execute(
                "UPDATE clients SET notes='changed without changing counts'",
                [],
            )
            .unwrap();
            let changed = super::plan(&conn, root.path(), &input.target).unwrap();
            assert!(matches!(
                verify(&prepared, &input, 4, &changed.fingerprint),
                Err(Error::DeletionPreviewExpired)
            ));
            assert_eq!(scalar(&conn, "SELECT count(*) FROM clients").unwrap(), 2);
        }
    }
    #[test]
    fn per_record_file_failures_are_counted_tracked_and_retryable_after_commit() {
        for target in [
            DeletionTarget::Client { id: id(1) },
            DeletionTarget::Case { id: id(10) },
        ] {
            let (conn, root) = fixture();
            let plan = plan(&conn, root.path(), &target).unwrap();
            delete_rows(&conn, &target).unwrap();
            let failure = |_: &Path| {
                Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "injected",
                ))
            };
            assert_eq!(
                cleanup_pending_with(&conn, root.path(), &failure).unwrap(),
                plan.managed_files
            );
            assert_eq!(
                scalar(&conn, "SELECT count(*) FROM pending_file_deletions").unwrap(),
                plan.managed_files
            );
            check_fk(&conn);
            assert_eq!(cleanup_pending(&conn, root.path()).unwrap(), 0);
            assert_eq!(
                scalar(&conn, "SELECT count(*) FROM pending_file_deletions").unwrap(),
                0
            );
        }
    }
    #[test]
    fn cleanup_missing_files_is_idempotent_and_never_removes_a_retained_attachment() {
        let (conn, root) = fixture();
        conn.execute(
            "INSERT INTO pending_file_deletions VALUES ('already-missing.pdf')",
            [],
        )
        .unwrap();
        assert_eq!(cleanup_pending(&conn, root.path()).unwrap(), 0);
        let retained = format!("{}.pdf", id(75));
        conn.execute(
            "INSERT INTO pending_file_deletions VALUES (?1)",
            [&retained],
        )
        .unwrap();
        assert_eq!(cleanup_pending(&conn, root.path()).unwrap(), 1);
        assert!(root.path().join("attachments").join(retained).is_file());
        assert_eq!(
            scalar(&conn, "SELECT count(*) FROM attachments").unwrap(),
            6
        );
    }
    #[test]
    fn transaction_failure_rolls_back_every_row_and_outbox_and_keeps_all_files() {
        for target in [
            DeletionTarget::Client { id: id(1) },
            DeletionTarget::Case { id: id(10) },
            DeletionTarget::All,
        ] {
            let (conn, root) = fixture();
            plan(&conn, root.path(), &target).unwrap();
            conn.execute_batch("CREATE TRIGGER fail_deletion BEFORE DELETE ON cases BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
            assert!(delete_rows(&conn, &target).is_err());
            assert_eq!(
                scalar(&conn, "SELECT count(*) FROM attachments").unwrap(),
                6
            );
            assert_eq!(
                scalar(&conn, "SELECT count(*) FROM pending_file_deletions").unwrap(),
                0
            );
            assert_eq!(
                fs::read_dir(root.path().join("attachments"))
                    .unwrap()
                    .count(),
                6
            );
            check_fk(&conn);
        }
    }
    #[test]
    fn whole_vault_preview_counts_and_reset_remove_records_backups_snapshots_and_stranded_files() {
        let (conn, root) = fixture();
        fs::write(root.path().join("legalmaster.sqlite"), b"db").unwrap();
        fs::write(root.path().join("security.json"), b"envelopes").unwrap();
        fs::create_dir(root.path().join("Backups")).unwrap();
        fs::write(root.path().join("Backups/old.lmsbackup"), b"backup").unwrap();
        fs::create_dir_all(root.path().join("EmergencySnapshots/old/attachments")).unwrap();
        fs::write(
            root.path()
                .join("EmergencySnapshots/old/attachments/old.pdf"),
            b"snapshot",
        )
        .unwrap();
        fs::write(root.path().join("attachments/stranded.pdf"), b"stranded").unwrap();
        let preview = plan(&conn, root.path(), &DeletionTarget::All).unwrap();
        assert_eq!(preview.counts["clients"], 2);
        assert_eq!(preview.counts["attachments"], 6);
        assert_eq!(preview.vault_files, 11);
        assert_eq!(preview.managed_files, 7);
        vault_operation::begin_delete(root.path()).unwrap();
        delete_rows(&conn, &DeletionTarget::All).unwrap();
        for (table, _) in TABLES {
            assert_eq!(
                scalar(&conn, &format!("SELECT count(*) FROM {table}")).unwrap(),
                0
            );
        }
        check_fk(&conn);
        assert_eq!(vault_operation::finish_delete(root.path()).unwrap(), (0, 0));
        assert!(!db::has_vault_artifacts(root.path()).unwrap());
    }
    #[test]
    fn path_escape_and_directory_symlinks_cannot_remove_outside_files() {
        let (conn, root) = fixture();
        conn.execute(
            "UPDATE attachments SET relative_path='../outside' WHERE id=?1",
            [id(71)],
        )
        .unwrap();
        assert!(matches!(
            plan(&conn, root.path(), &DeletionTarget::Case { id: id(10) }),
            Err(Error::Validation)
        ));
        conn.execute(
            "INSERT INTO pending_file_deletions VALUES ('../outside')",
            [],
        )
        .unwrap();
        assert_eq!(cleanup_pending(&conn, root.path()).unwrap(), 1);
    }
}
