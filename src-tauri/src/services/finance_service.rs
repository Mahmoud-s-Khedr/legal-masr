use crate::{
    db,
    dto::{
        CaseFinanceSummary, ClientFinanceSummary, ExpenseDto, ExpenseInput, ExpenseListInput,
        FeeAgreementDto, FeeAgreementInput, PaymentDto, PaymentInput, PaymentListInput,
    },
    errors::Error,
    repositories::{case_repository, finance_repository},
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use time::{format_description::BorrowedFormatItem, macros::format_description, Date};
use uuid::Uuid;

const DATE_FORMAT: &[BorrowedFormatItem<'static>] = format_description!("[year]-[month]-[day]");
const METHODS: &[&str] = &["CASH", "BANK_TRANSFER", "CHEQUE", "ELECTRONIC", "OTHER"];
const EXPENSE_TYPES: &[&str] = &[
    "COURT_FEE",
    "TRANSPORT",
    "OFFICE_SUPPLIES",
    "EXPERT_FEE",
    "OTHER",
];
fn valid_date(value: &str) -> bool {
    value.len() == 10 && Date::parse(value, DATE_FORMAT).is_ok()
}
fn clean(value: Option<String>) -> Option<String> {
    value.and_then(|value| (!value.trim().is_empty()).then(|| value.trim().to_owned()))
}
fn validate_dates(from: Option<&str>, to: Option<&str>) -> Result<(), Error> {
    if from.is_some_and(|value| !valid_date(value)) || to.is_some_and(|value| !valid_date(value)) {
        Err(Error::Validation)
    } else {
        Ok(())
    }
}
fn ensure_payer_membership(
    conn: &rusqlite::Connection,
    case_id: &str,
    payer_client_id: &str,
) -> Result<(), Error> {
    if conn
        .query_row("SELECT 1 FROM cases WHERE id = ?1", [case_id], |_| Ok(()))
        .is_err()
    {
        return Err(Error::CaseNotFound);
    }
    if conn
        .query_row(
            "SELECT 1 FROM clients WHERE id = ?1",
            [payer_client_id],
            |_| Ok(()),
        )
        .is_err()
    {
        return Err(Error::ClientNotFound);
    }
    if conn
        .query_row(
            "SELECT 1 FROM case_clients WHERE case_id = ?1 AND client_id = ?2",
            rusqlite::params![case_id, payer_client_id],
            |_| Ok(()),
        )
        .is_err()
    {
        return Err(Error::Validation);
    }
    Ok(())
}
pub fn save_fee_agreement<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: FeeAgreementInput,
) -> Result<FeeAgreementDto, Error> {
    if input.amount_minor <= 0
        || input
            .agreement_date
            .as_deref()
            .is_some_and(|date| !valid_date(date))
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    case_repository::ensure_active(&conn, &input.case_id)?;
    finance_repository::upsert_fee_agreement(&conn, &Uuid::new_v4().to_string(), &input, &db::now())
}
pub fn save_payment<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: PaymentInput,
) -> Result<PaymentDto, Error> {
    if input.amount_minor <= 0
        || !valid_date(&input.payment_date)
        || input
            .payment_method
            .as_deref()
            .is_some_and(|method| !METHODS.contains(&method))
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    ensure_payer_membership(&conn, &input.case_id, &input.payer_client_id)?;
    case_repository::ensure_active(&conn, &input.case_id)?;
    let now = db::now();
    let is_new = input.id.is_none();
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = (!is_new)
        .then(|| finance_repository::get_payment(&conn, &id))
        .transpose()?;
    if let Some(existing) = &existing {
        case_repository::ensure_active(&conn, &existing.case_id)?;
    }
    let payment = PaymentDto {
        id,
        case_id: input.case_id,
        payer_client_id: input.payer_client_id,
        amount_minor: input.amount_minor,
        payment_date: input.payment_date,
        payment_method: input.payment_method,
        notes: clean(input.notes),
        created_at: existing
            .as_ref()
            .map(|payment| payment.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };
    if is_new {
        finance_repository::insert_payment(&conn, &payment)?;
    } else {
        finance_repository::update_payment(&conn, &payment)?;
    }
    Ok(payment)
}
pub fn save_expense<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: ExpenseInput,
) -> Result<ExpenseDto, Error> {
    if input.amount_minor <= 0
        || !valid_date(&input.expense_date)
        || !EXPENSE_TYPES.contains(&input.expense_type.as_str())
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    if let Some(case_id) = &input.case_id {
        case_repository::ensure_active(&conn, case_id)?;
    }
    if let Some(client_id) = &input.client_id {
        if conn
            .query_row("SELECT 1 FROM clients WHERE id = ?1", [client_id], |_| {
                Ok(())
            })
            .is_err()
        {
            return Err(Error::ClientNotFound);
        }
    }
    let now = db::now();
    let is_new = input.id.is_none();
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = (!is_new)
        .then(|| finance_repository::get_expense(&conn, &id))
        .transpose()?;
    if let Some(case_id) = existing.as_ref().and_then(|item| item.case_id.as_ref()) {
        case_repository::ensure_active(&conn, case_id)?;
    }
    let expense = ExpenseDto {
        id,
        case_id: input.case_id,
        client_id: input.client_id,
        amount_minor: input.amount_minor,
        expense_date: input.expense_date,
        expense_type: input.expense_type,
        notes: clean(input.notes),
        created_at: existing
            .as_ref()
            .map(|expense| expense.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };
    if is_new {
        finance_repository::insert_expense(&conn, &expense)?;
    } else {
        finance_repository::update_expense(&conn, &expense)?;
    }
    Ok(expense)
}
/// Removes a payment recorded by mistake (the lawyer confirms first in the interface).
pub fn delete_payment<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    let payment = finance_repository::get_payment(&conn, id)?;
    case_repository::ensure_active(&conn, &payment.case_id)?;
    finance_repository::delete_payment(&conn, id)
}

/// Removes an expense recorded by mistake (the lawyer confirms first in the interface).
pub fn delete_expense<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    let conn = db::open_db(&path, &master)?;
    if let Some(case_id) = finance_repository::get_expense(&conn, id)?.case_id {
        case_repository::ensure_active(&conn, &case_id)?;
    }
    finance_repository::delete_expense(&conn, id)
}

pub fn list_payments<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: PaymentListInput,
) -> Result<Vec<PaymentDto>, Error> {
    validate_dates(input.from_date.as_deref(), input.to_date.as_deref())?;
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    finance_repository::list_payments(
        &db::open_db(&path, &master)?,
        input.payer_client_id.as_deref(),
        input.case_id.as_deref(),
        input.from_date.as_deref(),
        input.to_date.as_deref(),
    )
}
pub fn list_expenses<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: ExpenseListInput,
) -> Result<Vec<ExpenseDto>, Error> {
    validate_dates(input.from_date.as_deref(), input.to_date.as_deref())?;
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    finance_repository::list_expenses(
        &db::open_db(&path, &master)?,
        input.client_id.as_deref(),
        input.case_id.as_deref(),
        input.from_date.as_deref(),
        input.to_date.as_deref(),
    )
}
pub fn case_summary<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<CaseFinanceSummary, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    finance_repository::case_summary(&db::open_db(&path, &master)?, id)
}
pub fn client_summary<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    id: &str,
) -> Result<ClientFinanceSummary, Error> {
    let master = state.unlocked()?;
    let (_, path) = db::paths(app)?;
    finance_repository::client_summary(&db::open_db(&path, &master)?, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn payment_rules_reject_bad_dates_and_unsupported_methods() {
        assert!(!valid_date("2026-02-30"));
        assert!(!METHODS.contains(&"CARD"));
        assert!(EXPENSE_TYPES.contains(&"COURT_FEE"));
    }
}
