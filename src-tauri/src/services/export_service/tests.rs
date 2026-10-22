use super::*;
use rusqlite::params;

const STAMP: &str = "2026-10-21-1234";
const C1: &str = "11111111-1111-1111-1111-111111111111";
const C2: &str = "22222222-2222-2222-2222-222222222222";
const K1: &str = "33333333-3333-3333-3333-333333333333";
const K2: &str = "44444444-4444-4444-4444-444444444444";
const P1: &str = "55555555-5555-5555-5555-555555555555";
const P2: &str = "66666666-6666-6666-6666-666666666666";
const H1: &str = "77777777-7777-7777-7777-777777777777";
const H2: &str = "88888888-8888-8888-8888-888888888888";
const E1: &str = "99999999-9999-9999-9999-999999999999";
const E2: &str = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ARABIC: &str = "أحمد, \"المحامي\"\nالقاهرة";

struct Fixture {
    _temp: tempfile::TempDir,
    conn: Connection,
    documents: PathBuf,
    destination: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let conn = db::create_db(&temp.path().join("test.sqlite"), &[9; 32]).unwrap();
        db::migrate(&conn).unwrap();
        let documents = temp.path().join("attachments");
        let destination = temp.path().join("exports");
        fs::create_dir(&documents).unwrap();
        fs::create_dir(&destination).unwrap();
        for (id, number, name) in [(C1, "1", ARABIC), (C2, "2", "private-other-client")] {
            conn.execute("INSERT INTO clients(id,internal_number,full_name,archived_at,created_at,updated_at) VALUES(?1,?2,?3,'2026-10-20T00:00:00Z','now','now')", params![id,number,name]).unwrap();
        }
        for (id, number) in [(K1, "قضية/12"), (K2, "private-other-case")] {
            conn.execute("INSERT INTO cases(id,internal_number,archived_at,filed_on,created_at,updated_at) VALUES(?1,?2,'2026-10-20T00:00:00Z','2026-10-01','now','now')", params![id,number]).unwrap();
        }
        for (case, client) in [(K1, C1), (K2, C1), (K2, C2)] {
            conn.execute("INSERT INTO case_clients(case_id,client_id,created_at,updated_at) VALUES(?1,?2,'now','now')", params![case,client]).unwrap();
        }
        for (id, archived) in [(P2, Some("2026-01-01")), (P1, None)] {
            conn.execute("INSERT INTO powers_of_attorney(id,internal_sequence,archived_at,created_at,updated_at) VALUES(?1,?1,?2,'now','now')", params![id,archived]).unwrap();
            conn.execute("INSERT INTO power_of_attorney_clients(power_of_attorney_id,client_id,created_at) VALUES(?1,?2,'now')",params![id,C1]).unwrap();
            conn.execute("INSERT INTO power_of_attorney_lawyers(id,power_of_attorney_id,full_name,created_at,updated_at) VALUES(?1,?1,'محامٍ','now','now')",[id]).unwrap();
        }
        conn.execute("INSERT INTO power_of_attorney_clients(power_of_attorney_id,client_id,created_at) VALUES(?1,?2,'now')",params![P1,C2]).unwrap();
        for (case, client, hearing, expense) in [(K2, C2, H2, E2), (K1, C1, H1, E1)] {
            conn.execute("INSERT INTO case_opponents(id,case_id,full_name,created_at,updated_at) VALUES(?1,?1,'خصم','now','now')",[case]).unwrap();
            conn.execute("INSERT INTO hearings(id,case_id,hearing_date,created_at,updated_at) VALUES(?1,?2,'2026-10-21','now','now')",params![hearing,case]).unwrap();
            conn.execute("INSERT INTO case_fee_agreements(id,case_id,amount_minor,created_at,updated_at) VALUES(?1,?1,12345,'now','now')",[case]).unwrap();
            conn.execute("INSERT INTO payments(id,case_id,payer_client_id,amount_minor,payment_date,created_at,updated_at) VALUES(?1,?1,?2,567,'2026-10-20','now','now')",params![case,client]).unwrap();
            conn.execute("INSERT INTO expenses(id,case_id,amount_minor,expense_date,expense_type,created_at,updated_at) VALUES(?1,?2,890,'2026-10-19','OTHER','now','now')",params![expense,case]).unwrap();
        }
        conn.execute(
            "UPDATE hearings SET previous_hearing_id = ?1 WHERE id = ?2",
            params![H2, H1],
        )
        .unwrap();
        for (id, case, client, title) in [
            (K1, Some(K1), None, "case-task"),
            (K2, Some(K2), None, "private-other-task"),
            (C1, None, Some(C1), "private-client-task"),
            (C2, None, None, "private-office-task"),
        ] {
            conn.execute("INSERT INTO tasks(id,case_id,client_id,title,due_date,created_at,updated_at) VALUES(?1,?2,?3,?4,'2026-10-22','now','now')",params![id,case,client,title]).unwrap();
        }
        for (id, client) in [(C1, Some(C1)), (C2, None)] {
            conn.execute("INSERT INTO expenses(id,client_id,amount_minor,expense_date,expense_type,created_at,updated_at) VALUES(?1,?2,222,'2026-10-19','OTHER','now','now')",params![id,client]).unwrap();
        }
        for (id, owner, column) in [
            (K1, K1, "case_id"),
            (K2, K2, "case_id"),
            (C1, C1, "client_id"),
            (C2, C2, "client_id"),
            (P1, P1, "power_of_attorney_id"),
            (P2, P2, "power_of_attorney_id"),
            (E1, E1, "expense_id"),
            (E2, E2, "expense_id"),
            (H1, C1, "expense_id"),
        ] {
            let name = format!("{id}.txt");
            let bytes = format!("document-{id}");
            fs::write(documents.join(&name), &bytes).unwrap();
            let hash = hex::encode(Sha256::digest(bytes.as_bytes()));
            conn.execute(&format!("INSERT INTO attachments(id,{column},original_filename,stored_filename,relative_path,file_size_bytes,sha256,created_at,updated_at) VALUES(?1,?2,'مستند.txt',?3,?3,?4,?5,'now','now')"),params![id,owner,name,bytes.len() as i64,hash]).unwrap();
        }
        conn.execute(
            "INSERT INTO pending_file_deletions(relative_path) VALUES('private-outbox.txt')",
            [],
        )
        .unwrap();
        Self {
            _temp: temp,
            conn,
            documents,
            destination,
        }
    }
    fn export(&mut self, case: Option<&str>) -> PathBuf {
        create(
            &mut self.conn,
            &self.documents,
            &self.destination,
            case,
            STAMP,
            || Ok(()),
        )
        .unwrap()
    }
}
fn csv(root: &Path, name: &str) -> String {
    fs::read_to_string(root.join(format!("{name}.csv"))).unwrap()
}
fn manifest(root: &Path) -> serde_json::Value {
    serde_json::from_slice(&fs::read(root.join("manifest.json")).unwrap()).unwrap()
}

#[test]
fn csv_escaping_and_formula_guard_are_reversible() {
    assert_eq!(text_cell(ARABIC), "\"أحمد, \"\"المحامي\"\"\nالقاهرة\"");
    assert_eq!(text_cell(""), "\"\"");
    for value in [
        "=1+1",
        " +123",
        "-2",
        "@SUM(A1)",
        "\tformula",
        "\rformula",
        "\nformula",
        "'original",
    ] {
        assert_eq!(text_cell(value), format!("\"'{value}\""));
    }
    assert_eq!(text_cell("2026-10-21"), "\"2026-10-21\"");
    assert_eq!(text_cell("أحمد"), "\"أحمد\"");
}

#[test]
fn complete_export_has_exact_inventory_counts_hashes_and_archived_rows() {
    let mut fixture = Fixture::new();
    let output = fixture.export(None);
    assert_eq!(
        output.file_name().unwrap(),
        "LegalMasr-export-2026-10-21-1234"
    );
    let manifest = manifest(&output);
    assert_eq!(manifest["formatVersion"], 1);
    assert_eq!(manifest["applicationVersion"], env!("CARGO_PKG_VERSION"));
    assert_eq!(manifest["schemaVersion"], db::latest_schema_version());
    assert_eq!(manifest["encrypted"], false);
    assert_eq!(manifest["scope"], "installation");
    assert!(manifest["caseId"].is_null());
    assert!(time::OffsetDateTime::parse(
        manifest["createdAt"].as_str().unwrap(),
        &time::format_description::well_known::Rfc3339
    )
    .is_ok());
    let counts = [2, 2, 2, 3, 2, 3, 2, 2, 4, 2, 2, 4, 9];
    for (table, count) in TABLES.iter().zip(counts) {
        assert_eq!(
            manifest["files"][format!("{}.csv", table.name)]["rowCount"],
            count
        );
        let bytes = fs::read(output.join(format!("{}.csv", table.name))).unwrap();
        assert!(bytes.starts_with(b"\xEF\xBB\xBF"));
        assert!(bytes.ends_with(b"\r\n"));
    }
    let entries = manifest["files"].as_object().unwrap();
    assert_eq!(entries.len(), TABLES.len() + 9);
    for (name, entry) in entries {
        let bytes = fs::read(output.join(name)).unwrap();
        assert_eq!(entry["sha256"], hex::encode(Sha256::digest(&bytes)));
        assert_eq!(entry["sizeBytes"], bytes.len() as u64);
        if name.starts_with("documents/") {
            assert!(entry["rowCount"].is_null());
        }
    }
    assert!(csv(&output, "clients").contains(&text_cell(ARABIC)));
    for table in ["clients", "cases"] {
        assert!(csv(&output, table).contains("\"2026-10-20T00:00:00Z\",1,"));
    }
    assert!(csv(&output, "powers_of_attorney").contains("\"2026-01-01\",1,"));
    assert!(csv(&output, "powers_of_attorney").contains(",,0,"));
    assert!(csv(&output, "payments").contains(",567,\"2026-10-20\","));
    assert!(csv(&output, "case_fee_agreements").contains(",12345,"));
    assert!(csv(&output, "expenses").contains(",890,\"2026-10-19\","));
    assert!(!output.join("pending_file_deletions.csv").exists());
    assert_eq!(fs::read_dir(&output).unwrap().count(), TABLES.len() + 2);
    assert_eq!(fs::read_dir(&fixture.destination).unwrap().count(), 1);
}

#[test]
fn case_scope_does_not_expand_through_shared_clients_poas_or_hearings() {
    let mut fixture = Fixture::new();
    let output = fixture.export(Some(K1));
    assert_eq!(
        output.file_name().unwrap(),
        "LegalMasr-export-2026-10-21-1234-case-قضية~2F12"
    );
    let summary = manifest(&output);
    assert_eq!(summary["scope"], "case");
    assert_eq!(summary["caseId"], K1);
    let counts = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4];
    for (table, count) in TABLES.iter().zip(counts) {
        assert_eq!(
            summary["files"][format!("{}.csv", table.name)]["rowCount"],
            count,
            "{}",
            table.name
        );
        let contents = csv(&output, table.name);
        for excluded in [
            K2,
            C2,
            P2,
            H2,
            E2,
            "private-other",
            "private-client-task",
            "private-office-task",
        ] {
            assert!(
                !contents.contains(excluded),
                "{} leaked {excluded}",
                table.name
            );
        }
    }
    assert!(csv(&output, "hearings").contains(&format!("\"{H1}\",\"{K1}\",,\"2026-10-21\"")));
    assert_eq!(
        summary["files"].as_object().unwrap().len(),
        TABLES.len() + 4
    );
    for id in [K1, C1, P1, E1] {
        assert!(output.join(format!("documents/{id}.txt")).is_file());
    }
    for id in [K2, C2, P2, E2, H1] {
        assert!(!output.join(format!("documents/{id}.txt")).exists());
    }
    fixture
        .conn
        .execute(
            "UPDATE powers_of_attorney SET archived_at = '2026-10-01' WHERE id = ?1",
            [P1],
        )
        .unwrap();
    let fallback = create(
        &mut fixture.conn,
        &fixture.documents,
        &fixture.destination,
        Some(K1),
        "2026-10-21-1235",
        || Ok(()),
    )
    .unwrap();
    assert!(csv(&fallback, "powers_of_attorney").contains(",1,"));
}

#[test]
fn empty_export_has_headers_and_zero_counts() {
    let temp = tempfile::tempdir().unwrap();
    let mut conn = db::create_db(&temp.path().join("empty.sqlite"), &[1; 32]).unwrap();
    db::migrate(&conn).unwrap();
    let output = create(
        &mut conn,
        &temp.path().join("missing-documents"),
        temp.path(),
        None,
        STAMP,
        || Ok(()),
    )
    .unwrap();
    let manifest = manifest(&output);
    assert_eq!(manifest["files"].as_object().unwrap().len(), TABLES.len());
    for table in TABLES {
        assert_eq!(
            manifest["files"][format!("{}.csv", table.name)]["rowCount"],
            0
        );
    }
}

#[test]
fn collision_refuses_files_directories_and_publication_race() {
    for directory in [false, true] {
        let mut fixture = Fixture::new();
        let target = fixture
            .destination
            .join(format!("LegalMasr-export-{STAMP}"));
        if directory {
            fs::create_dir(&target).unwrap();
        } else {
            fs::write(&target, b"preserve").unwrap();
        }
        assert!(create(
            &mut fixture.conn,
            &fixture.documents,
            &fixture.destination,
            None,
            STAMP,
            || Ok(())
        )
        .is_err());
        assert_eq!(fs::read_dir(&fixture.destination).unwrap().count(), 1);
        if !directory {
            assert_eq!(fs::read(&target).unwrap(), b"preserve");
        }
    }
    let temp = tempfile::tempdir().unwrap();
    let staged = temp.path().join("staged");
    let target = temp.path().join("target");
    fs::create_dir(&staged).unwrap();
    fs::write(staged.join("data"), b"new").unwrap();
    fs::create_dir(&target).unwrap();
    assert!(publish(&staged, &target).is_err());
    assert!(staged.join("data").exists());
    assert_eq!(fs::read_dir(target).unwrap().count(), 0);
}

#[test]
fn failed_documents_and_interruption_leave_no_complete_or_partial_output() {
    for failure in [
        "missing",
        "hash",
        "size",
        "symlink",
        "path",
        "duplicate",
        "cancel",
    ] {
        let mut fixture = Fixture::new();
        let source = fixture.documents.join(format!("{K1}.txt"));
        match failure {
            "missing" => fs::remove_file(&source).unwrap(),
            "hash" => fs::write(&source, b"damaged").unwrap(),
            "size" => {
                fixture
                    .conn
                    .execute(
                        "UPDATE attachments SET file_size_bytes = 0 WHERE id = ?1",
                        [K1],
                    )
                    .unwrap();
            }
            "path" => {
                fixture
                    .conn
                    .execute(
                        "UPDATE attachments SET relative_path = '../outside' WHERE id = ?1",
                        [K1],
                    )
                    .unwrap();
            }
            "duplicate" => {
                fixture.conn.execute("UPDATE attachments SET stored_filename = ?1, relative_path = ?1 WHERE id = ?2",params![format!("{K1}.txt"),K2]).unwrap();
            }
            "symlink" => {
                #[cfg(unix)]
                {
                    fs::remove_file(&source).unwrap();
                    std::os::unix::fs::symlink(
                        fixture.documents.join(format!("{K2}.txt")),
                        &source,
                    )
                    .unwrap();
                }
                #[cfg(not(unix))]
                {
                    fs::remove_file(&source).unwrap();
                }
            }
            _ => {}
        }
        let mut calls = 0;
        let result = create(
            &mut fixture.conn,
            &fixture.documents,
            &fixture.destination,
            None,
            STAMP,
            || {
                calls += 1;
                if failure == "cancel" && calls >= 20 {
                    Err(Error::Locked)
                } else {
                    Ok(())
                }
            },
        );
        assert!(result.is_err(), "{failure}");
        assert_eq!(
            fs::read_dir(&fixture.destination).unwrap().count(),
            0,
            "{failure}"
        );
        assert_eq!(
            fixture
                .conn
                .query_row("SELECT count(*) FROM clients", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            2
        );
    }
}

#[test]
fn invalid_scope_stamp_or_destination_has_no_output() {
    let mut fixture = Fixture::new();
    assert!(matches!(
        create(
            &mut fixture.conn,
            &fixture.documents,
            &fixture.destination,
            Some("missing"),
            STAMP,
            || Ok(())
        ),
        Err(Error::CaseNotFound)
    ));
    for stamp in ["../escape", "2026-02-30-1200", "2026-10-21-2500"] {
        assert!(matches!(
            create(
                &mut fixture.conn,
                &fixture.documents,
                &fixture.destination,
                None,
                stamp,
                || Ok(())
            ),
            Err(Error::Validation)
        ));
    }
    assert!(create(
        &mut fixture.conn,
        &fixture.documents,
        &fixture.destination.join("missing"),
        None,
        STAMP,
        || Ok(())
    )
    .is_err());
    assert_eq!(fs::read_dir(&fixture.destination).unwrap().count(), 0);
}

#[test]
fn reveal_capability_is_session_bound_and_never_accepts_a_path() {
    let state = crate::state::AppState::default();
    assert!(matches!(
        state.store_export(0, PathBuf::from("/fake")),
        Err(Error::Locked)
    ));
    *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([1; 32]));
    let token = state.store_export(0, PathBuf::from("/fake")).unwrap();
    assert_eq!(state.export_path(&token).unwrap(), PathBuf::from("/fake"));
    assert!(state.export_path("/fake").is_err());
    let replacement = state.store_export(0, PathBuf::from("/new")).unwrap();
    assert!(state.export_path(&token).is_err());
    state.advance_generation();
    assert!(state.export_path(&replacement).is_err());
    assert!(matches!(
        state.store_export(0, PathBuf::from("/stale")),
        Err(Error::Locked)
    ));
}

#[test]
fn selected_destination_must_be_an_existing_directory_outside_the_vault() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("vault");
    let inside = root.join("attachments");
    let outside = temp.path().join("outside");
    fs::create_dir(&root).unwrap();
    fs::create_dir(&inside).unwrap();
    fs::create_dir(&outside).unwrap();
    assert_eq!(
        destination_outside_vault(&root, &outside).unwrap(),
        outside.canonicalize().unwrap()
    );
    for bad in [&root, &inside, &temp.path().join("missing")] {
        assert!(destination_outside_vault(&root, bad).is_err());
    }
    let file = temp.path().join("file");
    fs::write(&file, b"file").unwrap();
    assert!(destination_outside_vault(&root, &file).is_err());
    #[cfg(unix)]
    {
        let alias = temp.path().join("alias");
        std::os::unix::fs::symlink(&inside, &alias).unwrap();
        assert!(destination_outside_vault(&root, &alias).is_err());
    }
}

#[test]
fn a_target_created_during_export_is_preserved_and_staging_is_removed() {
    let mut fixture = Fixture::new();
    let target = fixture
        .destination
        .join(format!("LegalMasr-export-{STAMP}"));
    let destination = fixture.destination.clone();
    let mut injected = false;
    let result = create(
        &mut fixture.conn,
        &fixture.documents,
        &fixture.destination,
        None,
        STAMP,
        || {
            if !injected
                && fs::read_dir(&destination)?
                    .filter_map(Result::ok)
                    .any(|entry| entry.path().join("manifest.json").exists())
            {
                fs::create_dir(&target)?;
                injected = true;
            }
            Ok(())
        },
    );
    assert!(injected);
    assert!(result.is_err());
    assert_eq!(fs::read_dir(&fixture.destination).unwrap().count(), 1);
    assert_eq!(fs::read_dir(target).unwrap().count(), 0);
}
