use crate::{
    dto::{
        CaseFinanceSummary, ClientFinanceSummary, FeeAgreementDto, FeeAgreementInput,
        FinancialTransactionDto, FinancialTransactionInput, FinancialTransactionListInput,
    },
    errors::Error,
    services::finance_service,
    state::AppState,
};
use tauri::{AppHandle, State};
#[tauri::command]
pub fn finance_fee_agreement_save(
    app: AppHandle,
    state: State<AppState>,
    input: FeeAgreementInput,
) -> Result<FeeAgreementDto, Error> {
    finance_service::save_fee_agreement(&app, &state, input)
}
#[tauri::command]
pub fn finance_transaction_save(
    app: AppHandle,
    state: State<AppState>,
    input: FinancialTransactionInput,
) -> Result<FinancialTransactionDto, Error> {
    finance_service::save_transaction(&app, &state, input)
}
#[tauri::command]
pub fn finance_transaction_reverse(
    app: AppHandle,
    state: State<AppState>,
    id: String,
    transaction_date: String,
) -> Result<FinancialTransactionDto, Error> {
    finance_service::reverse_transaction(&app, &state, &id, &transaction_date)
}
#[tauri::command]
pub fn finance_transaction_list(
    app: AppHandle,
    state: State<AppState>,
    input: FinancialTransactionListInput,
) -> Result<Vec<FinancialTransactionDto>, Error> {
    finance_service::list(&app, &state, input)
}
#[tauri::command]
pub fn finance_case_summary(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<CaseFinanceSummary, Error> {
    finance_service::case_summary(&app, &state, &id)
}
#[tauri::command]
pub fn finance_client_summary(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<ClientFinanceSummary, Error> {
    finance_service::client_summary(&app, &state, &id)
}
