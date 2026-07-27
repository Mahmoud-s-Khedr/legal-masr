use legalmaster_lib::{
    db,
    dto::InitializeInput,
    security,
    services::{app_service, backup_service, settings_service},
    state::AppState,
};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::{Manager, State};

// `tauri::test::mock_app` resolves app_data_dir to the same fixed, real,
// on-disk path for every test in this binary (see `fresh_mock_app` below),
// and `cargo test` runs tests in this file concurrently by default. Two
// tests racing to initialize/clean up that shared path corrupts each
// other's database file. Serialize the tests that use `fresh_mock_app`.
static APP_DIR_LOCK: Mutex<()> = Mutex::new(());

fn lock_app_dir() -> MutexGuard<'static, ()> {
    APP_DIR_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn fresh_mock_app() -> tauri::App<tauri::test::MockRuntime> {
    let app = tauri::test::mock_app();
    // `tauri::test::mock_app` resolves app_data_dir to a fixed, real, on-disk
    // path (not a per-test temp dir) - previous test runs on this machine
    // leave a security.json/db behind, so without this cleanup a rerun
    // spuriously sees "already initialized". Mirrors a real bug class: any
    // state persisted outside an explicit temp dir must be reset between
    // independent runs.
    if let Ok(dir) = db::app_dir(app.handle()) {
        let _ = std::fs::remove_dir_all(&dir);
    }
    app
}

#[test]
fn onboarding_reaches_an_unlocked_ready_state_with_no_backup_gate() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();

    let status_before = app_service::get_status(handle, &state).unwrap();
    assert!(!status_before.initialized);

    let init_result = app_service::initialize(
        handle,
        &state,
        InitializeInput {
            password: "a secure local password".into(),
            full_name: "محامٍ تجريبي".into(),
            language: "ar".into(),
            managed_documents_directory: None,
            backup_directory: None,
            lock_timeout_minutes: 15,
        },
    )
    .expect("initialize should succeed with only name and password");
    assert!(!init_result.recovery_key.is_empty());

    // No onboarding-completion step exists anymore: the app must be
    // considered ready to use as soon as it is initialized and unlocked.
    let status_after_init = app_service::get_status(handle, &state).unwrap();
    assert!(status_after_init.initialized);
    assert!(status_after_init.unlocked);

    let settings =
        settings_service::get(handle, &state).expect("settings should be readable once unlocked");
    let backup_directory = settings
        .backup_directory
        .expect("a default backup directory must be computed when none is supplied");
    assert!(!backup_directory.is_empty());

    let backup_path = backup_service::create(handle, &state, &backup_directory)
        .expect("backup_create must succeed against the auto-computed backup directory");
    assert!(std::path::Path::new(&backup_path).exists());
    backup_service::validate(&state, &backup_path)
        .expect("the freshly created backup must validate");

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn settings_update_changes_the_backup_directory_and_backups_still_work_against_it() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();

    app_service::initialize(
        handle,
        &state,
        InitializeInput {
            password: "a secure local password".into(),
            full_name: "محامٍ تجريبي".into(),
            language: "ar".into(),
            managed_documents_directory: None,
            backup_directory: None,
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();

    let new_backup_dir = tempfile::tempdir().unwrap();
    let new_backup_dir_str = new_backup_dir.path().to_str().unwrap().to_string();

    let updated = settings_service::update(handle, &state, "ar", "system", 20, &new_backup_dir_str)
        .expect("settings_update must accept a new backup directory");
    assert_eq!(
        updated.backup_directory.as_deref(),
        Some(new_backup_dir_str.as_str())
    );
    assert_eq!(updated.lock_timeout_minutes, 20);

    let refetched = settings_service::get(handle, &state).unwrap();
    assert_eq!(
        refetched.backup_directory.as_deref(),
        Some(new_backup_dir_str.as_str())
    );

    let backup_path = backup_service::create(handle, &state, &new_backup_dir_str)
        .expect("backup_create must succeed against the newly configured directory");
    assert!(std::path::Path::new(&backup_path).exists());

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn concurrent_writers_to_the_same_database_do_not_fail_with_database_is_locked() {
    // Reproduces the diagnosed field bug: a UI double/triple-click fires
    // several concurrent Tauri commands, each opening its own rusqlite
    // Connection to the same on-disk file. Without a busy_timeout, SQLite
    // immediately errors "database is locked" on the losing connections
    // instead of waiting, so this must succeed for every thread.
    let dir = tempfile::tempdir().unwrap();
    let db_path = Arc::new(dir.path().join("legalmaster.sqlite"));
    let master = security::random_32();
    {
        let conn = db::open_db(&db_path, &master).unwrap();
        db::migrate(&conn).unwrap();
    }

    let handles: Vec<_> = (0..8)
        .map(|i| {
            let db_path = Arc::clone(&db_path);
            std::thread::spawn(move || {
                let conn = db::open_db(&db_path, &master).unwrap();
                conn.execute(
                    "INSERT INTO spike_records (id, value, created_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![format!("concurrent-{i}"), "value", db::now()],
                )
                .unwrap();
            })
        })
        .collect();

    for handle in handles {
        handle
            .join()
            .expect("no thread should panic with a locked-database error");
    }

    let conn = db::open_db(&db_path, &master).unwrap();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM spike_records", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 8);
}
