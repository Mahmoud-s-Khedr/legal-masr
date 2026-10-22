use super::threads;
use crate::{errors::Error, services::support_bundle_service, state::AppState};
use tauri::{AppHandle, Manager};

/// The renderer supplies no paths. The native picker is never held under the gate.
#[tauri::command]
pub async fn support_bundle_save(app: AppHandle, filter_label: String) -> Result<(), Error> {
    let generation = {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        state.unlocked()?;
        state.generation()
    };
    let picker = app.clone();
    let destination = threads::on_worker(move || {
        support_bundle_service::pick_destination(&picker, &filter_label)
    })
    .await?;
    threads::on_worker(move || {
        let state = app.state::<AppState>();
        let _operation = state.operation()?;
        support_bundle_service::create(&app, &state, generation, &destination)
    })
    .await
}
