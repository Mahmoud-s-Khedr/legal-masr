use legalmaster_lib::{db, dto::PaymentDto, repositories::finance_repository, security};
use rusqlite::Connection;
fn db_conn() -> (tempfile::TempDir, Connection) {
    let dir = tempfile::tempdir().unwrap();
    let master = security::random_32();
    let conn = db::create_db(&dir.path().join("vault.sqlite"), &master).unwrap();
    db::migrate(&conn).unwrap();
    (dir, conn)
}
#[test]
fn database_rejects_payment_payer_that_is_not_a_case_client() {
    let (_dir, conn) = db_conn();
    let case_id = uuid::Uuid::new_v4().to_string();
    let client_id = uuid::Uuid::new_v4().to_string();
    conn.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-1', 'أحمد', 'now', 'now')", [&client_id]).unwrap();
    conn.execute("INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, 'CA-1', 'ACTIVE', 'now', 'now')", [&case_id]).unwrap();
    conn.execute("INSERT INTO case_clients (case_id, client_id, created_at, updated_at) VALUES (?1, ?2, 'now', 'now')", [&case_id, &client_id]).unwrap();
    let payment = PaymentDto {
        id: uuid::Uuid::new_v4().to_string(),
        case_id,
        payer_client_id: client_id,
        amount_minor: 500,
        payment_date: "2026-08-24".into(),
        payment_method: Some("CASH".into()),
        notes: None,
        created_at: "now".into(),
        updated_at: "now".into(),
    };
    finance_repository::insert_payment(&conn, &payment).unwrap();
    conn.execute(
        "DELETE FROM case_clients WHERE case_id = ?1 AND client_id = ?2",
        [&payment.case_id, &payment.payer_client_id],
    )
    .unwrap_err();
    let unlinked_client = uuid::Uuid::new_v4().to_string();
    conn.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-2', 'سارة', 'now', 'now')", [&unlinked_client]).unwrap();
    let unlinked_payment = PaymentDto {
        id: uuid::Uuid::new_v4().to_string(),
        payer_client_id: unlinked_client,
        ..payment
    };
    assert!(finance_repository::insert_payment(&conn, &unlinked_payment).is_err());
}

fn seeded_payment(conn: &Connection) -> PaymentDto {
    let case_id = uuid::Uuid::new_v4().to_string();
    let client_id = uuid::Uuid::new_v4().to_string();
    conn.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-9', 'أحمد', 'now', 'now')", [&client_id]).unwrap();
    conn.execute("INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, 'CA-9', 'ACTIVE', 'now', 'now')", [&case_id]).unwrap();
    conn.execute("INSERT INTO case_clients (case_id, client_id, created_at, updated_at) VALUES (?1, ?2, 'now', 'now')", [&case_id, &client_id]).unwrap();
    let payment = PaymentDto {
        id: uuid::Uuid::new_v4().to_string(),
        case_id,
        payer_client_id: client_id,
        amount_minor: 500_000,
        payment_date: "2026-10-08".into(),
        payment_method: None,
        notes: None,
        created_at: "now".into(),
        updated_at: "now".into(),
    };
    finance_repository::insert_payment(conn, &payment).unwrap();
    payment
}

#[test]
fn a_mistaken_payment_can_be_deleted_once_and_leaves_the_case_total() {
    let (_dir, conn) = db_conn();
    let payment = seeded_payment(&conn);
    assert_eq!(
        finance_repository::case_summary(&conn, &payment.case_id)
            .unwrap()
            .received_minor,
        500_000
    );
    finance_repository::delete_payment(&conn, &payment.id).unwrap();
    assert_eq!(
        finance_repository::case_summary(&conn, &payment.case_id)
            .unwrap()
            .received_minor,
        0
    );
    assert!(matches!(
        finance_repository::delete_payment(&conn, &payment.id),
        Err(legalmaster_lib::errors::Error::PaymentNotFound)
    ));
}

#[test]
fn a_mistaken_expense_can_be_deleted_but_not_one_holding_documents() {
    let (_dir, conn) = db_conn();
    let expense = legalmaster_lib::dto::ExpenseDto {
        id: uuid::Uuid::new_v4().to_string(),
        case_id: None,
        client_id: None,
        amount_minor: 35_000,
        expense_date: "2026-10-08".into(),
        expense_type: "COURT_FEE".into(),
        notes: None,
        created_at: "now".into(),
        updated_at: "now".into(),
    };
    finance_repository::insert_expense(&conn, &expense).unwrap();
    let kept = legalmaster_lib::dto::ExpenseDto {
        id: uuid::Uuid::new_v4().to_string(),
        ..expense.clone()
    };
    finance_repository::insert_expense(&conn, &kept).unwrap();
    conn.execute(
        "INSERT INTO attachments (id, expense_id, original_filename, stored_filename, relative_path, mime_type, file_size_bytes, sha256, category, created_at, updated_at)
         VALUES (?1, ?2, 'receipt.pdf', 'stored.pdf', 'stored.pdf', 'application/pdf', 1, ?3, 'RECEIPT', 'now', 'now')",
        [uuid::Uuid::new_v4().to_string(), kept.id.clone(), "a".repeat(64)],
    )
    .unwrap();

    finance_repository::delete_expense(&conn, &expense.id).unwrap();
    assert!(finance_repository::get_expense(&conn, &expense.id).is_err());
    assert!(finance_repository::delete_expense(&conn, &kept.id).is_err());
    assert!(finance_repository::get_expense(&conn, &kept.id).is_ok());
    assert!(matches!(
        finance_repository::delete_expense(&conn, &expense.id),
        Err(legalmaster_lib::errors::Error::ExpenseNotFound)
    ));
}
