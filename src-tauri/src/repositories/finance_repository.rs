use crate::{
    dto::{
        CaseFinanceSummary, ClientFinanceSummary, ExpenseDto, FeeAgreementDto, FeeAgreementInput,
        PaymentDto,
    },
    errors::Error,
};
use rusqlite::{params, Connection, OptionalExtension};

fn payment_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PaymentDto> {
    Ok(PaymentDto {
        id: row.get(0)?,
        case_id: row.get(1)?,
        payer_client_id: row.get(2)?,
        amount_minor: row.get(3)?,
        payment_date: row.get(4)?,
        payment_method: row.get(5)?,
        notes: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}
fn expense_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExpenseDto> {
    Ok(ExpenseDto {
        id: row.get(0)?,
        case_id: row.get(1)?,
        client_id: row.get(2)?,
        amount_minor: row.get(3)?,
        expense_date: row.get(4)?,
        expense_type: row.get(5)?,
        notes: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub fn fee_agreement(conn: &Connection, case_id: &str) -> Result<Option<FeeAgreementDto>, Error> {
    conn.query_row("SELECT id, case_id, amount_minor, agreement_date, notes, created_at, updated_at FROM case_fee_agreements WHERE case_id = ?1", [case_id], |row| Ok(FeeAgreementDto { id: row.get(0)?, case_id: row.get(1)?, amount_minor: row.get(2)?, agreement_date: row.get(3)?, notes: row.get(4)?, created_at: row.get(5)?, updated_at: row.get(6)? })).optional().map_err(Error::from)
}
pub fn upsert_fee_agreement(
    conn: &Connection,
    id: &str,
    input: &FeeAgreementInput,
    now: &str,
) -> Result<FeeAgreementDto, Error> {
    conn.execute("INSERT INTO case_fee_agreements (id, case_id, amount_minor, agreement_date, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(case_id) DO UPDATE SET amount_minor = excluded.amount_minor, agreement_date = excluded.agreement_date, notes = excluded.notes, updated_at = excluded.updated_at", params![id, input.case_id, input.amount_minor, input.agreement_date, input.notes, now])?;
    fee_agreement(conn, &input.case_id)?.ok_or(Error::Operation)
}
pub fn get_payment(conn: &Connection, id: &str) -> Result<PaymentDto, Error> {
    conn.query_row("SELECT id, case_id, payer_client_id, amount_minor, payment_date, payment_method, notes, created_at, updated_at FROM payments WHERE id = ?1", [id], payment_row).map_err(|_| Error::PaymentNotFound)
}
pub fn insert_payment(conn: &Connection, payment: &PaymentDto) -> Result<(), Error> {
    conn.execute("INSERT INTO payments (id, case_id, payer_client_id, amount_minor, payment_date, payment_method, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)", params![payment.id, payment.case_id, payment.payer_client_id, payment.amount_minor, payment.payment_date, payment.payment_method, payment.notes, payment.created_at])?;
    Ok(())
}
pub fn update_payment(conn: &Connection, payment: &PaymentDto) -> Result<(), Error> {
    if conn.execute("UPDATE payments SET case_id = ?2, payer_client_id = ?3, amount_minor = ?4, payment_date = ?5, payment_method = ?6, notes = ?7, updated_at = ?8 WHERE id = ?1", params![payment.id, payment.case_id, payment.payer_client_id, payment.amount_minor, payment.payment_date, payment.payment_method, payment.notes, payment.updated_at])? == 0 { return Err(Error::PaymentNotFound); }
    Ok(())
}
pub fn list_payments(
    conn: &Connection,
    payer_client_id: Option<&str>,
    case_id: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<PaymentDto>, Error> {
    let mut stmt = conn.prepare("SELECT id, case_id, payer_client_id, amount_minor, payment_date, payment_method, notes, created_at, updated_at FROM payments WHERE (?1 IS NULL OR payer_client_id = ?1) AND (?2 IS NULL OR case_id = ?2) AND (?3 IS NULL OR payment_date >= ?3) AND (?4 IS NULL OR payment_date <= ?4) ORDER BY payment_date DESC, created_at DESC")?;
    let rows = stmt
        .query_map(params![payer_client_id, case_id, from, to], payment_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}
pub fn get_expense(conn: &Connection, id: &str) -> Result<ExpenseDto, Error> {
    conn.query_row("SELECT id, case_id, client_id, amount_minor, expense_date, expense_type, notes, created_at, updated_at FROM expenses WHERE id = ?1", [id], expense_row).map_err(|_| Error::ExpenseNotFound)
}
pub fn insert_expense(conn: &Connection, expense: &ExpenseDto) -> Result<(), Error> {
    conn.execute("INSERT INTO expenses (id, case_id, client_id, amount_minor, expense_date, expense_type, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)", params![expense.id, expense.case_id, expense.client_id, expense.amount_minor, expense.expense_date, expense.expense_type, expense.notes, expense.created_at])?;
    Ok(())
}
pub fn update_expense(conn: &Connection, expense: &ExpenseDto) -> Result<(), Error> {
    if conn.execute("UPDATE expenses SET case_id = ?2, client_id = ?3, amount_minor = ?4, expense_date = ?5, expense_type = ?6, notes = ?7, updated_at = ?8 WHERE id = ?1", params![expense.id, expense.case_id, expense.client_id, expense.amount_minor, expense.expense_date, expense.expense_type, expense.notes, expense.updated_at])? == 0 { return Err(Error::ExpenseNotFound); }
    Ok(())
}
pub fn list_expenses(
    conn: &Connection,
    client_id: Option<&str>,
    case_id: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<ExpenseDto>, Error> {
    let mut stmt = conn.prepare("SELECT id, case_id, client_id, amount_minor, expense_date, expense_type, notes, created_at, updated_at FROM expenses WHERE (?1 IS NULL OR client_id = ?1) AND (?2 IS NULL OR case_id = ?2) AND (?3 IS NULL OR expense_date >= ?3) AND (?4 IS NULL OR expense_date <= ?4) ORDER BY expense_date DESC, created_at DESC")?;
    let rows = stmt
        .query_map(params![client_id, case_id, from, to], expense_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}
pub fn case_summary(conn: &Connection, case_id: &str) -> Result<CaseFinanceSummary, Error> {
    let agreed = fee_agreement(conn, case_id)?
        .map(|value| value.amount_minor)
        .unwrap_or(0);
    let received: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE case_id = ?1",
        [case_id],
        |row| row.get(0),
    )?;
    let expenses: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount_minor), 0) FROM expenses WHERE case_id = ?1",
        [case_id],
        |row| row.get(0),
    )?;
    Ok(CaseFinanceSummary {
        case_id: case_id.into(),
        agreed_fee_minor: agreed,
        received_minor: received,
        outstanding_minor: (agreed - received).max(0),
        expenses_minor: expenses,
        net_cash_minor: received - expenses,
    })
}
pub fn client_summary(conn: &Connection, client_id: &str) -> Result<ClientFinanceSummary, Error> {
    let received: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE payer_client_id = ?1",
        [client_id],
        |row| row.get(0),
    )?;
    let expenses: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount_minor), 0) FROM expenses WHERE client_id = ?1",
        [client_id],
        |row| row.get(0),
    )?;
    Ok(ClientFinanceSummary {
        client_id: client_id.into(),
        received_minor: received,
        expenses_minor: expenses,
        net_cash_minor: received - expenses,
    })
}
