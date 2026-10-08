use legalmaster_lib::{
    backup, db,
    dto::{
        CaseClientInput, CaseCreateInput, ClientCreateInput, ClientListInput, HearingDecisionInput,
        HearingInput, InitializeInput, LawyerProfileDto, SettingsUpdateInput,
    },
    errors::Error,
    security,
    services::{
        app_service,
        backup_service::{self, BackupSecret},
        case_service, client_service, dashboard_service, hearing_service, settings_service,
    },
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
            office_address: None,
            default_currency: "EGP".into(),
        },
    );
    assert!(invalid.is_err());

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

fn fresh_mock_app() -> tauri::App<tauri::test::MockRuntime> {
    #[cfg(feature = "desktop-e2e")]
    {
        static ISOLATED: std::sync::OnceLock<tempfile::TempDir> = std::sync::OnceLock::new();
        ISOLATED.get_or_init(|| {
            let directory = tempfile::Builder::new()
                .prefix("legalmaster-desktop-e2e-")
                .tempdir()
                .unwrap();
            let nonce = uuid::Uuid::new_v4().to_string();
            std::fs::write(directory.path().join("runner-marker"), &nonce).unwrap();
            std::env::set_var("LEGALMASTER_E2E_ROOT", directory.path());
            std::env::set_var("LEGALMASTER_E2E_NONCE", nonce);
            directory
        });
    }
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
    assert_eq!(settings.language, "ar");

    let backup_name = backup_service::create(handle, &state, "2026-10-08-1052")
        .expect("backup_create must succeed against the auto-computed backup directory");
    assert_eq!(backup_name, "LegalMasr-backup-2026-10-08-1052.lmsbackup");
    let backup_path = db::app_dir(handle)
        .unwrap()
        .join("Backups")
        .join(&backup_name);
    assert!(backup_path.exists());
    assert_eq!(backup_service::latest_file(handle).unwrap(), backup_path);
    backup::validate(&backup_path.to_string_lossy(), &state.unlocked().unwrap())
        .expect("the freshly created backup must validate");

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn general_settings_update_without_backup_configuration() {
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
        let conn = db::create_db(&db_path, &master).unwrap();
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

fn setup_input() -> InitializeInput {
    InitializeInput {
        password: "a secure local password".into(),
        full_name: "Synthetic lawyer".into(),
        language: "en".into(),
        lock_timeout_minutes: 30,
    }
}

#[test]
fn partial_vault_artifacts_block_setup_without_replacement() {
    let _guard = lock_app_dir();
    for name in [
        "legalmaster.sqlite",
        "security.previous",
        "legalmaster.tmp",
        "attachments",
        "Backups",
    ] {
        let app = fresh_mock_app();
        app.manage(AppState::default());
        let state: State<AppState> = app.state();
        let root = db::app_dir(app.handle()).unwrap();
        let path = root.join(name);
        if name == "attachments" || name == "Backups" {
            std::fs::create_dir(&path).unwrap();
            std::fs::write(path.join("synthetic.txt"), b"preserve").unwrap();
        } else {
            std::fs::write(&path, b"preserve").unwrap();
        }
        assert!(matches!(
            app_service::initialize(app.handle(), &state, setup_input()),
            Err(legalmaster_lib::errors::Error::Initialized)
        ));
        let path = if name == "security.previous" {
            root.join("security.json")
        } else {
            path
        };
        let preserved = if path.is_dir() {
            path.join("synthetic.txt")
        } else {
            path
        };
        assert_eq!(std::fs::read(preserved).unwrap(), b"preserve");
        // Security .previous is recovered only for that case, but never causes
        // setup to overwrite the stranded database or documents.
        assert!(
            app_service::get_status(app.handle(), &state)
                .unwrap()
                .initialized
        );
    }
    let app = fresh_mock_app();
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

#[test]
fn missing_database_unlock_and_recovery_preserve_security_and_remain_locked() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    let recovery = app_service::initialize(app.handle(), &state, setup_input())
        .unwrap()
        .recovery_key;
    app_service::lock(&state).unwrap();
    let (security_path, database_path) = db::paths(app.handle()).unwrap();
    let security_before = std::fs::read(&security_path).unwrap();
    std::fs::remove_file(&database_path).unwrap();
    assert!(matches!(
        app_service::unlock(app.handle(), &state, "a secure local password"),
        Err(legalmaster_lib::errors::Error::VaultMissing)
    ));
    assert!(matches!(
        app_service::recover_access(app.handle(), &state, &recovery, "new secure local password"),
        Err(legalmaster_lib::errors::Error::VaultMissing)
    ));
    assert!(!database_path.exists());
    assert!(state.unlocked().is_err());
    assert_eq!(std::fs::read(security_path).unwrap(), security_before);
    assert_eq!(
        app_service::get_status(app.handle(), &state)
            .unwrap()
            .vault_state,
        legalmaster_lib::dto::VaultState::Incomplete
    );
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

#[test]
fn newer_schema_refuses_unlock_and_recovery_without_rewriting_either_file() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    let recovery = app_service::initialize(app.handle(), &state, setup_input())
        .unwrap()
        .recovery_key;
    let (security_path, database_path) = db::paths(app.handle()).unwrap();
    {
        let conn = db::open_db(&database_path, &state.unlocked().unwrap()).unwrap();
        conn.execute(
            "INSERT INTO schema_migrations VALUES (999, 'synthetic future')",
            [],
        )
        .unwrap();
    }
    app_service::lock(&state).unwrap();
    let security_before = std::fs::read(&security_path).unwrap();
    let database_before = std::fs::read(&database_path).unwrap();
    assert!(matches!(
        app_service::unlock(app.handle(), &state, "a secure local password"),
        Err(legalmaster_lib::errors::Error::VaultNewerSchema)
    ));
    assert!(matches!(
        app_service::recover_access(app.handle(), &state, &recovery, "new secure local password"),
        Err(legalmaster_lib::errors::Error::VaultNewerSchema)
    ));
    assert!(state.unlocked().is_err());
    assert_eq!(std::fs::read(security_path).unwrap(), security_before);
    assert_eq!(std::fs::read(database_path).unwrap(), database_before);
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

#[test]
fn password_change_requires_an_unlocked_session_and_correct_current_password() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    app_service::initialize(app.handle(), &state, setup_input()).unwrap();
    let (security_path, _) = db::paths(app.handle()).unwrap();
    let before = std::fs::read(&security_path).unwrap();
    assert!(app_service::change_password(
        app.handle(),
        &state,
        "wrong password",
        "new secure local password"
    )
    .is_err());
    assert_eq!(std::fs::read(&security_path).unwrap(), before);
    app_service::lock(&state).unwrap();
    assert!(matches!(
        app_service::change_password(
            app.handle(),
            &state,
            "a secure local password",
            "new secure local password"
        ),
        Err(legalmaster_lib::errors::Error::Locked)
    ));
    assert_eq!(std::fs::read(&security_path).unwrap(), before);
    app_service::unlock(app.handle(), &state, "a secure local password").unwrap();
    app_service::change_password(
        app.handle(),
        &state,
        "a secure local password",
        "new secure local password",
    )
    .unwrap();
    app_service::lock(&state).unwrap();
    assert!(app_service::unlock(app.handle(), &state, "a secure local password").is_err());
    app_service::unlock(app.handle(), &state, "new secure local password").unwrap();
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

fn client_names(app: &tauri::App<tauri::test::MockRuntime>, state: &AppState) -> Vec<String> {
    client_service::list(
        app.handle(),
        state,
        ClientListInput {
            query: None,
            include_archived: true,
        },
    )
    .unwrap()
    .into_iter()
    .map(|client| client.full_name)
    .collect()
}

/// An office with one client and one backup of it, copied outside the app's folder (as on
/// a flash drive). Returns the copy and the recovery key.
fn office_backup(outside: &std::path::Path) -> (std::path::PathBuf, String) {
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    let recovery = app_service::initialize(app.handle(), &state, setup_input())
        .unwrap()
        .recovery_key;
    client_service::create(
        app.handle(),
        &state,
        ClientCreateInput {
            internal_number: "C-1".into(),
            full_name: "موكل تجريبي".into(),
            national_id: None,
            primary_phone: None,
            email: None,
            address: None,
            notes: None,
            confirm_duplicate: false,
        },
    )
    .unwrap();
    let name = backup_service::create(app.handle(), &state, "2026-10-08-1052").unwrap();
    let copy = outside.join("office.lmsbackup");
    std::fs::copy(
        db::app_dir(app.handle())
            .unwrap()
            .join("Backups")
            .join(name),
        &copy,
    )
    .unwrap();
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
    (copy, recovery)
}

#[test]
fn a_backup_restores_on_a_new_installation_with_its_password_or_recovery_key() {
    let _guard = lock_app_dir();
    let outside = tempfile::tempdir().unwrap();
    let (copy, recovery) = office_backup(outside.path());

    for secret in ["password", "recovery key"] {
        let app = fresh_mock_app();
        app.manage(AppState::default());
        let state: State<AppState> = app.state();
        backup_service::ensure_new_installation(app.handle()).unwrap();
        backup_service::ensure_portable(&copy).unwrap();
        let (opening, password) = if secret == "password" {
            (
                BackupSecret::Password("a secure local password"),
                "a secure local password",
            )
        } else {
            (
                BackupSecret::RecoveryKey {
                    key: &recovery,
                    new_password: "a brand new office password",
                },
                "a brand new office password",
            )
        };
        backup_service::restore_new_vault(app.handle(), &state, &copy, opening, "ar")
            .unwrap_or_else(|error| panic!("restore with the {secret} failed: {error:?}"));

        let status = app_service::get_status(app.handle(), &state).unwrap();
        assert!(status.initialized && status.unlocked, "{secret}");
        assert_eq!(client_names(&app, &state), vec!["موكل تجريبي"]);
        // The office's own profile comes back, not the placeholder made for the restore.
        assert_eq!(
            settings_service::get_profile(app.handle(), &state)
                .unwrap()
                .full_name,
            "Synthetic lawyer"
        );
        // The restored vault opens with the backup's password, or the new one chosen with
        // the recovery key, from now on.
        app_service::lock(&state).unwrap();
        app_service::unlock(app.handle(), &state, password).unwrap();
        assert!(matches!(
            backup_service::ensure_new_installation(app.handle()),
            Err(Error::Initialized)
        ));
    }
    let app = fresh_mock_app();
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

#[test]
fn a_wrong_secret_or_an_old_backup_leaves_the_new_installation_empty() {
    let _guard = lock_app_dir();
    let outside = tempfile::tempdir().unwrap();
    let (copy, _) = office_backup(outside.path());

    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    for opening in [
        BackupSecret::Password("not the password at all"),
        BackupSecret::RecoveryKey {
            key: "AAAA-BBBB-CCCC-DDDD",
            new_password: "a brand new office password",
        },
    ] {
        assert!(matches!(
            backup_service::restore_new_vault(app.handle(), &state, &copy, opening, "ar"),
            Err(Error::BackupSecretInvalid)
        ));
    }
    for opening in [
        BackupSecret::Password(""),
        // With the recovery key a new password of at least 12 characters is required.
        BackupSecret::RecoveryKey {
            key: "AAAA-BBBB-CCCC-DDDD",
            new_password: "short",
        },
    ] {
        assert!(matches!(
            backup_service::restore_new_vault(app.handle(), &state, &copy, opening, "ar"),
            Err(Error::Validation)
        ));
    }
    let status = app_service::get_status(app.handle(), &state).unwrap();
    assert!(!status.initialized && !status.unlocked);
    backup_service::ensure_new_installation(app.handle()).unwrap();

    // A backup made before backups carried their key envelope cannot be opened here.
    let master = [7u8; 32];
    let old_dir = tempfile::tempdir().unwrap();
    let old_db = old_dir.path().join("legalmaster.sqlite");
    db::migrate(&db::create_db(&old_db, &master).unwrap()).unwrap();
    let documents = old_dir.path().join("attachments");
    std::fs::create_dir(&documents).unwrap();
    let old_backup = backup::create(
        &old_db,
        &master,
        old_dir.path().to_str().unwrap(),
        &documents,
        "2026-10-08-1052",
        None,
    )
    .unwrap();
    assert!(matches!(
        backup_service::ensure_portable(std::path::Path::new(&old_backup)),
        Err(Error::BackupNotPortable)
    ));
    assert!(matches!(
        backup_service::restore_new_vault(
            app.handle(),
            &state,
            std::path::Path::new(&old_backup),
            BackupSecret::Password("a secure local password"),
            "ar"
        ),
        Err(Error::BackupNotPortable)
    ));
    assert!(
        !app_service::get_status(app.handle(), &state)
            .unwrap()
            .initialized
    );
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).ok();
}

#[test]
fn a_backup_from_another_office_is_named_as_such_not_as_damaged() {
    let _guard = lock_app_dir();
    let outside = tempfile::tempdir().unwrap();
    let (copy, _) = office_backup(outside.path());

    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    app_service::initialize(app.handle(), &state, setup_input()).unwrap();
    assert!(matches!(
        backup_service::inspect(app.handle(), &state, &copy),
        Err(Error::BackupFromOtherVault)
    ));
    let own = backup_service::create(app.handle(), &state, "2026-10-09-0900").unwrap();
    let own_path = db::app_dir(app.handle())
        .unwrap()
        .join("Backups")
        .join(&own);
    let summary = backup_service::inspect(app.handle(), &state, &own_path).unwrap();
    assert_eq!(summary.file_name, own);
    assert_eq!(summary.document_count, 0);
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

#[test]
fn a_new_recovery_key_replaces_the_old_one_only_with_the_current_password() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    let old_key = app_service::initialize(app.handle(), &state, setup_input())
        .unwrap()
        .recovery_key;

    for wrong in ["", "not the password"] {
        assert!(app_service::replace_recovery_key(app.handle(), &state, wrong).is_err());
    }
    let new_key =
        app_service::replace_recovery_key(app.handle(), &state, "a secure local password").unwrap();
    assert_ne!(new_key, old_key);
    assert_eq!(new_key.len(), 64);

    app_service::lock(&state).unwrap();
    assert!(matches!(
        app_service::replace_recovery_key(app.handle(), &state, "a secure local password"),
        Err(Error::Locked)
    ));
    assert!(matches!(
        app_service::recover_access(app.handle(), &state, &old_key, "another office password"),
        Err(Error::InvalidRecovery)
    ));
    app_service::recover_access(app.handle(), &state, &new_key, "another office password").unwrap();
    app_service::lock(&state).unwrap();
    app_service::unlock(app.handle(), &state, "another office password").unwrap();
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}

#[test]
fn a_hearing_decided_today_stays_on_todays_dashboard() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    app_service::initialize(app.handle(), &state, setup_input()).unwrap();
    let client = client_service::create(
        app.handle(),
        &state,
        ClientCreateInput {
            internal_number: "C-1".into(),
            full_name: "موكل تجريبي".into(),
            national_id: None,
            primary_phone: None,
            email: None,
            address: None,
            notes: None,
            confirm_duplicate: false,
        },
    )
    .unwrap();
    let case = case_service::create(
        app.handle(),
        &state,
        CaseCreateInput {
            internal_number: "K-1".into(),
            official_number: None,
            official_year: None,
            judicial_year: None,
            case_type: None,
            litigation_degree: None,
            court_name: None,
            circuit_name: None,
            status: "ACTIVE".into(),
            filed_on: None,
            closed_on: None,
            subject: None,
            notes: None,
            clients: vec![CaseClientInput {
                client_id: client.id,
                legal_capacity: None,
                power_of_attorney_id: None,
                notes: None,
            }],
        },
    )
    .unwrap();
    let hearing = |date: &str| HearingInput {
        id: None,
        case_id: case.id.clone(),
        hearing_date: date.into(),
        hearing_time: Some("09:30".into()),
        hearing_type: None,
        location: None,
        circuit_name: None,
        required_documents: None,
        notes: None,
        reminder_minutes: None,
    };
    let today = hearing_service::save(app.handle(), &state, hearing("2026-10-08")).unwrap();
    hearing_service::save(app.handle(), &state, hearing("2026-10-09")).unwrap();
    hearing_service::record_decision(
        app.handle(),
        &state,
        HearingDecisionInput {
            id: today.id.clone(),
            decision_text: Some("حجز للحكم".into()),
            next_hearing: None,
        },
    )
    .unwrap();

    let summary = dashboard_service::summary(app.handle(), &state, "2026-10-08").unwrap();
    assert_eq!(summary.today_hearings.len(), 1);
    assert_eq!(summary.today_hearings[0].id, today.id);
    assert_eq!(summary.today_hearings[0].status, "COMPLETED");
    // Upcoming hearings still list only those awaiting a decision.
    assert!(summary
        .upcoming_hearings
        .iter()
        .all(|hearing| hearing.status == "SCHEDULED"));
    std::fs::remove_dir_all(db::app_dir(app.handle()).unwrap()).unwrap();
}
