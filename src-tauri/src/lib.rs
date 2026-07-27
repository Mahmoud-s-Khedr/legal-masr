pub mod backup;
mod commands;
pub mod db;
pub mod dto;
pub mod errors;
mod logging;
pub mod normalize;
pub mod repositories;
pub mod security;
pub mod services;
pub mod state;

use state::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
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
            commands::backup::backup_validate,
            commands::backup::backup_restore,
            commands::settings::settings_get,
            commands::settings::settings_update,
            commands::clients::client_create,
            commands::clients::client_update,
            commands::clients::client_get,
            commands::clients::client_list,
            commands::clients::client_archive,
            commands::clients::client_restore,
            commands::clients::client_export,
            commands::cases::case_create,
            commands::cases::case_update,
            commands::cases::case_get,
            commands::cases::case_list,
            commands::cases::case_archive,
            commands::cases::case_restore,
            commands::cases::case_export,
            commands::cases::case_attach_client,
            commands::cases::case_detach_client,
            commands::cases::case_set_primary_client,
            commands::cases::case_add_party,
            commands::cases::case_update_party,
            commands::cases::case_remove_party,
            commands::search::search_global,
            commands::search::search_rebuild_index,
            commands::events::event_create,
            commands::events::event_update,
            commands::events::event_list,
            commands::events::event_complete,
            commands::events::event_delete,
            commands::tasks::task_create,
            commands::tasks::task_update,
            commands::tasks::task_list,
            commands::tasks::task_complete,
            commands::tasks::task_reopen,
            commands::tasks::task_delete,
            commands::dashboard::dashboard_get_summary,
            commands::documents::document_import_managed,
            commands::documents::document_add_reference,
            commands::documents::document_list,
            commands::documents::document_update,
            commands::documents::document_check_missing,
            commands::documents::document_remove
        ])
        .run(tauri::generate_context!())
        .expect("error while running LegalMaster Solo");
}
