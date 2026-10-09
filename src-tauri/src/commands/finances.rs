use crate::{
    dto::{
        CaseFinanceSummary, ClientFinanceSummary, ExpenseDto, ExpenseInput, ExpenseListInput,
        FeeAgreementDto, FeeAgreementInput, PaymentDto, PaymentInput, PaymentListInput,
    },
    errors::Error,
    services::finance_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn fee_agreement_save(
    app: AppHandle,
    state: State<AppState>,
    input: FeeAgreementInput,
) -> Result<FeeAgreementDto, Error> {
    let _operation = state.operation()?;
    finance_service::save_fee_agreement(&app, &state, input)
}
#[tauri::command]
pub fn payment_save(
    app: AppHandle,
    state: State<AppState>,
    input: PaymentInput,
) -> Result<PaymentDto, Error> {
    let _operation = state.operation()?;
    finance_service::save_payment(&app, &state, input)
}
#[tauri::command]
pub fn payment_list(
    app: AppHandle,
    state: State<AppState>,
    input: PaymentListInput,
) -> Result<Vec<PaymentDto>, Error> {
    let _operation = state.operation()?;
    finance_service::list_payments(&app, &state, input)
}
#[tauri::command]
pub fn expense_save(
    app: AppHandle,
    state: State<AppState>,
    input: ExpenseInput,
) -> Result<ExpenseDto, Error> {
    let _operation = state.operation()?;
    finance_service::save_expense(&app, &state, input)
}
#[tauri::command]
pub fn expense_list(
    app: AppHandle,
    state: State<AppState>,
    input: ExpenseListInput,
) -> Result<Vec<ExpenseDto>, Error> {
    let _operation = state.operation()?;
    finance_service::list_expenses(&app, &state, input)
}
#[tauri::command]
pub fn finance_case_summary(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<CaseFinanceSummary, Error> {
    let _operation = state.operation()?;
    finance_service::case_summary(&app, &state, &id)
}
#[tauri::command]
pub fn finance_client_summary(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<ClientFinanceSummary, Error> {
    let _operation = state.operation()?;
    finance_service::client_summary(&app, &state, &id)
}
#[tauri::command]
pub fn payment_delete(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    finance_service::delete_payment(&app, &state, &id)
}
#[tauri::command]
pub fn expense_delete(app: AppHandle, state: State<AppState>, id: String) -> Result<(), Error> {
    let _operation = state.operation()?;
    finance_service::delete_expense(&app, &state, &id)
}
