use crate::{
    dto::{
        CaseFinanceSummary, ClientFinanceSummary, FeeAgreementDto, FeeAgreementInput,
        FinancialTransactionDto, FinancialTransactionInput,
    },
    errors::Error,
};
use rusqlite::{params, Connection, OptionalExtension};

fn transaction_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FinancialTransactionDto> {
    Ok(FinancialTransactionDto {
        id: row.get(0)?,
        client_id: row.get(1)?,
        case_id: row.get(2)?,
        transaction_type: row.get(3)?,
        amount_minor: row.get(4)?,
        currency: row.get(5)?,
        transaction_date: row.get(6)?,
        payment_method: row.get(7)?,
        description: row.get(8)?,
        receipt_document_id: row.get(9)?,
        reversed_transaction_id: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub fn fee_agreement(conn: &Connection, case_id: &str) -> Result<Option<FeeAgreementDto>, Error> {
    conn.query_row("SELECT id,case_id,amount_minor,currency,agreement_date,notes,created_at,updated_at FROM case_fee_agreements WHERE case_id=?1", [case_id], |r| Ok(FeeAgreementDto { id:r.get(0)?, case_id:r.get(1)?, amount_minor:r.get(2)?, currency:r.get(3)?, agreement_date:r.get(4)?, notes:r.get(5)?, created_at:r.get(6)?, updated_at:r.get(7)? })).optional().map_err(Error::from)
}

pub fn upsert_fee_agreement(
    conn: &Connection,
    id: &str,
    input: &FeeAgreementInput,
    now: &str,
) -> Result<FeeAgreementDto, Error> {
    conn.execute("INSERT INTO case_fee_agreements(id,case_id,amount_minor,currency,agreement_date,notes,created_at,updated_at) VALUES(?1,?2,?3,'EGP',?4,?5,?6,?6) ON CONFLICT(case_id) DO UPDATE SET amount_minor=excluded.amount_minor,agreement_date=excluded.agreement_date,notes=excluded.notes,updated_at=excluded.updated_at", params![id,input.case_id,input.amount_minor,input.agreement_date,input.notes,now])?;
    fee_agreement(conn, &input.case_id)?.ok_or(Error::Operation)
}

pub fn insert_transaction(
    conn: &Connection,
    id: &str,
    input: &FinancialTransactionInput,
    reversed_id: Option<&str>,
    now: &str,
) -> Result<FinancialTransactionDto, Error> {
    conn.execute("INSERT INTO financial_transactions(id,client_id,case_id,transaction_type,amount_minor,currency,transaction_date,payment_method,description,receipt_document_id,reversed_transaction_id,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,'EGP',?6,?7,?8,?9,?10,?11,?11)",params![id,input.client_id,input.case_id,input.transaction_type,input.amount_minor,input.transaction_date,input.payment_method,input.description,input.receipt_document_id,reversed_id,now])?;
    get_transaction(conn, id)
}

pub fn update_transaction(
    conn: &Connection,
    input: &FinancialTransactionInput,
    now: &str,
) -> Result<FinancialTransactionDto, Error> {
    if conn.execute("UPDATE financial_transactions SET client_id=?2,case_id=?3,transaction_type=?4,amount_minor=?5,transaction_date=?6,payment_method=?7,description=?8,receipt_document_id=?9,updated_at=?10 WHERE id=?1 AND reversed_transaction_id IS NULL",params![input.id,input.client_id,input.case_id,input.transaction_type,input.amount_minor,input.transaction_date,input.payment_method,input.description,input.receipt_document_id,now])?==0{return Err(Error::TransactionNotFound)};
    get_transaction(conn, input.id.as_deref().unwrap_or_default())
}
pub fn get_transaction(conn: &Connection, id: &str) -> Result<FinancialTransactionDto, Error> {
    conn.query_row("SELECT id,client_id,case_id,transaction_type,amount_minor,currency,transaction_date,payment_method,description,receipt_document_id,reversed_transaction_id,created_at,updated_at FROM financial_transactions WHERE id=?1",[id],transaction_row).map_err(|_|Error::TransactionNotFound)
}
pub fn list_transactions(
    conn: &Connection,
    client_id: Option<&str>,
    case_id: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<FinancialTransactionDto>, Error> {
    let mut s=conn.prepare("SELECT id,client_id,case_id,transaction_type,amount_minor,currency,transaction_date,payment_method,description,receipt_document_id,reversed_transaction_id,created_at,updated_at FROM financial_transactions WHERE (?1 IS NULL OR client_id=?1) AND (?2 IS NULL OR case_id=?2) AND (?3 IS NULL OR transaction_date>=?3) AND (?4 IS NULL OR transaction_date<=?4) ORDER BY transaction_date DESC, created_at DESC")?;
    let transactions = s
        .query_map(params![client_id, case_id, from, to], transaction_row)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(Error::from)?;
    Ok(transactions)
}
fn totals(
    conn: &Connection,
    client_id: Option<&str>,
    case_id: Option<&str>,
) -> Result<(i64, i64, i64), Error> {
    conn.query_row("SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('FEE_PAYMENT','OTHER_INCOME') THEN amount_minor WHEN transaction_type='REFUND' THEN -amount_minor ELSE 0 END),0),COALESCE(SUM(CASE WHEN transaction_type IN ('CASE_EXPENSE','OTHER_EXPENSE') THEN amount_minor ELSE 0 END),0),COALESCE(SUM(CASE WHEN transaction_type='FEE_PAYMENT' THEN amount_minor WHEN transaction_type='REFUND' THEN -amount_minor ELSE 0 END),0) FROM financial_transactions WHERE (?1 IS NULL OR client_id=?1) AND (?2 IS NULL OR case_id=?2)",params![client_id,case_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(Error::from)
}
pub fn case_summary(conn: &Connection, case_id: &str) -> Result<CaseFinanceSummary, Error> {
    let a = fee_agreement(conn, case_id)?;
    let (income, expenses, fee_received) = totals(conn, None, Some(case_id))?;
    let agreed = a.as_ref().map(|x| x.amount_minor).unwrap_or(0);
    Ok(CaseFinanceSummary {
        case_id: case_id.into(),
        agreed_fee_minor: agreed,
        received_minor: fee_received,
        outstanding_minor: (agreed - fee_received).max(0),
        expenses_minor: expenses,
        net_cash_minor: income - expenses,
        currency: "EGP".into(),
    })
}
pub fn client_summary(conn: &Connection, client_id: &str) -> Result<ClientFinanceSummary, Error> {
    let (income, expenses, fee_received) = totals(conn, Some(client_id), None)?;
    Ok(ClientFinanceSummary {
        client_id: client_id.into(),
        received_minor: fee_received,
        expenses_minor: expenses,
        net_cash_minor: income - expenses,
        currency: "EGP".into(),
    })
}
