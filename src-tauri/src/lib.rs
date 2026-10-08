pub mod backup;
mod commands;
pub mod db;
#[cfg(feature = "desktop-e2e")]
mod desktop_e2e;
pub mod dto;
pub mod errors;
mod logging;
pub mod normalize;
pub mod repositories;
pub mod security;
pub mod services;
pub mod state;
pub mod vault_operation;

use state::AppState;
use tauri::Manager;

pub fn run() {
    #[cfg(feature = "desktop-e2e")]
    if desktop_e2e::root().is_err() {
        // Do not fall back to the user's ordinary vault on harness errors.
        eprintln!("DESKTOP_E2E_ISOLATION_REQUIRED");
        std::process::exit(2);
    }
    let builder = tauri::Builder::default();
    #[cfg(not(feature = "desktop-e2e"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));
    let builder = builder
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init());
    #[cfg(not(feature = "desktop-e2e"))]
    let builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    builder
        .setup(|app| {
            let data_dir = db::app_dir(app.handle())?;
            let guard = logging::init(&data_dir);
            app.manage(guard);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_get_status,
            commands::app::app_initialize,
            commands::app::app_unlock,
            commands::app::app_lock,
            commands::app::app_change_password,
            commands::app::app_recover_access,
            commands::backup::backup_create,
            commands::backup::backup_latest_successful,
            commands::backup::backup_validate,
            commands::backup::backup_restore,
            commands::settings::settings_get,
            commands::settings::settings_open_developer_contact,
            commands::settings::settings_update,
            commands::settings::profile_get,
            commands::settings::profile_update,
            commands::settings::settings_set_autostart,
            commands::settings::settings_set_usage_counters,
            commands::clients::client_create,
            commands::clients::client_update,
            commands::clients::client_get,
            commands::clients::client_list,
            commands::clients::client_archive,
            commands::clients::client_restore,
            commands::clients::client_export,
            commands::powers_of_attorney::power_of_attorney_create,
            commands::powers_of_attorney::power_of_attorney_update,
            commands::powers_of_attorney::power_of_attorney_get,
            commands::powers_of_attorney::power_of_attorney_list,
            commands::powers_of_attorney::power_of_attorney_archive,
            commands::powers_of_attorney::power_of_attorney_restore,
            commands::hearings::hearing_create,
            commands::hearings::hearing_update,
            commands::hearings::hearing_get,
            commands::hearings::hearing_list,
            commands::hearings::hearing_record_decision,
            commands::hearings::hearing_delete,
            commands::cases::case_create,
            commands::cases::case_update,
            commands::cases::case_get,
            commands::cases::case_list,
            commands::cases::case_archive,
            commands::cases::case_restore,
            commands::cases::case_add_opponent,
            commands::cases::case_update_opponent,
            commands::cases::case_remove_opponent,
            commands::search::search_global,
            commands::search::search_rebuild_index,
            commands::tasks::task_create,
            commands::tasks::task_update,
            commands::tasks::task_list,
            commands::tasks::task_complete,
            commands::tasks::task_reopen,
            commands::tasks::task_delete,
            commands::dashboard::dashboard_get_summary,
            commands::documents::attachment_select_source,
            commands::documents::attachment_add,
            commands::documents::attachment_list,
            commands::documents::attachment_update,
            commands::documents::attachment_open,
            commands::documents::attachment_reveal,
            commands::documents::attachment_remove,
            commands::finances::fee_agreement_save,
            commands::finances::payment_save,
            commands::finances::payment_list,
            commands::finances::expense_save,
            commands::finances::expense_list,
            commands::finances::finance_case_summary,
            commands::finances::finance_client_summary,
            commands::reminders::reminders_refresh
        ])
        .run(tauri::generate_context!())
        .expect("error while running Legal Masr");
}
