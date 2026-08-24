use legalmaster_lib::{db, dto::PaymentDto, repositories::finance_repository, security};
use rusqlite::Connection;
fn db_conn() -> (tempfile::TempDir, Connection) {
    let dir = tempfile::tempdir().unwrap();
    let master = security::random_32();
    let conn = db::open_db(&dir.path().join("vault.sqlite"), &master).unwrap();
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
