use legalmaster_lib::{db, dto::FinancialTransactionInput, repositories::finance_repository};

fn seeded() -> rusqlite::Connection {
    let c = rusqlite::Connection::open_in_memory().unwrap();
    db::migrate(&c).unwrap();
    c.execute("INSERT INTO clients(id,client_type,display_name,created_at,updated_at) VALUES('client','INDIVIDUAL','Client','now','now')", []).unwrap();
    c.execute("INSERT INTO cases(id,case_number,status,created_at,updated_at) VALUES('case','1','ACTIVE','now','now')", []).unwrap();
    c
}
fn payment(amount: i64) -> FinancialTransactionInput {
    FinancialTransactionInput {
        id: None,
        client_id: "client".into(),
        case_id: Some("case".into()),
        transaction_type: "FEE_PAYMENT".into(),
        amount_minor: amount,
        transaction_date: "2026-07-27".into(),
        payment_method: Some("CASH".into()),
        description: None,
        receipt_document_id: None,
    }
}

#[test]
fn case_summary_uses_integer_minor_units_and_refunds_reduce_received() {
    let c = seeded();
    finance_repository::upsert_fee_agreement(
        &c,
        "fee",
        &legalmaster_lib::dto::FeeAgreementInput {
            case_id: "case".into(),
            amount_minor: 10_000,
            agreement_date: None,
            notes: None,
        },
        "now",
    )
    .unwrap();
    finance_repository::insert_transaction(&c, "payment", &payment(4_000), None, "now").unwrap();
    let mut refund = payment(500);
    refund.transaction_type = "REFUND".into();
    finance_repository::insert_transaction(&c, "refund", &refund, Some("payment"), "now").unwrap();
    let summary = finance_repository::case_summary(&c, "case").unwrap();
    assert_eq!(
        (
            summary.agreed_fee_minor,
            summary.received_minor,
            summary.outstanding_minor
        ),
        (10_000, 3_500, 6_500)
    );
}

#[test]
fn database_rejects_non_positive_amounts_and_non_egp_currency() {
    let c = seeded();
    assert!(c.execute("INSERT INTO financial_transactions(id,client_id,transaction_type,amount_minor,currency,transaction_date,created_at,updated_at) VALUES('bad','client','FEE_PAYMENT',0,'EGP','2026-07-27','now','now')",[]).is_err());
    assert!(c.execute("INSERT INTO financial_transactions(id,client_id,transaction_type,amount_minor,currency,transaction_date,created_at,updated_at) VALUES('bad2','client','FEE_PAYMENT',1,'USD','2026-07-27','now','now')",[]).is_err());
}
