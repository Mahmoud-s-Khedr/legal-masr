use legalmaster_lib::{
    backup, db,
    dto::{InitializeInput, LawyerProfileDto, SettingsUpdateInput},
    repositories::settings_repository,
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

#[test]
fn lawyer_profile_updates_locally_and_rejects_invalid_identity_data() {
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
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();

    let updated = settings_service::update_profile(
        handle,
        &state,
        LawyerProfileDto {
            full_name: "أحمد مصطفى".into(),
            bar_number: Some("12345".into()),
            phone: Some("01000000000".into()),
            email: None,
            office_address: Some("القاهرة".into()),
            default_currency: "EGP".into(),
        },
    )
    .unwrap();
    assert_eq!(updated.full_name, "أحمد مصطفى");
    assert_eq!(updated.default_currency, "EGP");

    let invalid = settings_service::update_profile(
        handle,
        &state,
        LawyerProfileDto {
            full_name: "  ".into(),
            bar_number: None,
            phone: None,
            email: None,
            office_address: None,
            default_currency: "EGP".into(),
        },
    );
    assert!(invalid.is_err());

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
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

    let backup_path = backup_service::create(handle, &state)
        .expect("backup_create must succeed against the auto-computed backup directory");
    assert!(std::path::Path::new(&backup_path).exists());
    backup::validate(&backup_path, &state.unlocked().unwrap())
        .expect("the freshly created backup must validate");

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn backup_directory_is_selected_outside_the_general_settings_payload_and_backups_use_it() {
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
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();

    let new_backup_dir = tempfile::tempdir().unwrap();
    let new_backup_dir_str = new_backup_dir.path().to_str().unwrap().to_string();

    let (_, database_path) = db::paths(handle).unwrap();
    let connection = db::open_db(&database_path, &state.unlocked().unwrap()).unwrap();
    settings_repository::update_backup_directory(&connection, &new_backup_dir_str).unwrap();
    let updated = settings_service::get(handle, &state).unwrap();
    assert_eq!(
        updated.backup_directory.as_deref(),
        Some(new_backup_dir_str.as_str())
    );
    assert_eq!(updated.lock_timeout_minutes, 15);

    let refetched = settings_service::get(handle, &state).unwrap();
    assert_eq!(
        refetched.backup_directory.as_deref(),
        Some(new_backup_dir_str.as_str())
    );

    let backup_path = backup_service::create(handle, &state)
        .expect("backup_create must succeed against the newly configured directory");
    assert!(std::path::Path::new(&backup_path).exists());

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn general_settings_preserve_the_native_selected_backup_directory() {
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
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();

    let updated = settings_service::update(
        handle,
        &state,
        &SettingsUpdateInput {
            language: "ar".into(),
            theme: "light".into(),
            date_format: "yyyy-MM-dd".into(),
            week_starts_on: 0,
            default_reminder_minutes: 30,
            lock_timeout_minutes: 10,
        },
    )
    .expect("general settings must not require a backup destination");
    assert_eq!(updated.theme, "light");
    assert_eq!(updated.date_format, "yyyy-MM-dd");
    assert!(updated.backup_directory.is_some());

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
