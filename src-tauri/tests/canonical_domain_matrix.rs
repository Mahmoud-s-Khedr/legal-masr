use legalmaster_lib::{
    db,
    dto::{ExpenseDto, FeeAgreementInput, PaymentDto, TaskDto},
    repositories::{
        case_repository, client_repository, finance_repository, hearing_repository, task_repository,
    },
    security,
};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

fn id() -> String {
    Uuid::new_v4().to_string()
}

fn connection() -> (tempfile::TempDir, Connection) {
    let directory = tempfile::tempdir().unwrap();
    let connection = db::create_db(
        &directory.path().join("vault.sqlite"),
        &security::random_32(),
    )
    .unwrap();
    db::migrate(&connection).unwrap();
    (directory, connection)
}

fn client(connection: &Connection, number: &str, name: &str) -> String {
    let client_id = id();
    connection
        .execute(
            "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')",
            params![client_id, number, name],
        )
        .unwrap();
    client_id
}

fn case(connection: &Connection, number: &str) -> String {
    let case_id = id();
    connection
        .execute(
            "INSERT INTO cases (id, internal_number, official_number, official_year, status, created_at, updated_at) VALUES (?1, ?2, '42', 2026, 'ACTIVE', 'now', 'now')",
            params![case_id, number],
        )
        .unwrap();
    case_id
}

#[test]
fn clients_archive_without_reusing_identifiers_and_poa_official_numbers_can_repeat() {
    let (_directory, connection) = connection();
    let first = client(&connection, "CL-1", "أحمد");
    assert!(connection
        .execute(
            "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'مكرر', 'now', 'now')",
            [id()],
        )
        .is_err());
    client_repository::set_archived(&connection, &first, true, "later").unwrap();
    assert!(client_repository::list(&connection, None, false)
        .unwrap()
        .is_empty());
    assert_eq!(
        client_repository::list(&connection, None, true)
            .unwrap()
            .len(),
        1
    );
    assert!(connection
        .execute(
            "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'لا يسمح', 'now', 'now')",
            [id()],
        )
        .is_err());
    client_repository::set_archived(&connection, &first, false, "restored").unwrap();

    for sequence in ["TA-1", "TA-2"] {
        connection
            .execute(
                "INSERT INTO powers_of_attorney (id, internal_sequence, official_number, issue_year, created_at, updated_at) VALUES (?1, ?2, '777', 2026, 'now', 'now')",
                params![id(), sequence],
            )
            .unwrap();
    }
    let repeated: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM powers_of_attorney WHERE official_number = '777'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(repeated, 2);
}

#[test]
fn relationship_capacity_opponents_hearing_chains_task_views_and_finance_totals_are_preserved() {
    let (_directory, connection) = connection();
    let payer = client(&connection, "CL-1", "أحمد");
    let other = client(&connection, "CL-2", "منى");
    let case_id = case(&connection, "CA-1");
    connection
        .execute(
            "INSERT INTO powers_of_attorney (id, internal_sequence, created_at, updated_at) VALUES (?1, 'TA-1', 'now', 'now')",
            [id()],
        )
        .unwrap();
    let poa_id: String = connection
        .query_row("SELECT id FROM powers_of_attorney", [], |row| row.get(0))
        .unwrap();
    connection
        .execute(
            "INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')",
            params![poa_id, payer],
        )
        .unwrap();
    connection
        .execute(
            "INSERT INTO case_clients (case_id, client_id, legal_capacity, power_of_attorney_id, notes, created_at, updated_at) VALUES (?1, ?2, 'مدعٍ', ?3, 'صفة مستقلة', 'now', 'now')",
            params![case_id, payer, poa_id],
        )
        .unwrap();
    assert!(connection
        .execute(
            "INSERT INTO case_clients (case_id, client_id, power_of_attorney_id, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')",
            params![case_id, other, poa_id],
        )
        .is_err());
    case_repository::insert_opponent(
        &connection,
        &id(),
        &case_id,
        "الخصم",
        Some("مدعى عليه"),
        Some("المحامي"),
        None,
        None,
        None,
        "now",
    )
    .unwrap();
    let opponent_id: String = connection
        .query_row("SELECT id FROM case_opponents", [], |row| row.get(0))
        .unwrap();
    assert_eq!(
        case_repository::update_opponent(
            &connection,
            &opponent_id,
            "خصم محدث",
            None,
            None,
            None,
            None,
            None,
            "later",
        )
        .unwrap()
        .full_name,
        "خصم محدث"
    );

    let first_hearing = id();
    let next_hearing = id();
    for (hearing_id, previous, date) in [
        (&first_hearing, None, "2026-08-24"),
        (&next_hearing, Some(&first_hearing), "2026-09-01"),
    ] {
        connection
            .execute(
                "INSERT INTO hearings (id, case_id, previous_hearing_id, hearing_date, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'SCHEDULED', 'now', 'now')",
                params![hearing_id, case_id, previous, date],
            )
            .unwrap();
    }
    hearing_repository::complete(&connection, &first_hearing, Some("تأجيل"), "later").unwrap();
    assert_eq!(
        hearing_repository::get(&connection, &first_hearing)
            .unwrap()
            .status,
        "COMPLETED"
    );
    hearing_repository::delete(&connection, &first_hearing).unwrap();
    assert_eq!(
        hearing_repository::get(&connection, &next_hearing)
            .unwrap()
            .previous_hearing_id,
        None
    );

    for (due_date, completed) in [
        ("2026-08-23", false),
        ("2026-08-24", false),
        ("2026-08-25", false),
        ("2026-08-01", true),
    ] {
        task_repository::insert(
            &connection,
            &TaskDto {
                id: id(),
                client_id: Some(payer.clone()),
                case_id: Some(case_id.clone()),
                title: "مهمة".into(),
                details: None,
                notes: None,
                due_date: due_date.into(),
                reminder_minutes: None,
                completed,
                completed_at: completed.then_some("now".into()),
                created_at: "now".into(),
                updated_at: "now".into(),
            },
        )
        .unwrap();
    }
    for view in ["OVERDUE", "TODAY", "UPCOMING", "COMPLETED"] {
        assert_eq!(
            task_repository::list(&connection, Some(view), "2026-08-24", Some(&case_id), None)
                .unwrap()
                .len(),
            1
        );
    }

    finance_repository::upsert_fee_agreement(
        &connection,
        &id(),
        &FeeAgreementInput {
            case_id: case_id.clone(),
            amount_minor: 1_000,
            agreement_date: None,
            notes: None,
        },
        "now",
    )
    .unwrap();
    finance_repository::insert_payment(
        &connection,
        &PaymentDto {
            id: id(),
            case_id: case_id.clone(),
            payer_client_id: payer.clone(),
            amount_minor: 400,
            payment_date: "2026-08-24".into(),
            payment_method: None,
            notes: None,
            created_at: "now".into(),
            updated_at: "now".into(),
        },
    )
    .unwrap();
    assert!(connection
        .execute(
            "INSERT INTO payments (id, case_id, payer_client_id, amount_minor, payment_date, created_at, updated_at) VALUES (?1, ?2, ?3, 1, '2026-08-24', 'now', 'now')",
            params![id(), case_id, other],
        )
        .is_err());
    for (case_link, client_link, amount) in [
        (None, None, 10),
        (Some(case_id.clone()), None, 20),
        (None, Some(payer.clone()), 30),
        (Some(case_id.clone()), Some(payer.clone()), 40),
    ] {
        finance_repository::insert_expense(
            &connection,
            &ExpenseDto {
                id: id(),
                case_id: case_link,
                client_id: client_link,
                amount_minor: amount,
                expense_date: "2026-08-24".into(),
                expense_type: "OTHER".into(),
                notes: None,
                created_at: "now".into(),
                updated_at: "now".into(),
            },
        )
        .unwrap();
    }
    let summary = finance_repository::case_summary(&connection, &case_id).unwrap();
    assert_eq!(summary.received_minor, 400);
    assert_eq!(summary.outstanding_minor, 600);
    assert_eq!(summary.expenses_minor, 60);
    assert_eq!(summary.net_cash_minor, 340);
    let client_summary = finance_repository::client_summary(&connection, &payer).unwrap();
    assert_eq!(client_summary.expenses_minor, 70);
}

#[test]
fn every_foreign_key_delete_policy_and_its_cascade_or_restriction_are_enforced() {
    let (_directory, connection) = connection();
    let expected = [
        ("power_of_attorney_clients", "powers_of_attorney", "CASCADE"),
        ("power_of_attorney_clients", "clients", "RESTRICT"),
        ("power_of_attorney_lawyers", "powers_of_attorney", "CASCADE"),
        ("case_clients", "cases", "CASCADE"),
        ("case_clients", "clients", "RESTRICT"),
        ("case_clients", "power_of_attorney_clients", "RESTRICT"),
        ("case_opponents", "cases", "CASCADE"),
        ("hearings", "cases", "CASCADE"),
        ("hearings", "hearings", "SET NULL"),
        ("tasks", "clients", "SET NULL"),
        ("tasks", "cases", "SET NULL"),
        ("case_fee_agreements", "cases", "CASCADE"),
        ("payments", "case_clients", "RESTRICT"),
        ("expenses", "cases", "SET NULL"),
        ("expenses", "clients", "SET NULL"),
        ("attachments", "clients", "CASCADE"),
        ("attachments", "cases", "CASCADE"),
        ("attachments", "powers_of_attorney", "CASCADE"),
        ("attachments", "expenses", "CASCADE"),
    ];
    for (table, referenced_table, action) in expected {
        let found: bool = connection
            .prepare(&format!("PRAGMA foreign_key_list({table})"))
            .unwrap()
            .query_map([], |row| {
                Ok((row.get::<_, String>(2)?, row.get::<_, String>(6)?))
            })
            .unwrap()
            .flatten()
            .any(|result| result == (referenced_table.into(), action.into()));
        assert!(
            found,
            "{table} must reference {referenced_table} ON DELETE {action}"
        );
    }

    let client_id = client(&connection, "CL-1", "أحمد");
    let case_id = case(&connection, "CA-1");
    let poa_id = id();
    connection.execute("INSERT INTO powers_of_attorney (id, internal_sequence, created_at, updated_at) VALUES (?1, 'TA-1', 'now', 'now')", [&poa_id]).unwrap();
    connection.execute("INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')", params![poa_id, client_id]).unwrap();
    connection.execute("INSERT INTO power_of_attorney_lawyers (id, power_of_attorney_id, full_name, created_at, updated_at) VALUES (?1, ?2, 'محامٍ', 'now', 'now')", params![id(), poa_id]).unwrap();
    connection.execute("INSERT INTO case_clients (case_id, client_id, power_of_attorney_id, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![case_id, client_id, poa_id]).unwrap();
    connection.execute("INSERT INTO case_opponents (id, case_id, full_name, created_at, updated_at) VALUES (?1, ?2, 'خصم', 'now', 'now')", params![id(), case_id]).unwrap();
    connection.execute("INSERT INTO hearings (id, case_id, hearing_date, created_at, updated_at) VALUES (?1, ?2, '2026-08-24', 'now', 'now')", params![id(), case_id]).unwrap();
    connection.execute("INSERT INTO tasks (id, client_id, case_id, title, due_date, created_at, updated_at) VALUES (?1, ?2, ?3, 'مهمة', '2026-08-24', 'now', 'now')", params![id(), client_id, case_id]).unwrap();
    connection.execute("INSERT INTO case_fee_agreements (id, case_id, amount_minor, created_at, updated_at) VALUES (?1, ?2, 100, 'now', 'now')", params![id(), case_id]).unwrap();
    let payment_id = id();
    connection.execute("INSERT INTO payments (id, case_id, payer_client_id, amount_minor, payment_date, created_at, updated_at) VALUES (?1, ?2, ?3, 100, '2026-08-24', 'now', 'now')", params![payment_id, case_id, client_id]).unwrap();
    let expense_id = id();
    connection.execute("INSERT INTO expenses (id, case_id, client_id, amount_minor, expense_date, expense_type, created_at, updated_at) VALUES (?1, ?2, ?3, 10, '2026-08-24', 'OTHER', 'now', 'now')", params![expense_id, case_id, client_id]).unwrap();
    for (owner_column, owner_id) in [
        ("case_id", &case_id),
        ("client_id", &client_id),
        ("power_of_attorney_id", &poa_id),
        ("expense_id", &expense_id),
    ] {
        connection.execute(&format!("INSERT INTO attachments (id, {owner_column}, original_filename, stored_filename, relative_path, file_size_bytes, sha256, created_at, updated_at) VALUES (?1, ?2, 'x.pdf', 'x.pdf', 'x.pdf', 1, ?3, 'now', 'now')"), params![id(), owner_id, "a".repeat(64)]).unwrap();
    }
    assert!(connection
        .execute("DELETE FROM cases WHERE id = ?1", [&case_id])
        .is_err());
    connection
        .execute("DELETE FROM payments WHERE id = ?1", [&payment_id])
        .unwrap();
    connection
        .execute("DELETE FROM cases WHERE id = ?1", [&case_id])
        .unwrap();
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM case_opponents", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM hearings", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM case_fee_agreements", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        connection
            .query_row("SELECT case_id FROM tasks", [], |row| row
                .get::<_, Option<String>>(0))
            .unwrap(),
        None
    );
    assert_eq!(
        connection
            .query_row("SELECT case_id FROM expenses", [], |row| row
                .get::<_, Option<String>>(0))
            .unwrap(),
        None
    );
    connection
        .execute("DELETE FROM powers_of_attorney WHERE id = ?1", [&poa_id])
        .unwrap();
    assert!(connection
        .execute("DELETE FROM clients WHERE id = ?1", [&client_id])
        .is_ok());
    assert_eq!(
        connection
            .query_row("SELECT client_id FROM tasks", [], |row| row
                .get::<_, Option<String>>(0))
            .unwrap(),
        None
    );
    assert_eq!(
        connection
            .query_row("SELECT client_id FROM expenses", [], |row| row
                .get::<_, Option<String>>(0))
            .unwrap(),
        None
    );
    connection
        .execute("DELETE FROM expenses WHERE id = ?1", [&expense_id])
        .unwrap();
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM attachments", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        connection
            .query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
            .unwrap(),
        "ok"
    );
    assert!(connection
        .query_row("PRAGMA foreign_key_check", [], |row| row
            .get::<_, String>(0))
        .optional()
        .unwrap()
        .is_none());
}
