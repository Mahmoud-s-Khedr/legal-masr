use crate::{
    db,
    dto::{
        CaseFinanceSummary, ClientFinanceSummary, FeeAgreementDto, FeeAgreementInput,
        FinancialTransactionDto, FinancialTransactionInput, FinancialTransactionListInput,
    },
    errors::Error,
    repositories::finance_repository,
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date};
use uuid::Uuid;
const TYPES: &[&str] = &[
    "FEE_PAYMENT",
    "CASE_EXPENSE",
    "REFUND",
    "OTHER_INCOME",
    "OTHER_EXPENSE",
];
const METHODS: &[&str] = &["CASH", "BANK_TRANSFER", "CARD", "MOBILE_WALLET", "OTHER"];
const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");

fn is_date(value: &str) -> bool {
    value.len() == 10 && Date::parse(value, DATE_FORMAT).is_ok()
}

fn valid(input: &FinancialTransactionInput) -> bool {
    input.amount_minor > 0
        && TYPES.contains(&input.transaction_type.as_str())
        && input
            .payment_method
            .as_deref()
            .map(|x| METHODS.contains(&x))
            .unwrap_or(true)
        && is_date(&input.transaction_date)
}
fn ensure_refs(c: &rusqlite::Connection, input: &FinancialTransactionInput) -> Result<(), Error> {
    let exists = |sql: &str, id: &str| c.query_row(sql, [id], |_| Ok(())).is_ok();
    if !exists("SELECT 1 FROM clients WHERE id=?1", &input.client_id) {
        return Err(Error::ClientNotFound);
    };
    if let Some(case_id) = &input.case_id {
        if !exists("SELECT 1 FROM cases WHERE id=?1", case_id) {
            return Err(Error::CaseNotFound);
        }
        if c.query_row(
            "SELECT 1 FROM case_clients WHERE case_id = ?1 AND client_id = ?2",
            rusqlite::params![case_id, input.client_id],
            |_| Ok(()),
        )
        .is_err()
        {
            return Err(Error::Validation);
        }
    };
    if let Some(document_id) = &input.receipt_document_id {
        if !exists("SELECT 1 FROM documents WHERE id=?1", document_id) {
            return Err(Error::DocumentNotFound);
        }
    };
    Ok(())
}
pub fn save_fee_agreement<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    input: FeeAgreementInput,
) -> Result<FeeAgreementDto, Error> {
    if input.amount_minor <= 0
        || input
            .agreement_date
            .as_deref()
            .map(|x| !is_date(x))
            .unwrap_or(false)
    {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    if c.query_row("SELECT 1 FROM cases WHERE id=?1", [&input.case_id], |_| {
        Ok(())
    })
    .is_err()
    {
        return Err(Error::CaseNotFound);
    }
    finance_repository::upsert_fee_agreement(&c, &Uuid::new_v4().to_string(), &input, &db::now())
}
pub fn save_transaction<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    input: FinancialTransactionInput,
) -> Result<FinancialTransactionDto, Error> {
    if !valid(&input) {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    ensure_refs(&c, &input)?;
    let now = db::now();
    match input.id.as_deref() {
        Some(_) => finance_repository::update_transaction(&c, &input, &now),
        None => finance_repository::insert_transaction(
            &c,
            &Uuid::new_v4().to_string(),
            &input,
            None,
            &now,
        ),
    }
}
pub fn reverse_transaction<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    id: &str,
    date: &str,
) -> Result<FinancialTransactionDto, Error> {
    if !is_date(date) {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    let c = db::open_db(&p, &m)?;
    let original = finance_repository::get_transaction(&c, id)?;
    if c.query_row(
        "SELECT 1 FROM financial_transactions WHERE reversed_transaction_id=?1",
        [id],
        |_| Ok(()),
    )
    .is_ok()
    {
        return Err(Error::Validation);
    };
    let inverse = match original.transaction_type.as_str() {
        "FEE_PAYMENT" | "OTHER_INCOME" => "REFUND",
        "REFUND" => "FEE_PAYMENT",
        "CASE_EXPENSE" | "OTHER_EXPENSE" => "OTHER_INCOME",
        _ => return Err(Error::Validation),
    };
    let input = FinancialTransactionInput {
        id: None,
        client_id: original.client_id,
        case_id: original.case_id,
        transaction_type: inverse.into(),
        amount_minor: original.amount_minor,
        transaction_date: date.into(),
        payment_method: original.payment_method,
        description: Some(format!("Reversal of {id}")),
        receipt_document_id: None,
    };
    finance_repository::insert_transaction(
        &c,
        &Uuid::new_v4().to_string(),
        &input,
        Some(id),
        &db::now(),
    )
}
pub fn list<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    input: FinancialTransactionListInput,
) -> Result<Vec<FinancialTransactionDto>, Error> {
    if input
        .from_date
        .as_deref()
        .is_some_and(|value| !is_date(value))
        || input
            .to_date
            .as_deref()
            .is_some_and(|value| !is_date(value))
    {
        return Err(Error::Validation);
    }
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    finance_repository::list_transactions(
        &db::open_db(&p, &m)?,
        input.client_id.as_deref(),
        input.case_id.as_deref(),
        input.from_date.as_deref(),
        input.to_date.as_deref(),
    )
}
pub fn case_summary<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    id: &str,
) -> Result<CaseFinanceSummary, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    finance_repository::case_summary(&db::open_db(&p, &m)?, id)
}
pub fn client_summary<R: Runtime>(
    a: &AppHandle<R>,
    s: &AppState,
    id: &str,
) -> Result<ClientFinanceSummary, Error> {
    let m = s.unlocked()?;
    let (_, p) = db::paths(a)?;
    finance_repository::client_summary(&db::open_db(&p, &m)?, id)
}

#[cfg(test)]
mod tests {
    use super::is_date;

    #[test]
    fn financial_dates_must_be_real_date_only_values() {
        assert!(is_date("2026-08-24"));
        assert!(!is_date("2026-02-30"));
        assert!(!is_date("2026-8-24"));
        assert!(!is_date("2026-08-24T00:00:00Z"));
    }
}
