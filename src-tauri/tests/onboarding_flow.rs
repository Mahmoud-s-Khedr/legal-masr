use legalmaster_lib::{
    backup, db,
    dto::{
        InitializeInput, LawyerProfileDto, RestoreCredentialInput, RestoreCredentialKind,
        SettingsUpdateInput, VaultState,
    },
    errors::Error,
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

const ORIGINAL_PASSWORD: &str = "a secure local password";

struct Installation {
    recovery_key: String,
    backup: std::path::PathBuf,
    attachment: Vec<u8>,
}

/// Sets up an installation with a client and a managed attachment, backs it up,
/// and returns the backup copied outside the installation, as a lawyer would
/// carry it to a new machine.
fn installation_with_backup(
    handle: &tauri::AppHandle<tauri::test::MockRuntime>,
    state: &State<AppState>,
    carry_to: &std::path::Path,
) -> Installation {
    let init = app_service::initialize(
        handle,
        state,
        InitializeInput {
            password: ORIGINAL_PASSWORD.into(),
            full_name: "محامٍ تجريبي".into(),
            language: "ar".into(),
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();
    let master = state.unlocked().unwrap();
    let (_, db_path) = db::paths(handle).unwrap();
    db::open_db(&db_path, &master)
        .unwrap()
        .execute(
            "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-PORTABLE', 'عميل تجريبي', 'now', 'now')",
            [uuid::Uuid::new_v4().to_string()],
        )
        .unwrap();
    let attachment: Vec<u8> = (0..=255u8).cycle().take(8192).collect();
    let documents = db::app_dir(handle).unwrap().join("attachments");
    std::fs::create_dir_all(&documents).unwrap();
    std::fs::write(documents.join("scan.bin"), &attachment).unwrap();
    db::open_db(&db_path, &master).unwrap().execute("INSERT INTO attachments (id, client_id, original_filename, stored_filename, relative_path, file_size_bytes, sha256, category, created_at, updated_at) VALUES (?1, (SELECT id FROM clients LIMIT 1), 'scan.bin', 'scan.bin', 'scan.bin', ?2, ?3, 'OTHER', 'now', 'now')", rusqlite::params![uuid::Uuid::new_v4().to_string(), attachment.len() as i64, {use sha2::Digest; hex::encode(sha2::Sha256::digest(&attachment))}]).unwrap();
    let created = backup_service::create(handle, state, "2026-10-10-12-00-00").unwrap();
    let backup = carry_to.join("carried.lmsbackup");
    std::fs::copy(
        db::app_dir(handle).unwrap().join("Backups").join(created),
        &backup,
    )
    .unwrap();
    Installation {
        recovery_key: init.recovery_key,
        backup,
        attachment,
    }
}

fn credential(kind: RestoreCredentialKind, secret: &str) -> RestoreCredentialInput {
    RestoreCredentialInput {
        kind,
        secret: secret.into(),
        new_password: Some("a new recovery password".into()),
        confirm_password: Some("a new recovery password".into()),
    }
}

fn restored_client_numbers(
    handle: &tauri::AppHandle<tauri::test::MockRuntime>,
    state: &State<AppState>,
) -> Vec<String> {
    let (_, db_path) = db::paths(handle).unwrap();
    let connection = db::open_db(&db_path, &state.unlocked().unwrap()).unwrap();
    let mut statement = connection
        .prepare("SELECT internal_number FROM clients ORDER BY internal_number")
        .unwrap();
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    rows
}

#[test]
fn a_backup_restores_into_a_fresh_installation_with_the_original_password() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    let carried = tempfile::tempdir().unwrap();
    let source = installation_with_backup(handle, &state, carried.path());

    // A new machine: no vault, no key in memory.
    app_service::lock(&state).unwrap();
    std::fs::remove_dir_all(db::app_dir(handle).unwrap()).unwrap();
    let status = app_service::get_status(handle, &state).unwrap();
    assert!(!status.initialized);
    assert_eq!(status.vault_state, VaultState::Empty);

    let token = state
        .store_restore_selection(source.backup.clone())
        .unwrap();
    let wrong = backup_service::prepare(
        handle,
        &state,
        &token,
        Some(&credential(
            RestoreCredentialKind::Password,
            "a different local password",
        )),
    )
    .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token));
    assert!(matches!(wrong, Err(Error::InvalidPassword)));
    let still_empty = app_service::get_status(handle, &state).unwrap();
    assert!(
        !still_empty.initialized,
        "a wrong password leaves the installation empty"
    );

    // The selection survives a mistyped password, so the file is not picked again.
    backup_service::prepare(
        handle,
        &state,
        &token,
        Some(&credential(
            RestoreCredentialKind::Password,
            ORIGINAL_PASSWORD,
        )),
    )
    .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token))
    .unwrap();

    // The vault is locked afterwards, the selection is spent, and the password unlocks it.
    assert!(matches!(state.unlocked(), Err(Error::Locked)));
    assert!(matches!(
        state.peek_restore_selection(&token),
        Err(Error::Validation)
    ));
    let locked = app_service::get_status(handle, &state).unwrap();
    assert!(locked.initialized && !locked.unlocked);
    assert_eq!(locked.vault_state, VaultState::Locked);
    assert!(matches!(
        app_service::unlock(handle, &state, "a different local password"),
        Err(Error::InvalidPassword)
    ));
    app_service::unlock(handle, &state, ORIGINAL_PASSWORD).unwrap();
    assert_eq!(restored_client_numbers(handle, &state), ["CL-PORTABLE"]);
    assert_eq!(
        std::fs::read(db::app_dir(handle).unwrap().join("attachments/scan.bin")).unwrap(),
        source.attachment
    );
    // A restored workspace can take another backup, and that one restores too.
    backup_service::create(handle, &state, "2026-10-10-12-00-00").unwrap();

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn a_backup_restores_with_the_recovery_key_and_a_new_password() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    let carried = tempfile::tempdir().unwrap();
    let source = installation_with_backup(handle, &state, carried.path());
    app_service::lock(&state).unwrap();
    std::fs::remove_dir_all(db::app_dir(handle).unwrap()).unwrap();

    let token = state
        .store_restore_selection(source.backup.clone())
        .unwrap();
    let wrong = backup_service::prepare(
        handle,
        &state,
        &token,
        Some(&credential(
            RestoreCredentialKind::RecoveryKey,
            "0123456789abcdef",
        )),
    )
    .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token));
    assert!(matches!(wrong, Err(Error::InvalidRecovery)));
    backup_service::prepare(
        handle,
        &state,
        &token,
        Some(&credential(
            RestoreCredentialKind::RecoveryKey,
            &source.recovery_key.to_uppercase(),
        )),
    )
    .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token))
    .unwrap();
    assert!(app_service::unlock(handle, &state, ORIGINAL_PASSWORD).is_err());
    app_service::unlock(handle, &state, "a new recovery password").unwrap();
    assert_eq!(restored_client_numbers(handle, &state), ["CL-PORTABLE"]);

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn restore_recovers_an_incomplete_installation_but_never_replaces_a_healthy_locked_vault() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    let carried = tempfile::tempdir().unwrap();
    let source = installation_with_backup(handle, &state, carried.path());
    let token = state
        .store_restore_selection(source.backup.clone())
        .unwrap();
    let secret = credential(RestoreCredentialKind::Password, ORIGINAL_PASSWORD);

    // Locked and healthy: the lock screen cannot replace the vault.
    app_service::lock(&state).unwrap();
    let token_again = state
        .store_restore_selection(source.backup.clone())
        .unwrap();
    assert_ne!(token, token_again, "a new selection replaces the old token");
    assert!(matches!(
        backup_service::prepare(handle, &state, &token_again, Some(&secret))
            .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token)),
        Err(Error::Locked)
    ));
    assert_eq!(
        app_service::get_status(handle, &state).unwrap().vault_state,
        VaultState::Locked
    );

    // An unknown token is refused outright.
    app_service::unlock(handle, &state, ORIGINAL_PASSWORD).unwrap();
    assert!(matches!(
        backup_service::prepare(handle, &state, "not-a-token", Some(&secret))
            .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token)),
        Err(Error::Validation)
    ));
    app_service::lock(&state).unwrap();

    // The database is lost: the gate is INCOMPLETE and restoring is allowed.
    let root = db::app_dir(handle).unwrap();
    std::fs::remove_file(root.join("legalmaster.sqlite")).unwrap();
    assert_eq!(
        app_service::get_status(handle, &state).unwrap().vault_state,
        VaultState::Incomplete
    );
    let token = state
        .store_restore_selection(source.backup.clone())
        .unwrap();
    backup_service::prepare(handle, &state, &token, Some(&secret))
        .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token))
        .unwrap();
    app_service::unlock(handle, &state, ORIGINAL_PASSWORD).unwrap();
    assert_eq!(restored_client_numbers(handle, &state), ["CL-PORTABLE"]);
    // What was left behind is kept for the lawyer rather than deleted.
    assert!(std::fs::read_dir(root.join("EmergencySnapshots"))
        .unwrap()
        .next()
        .is_some());

    let _ = std::fs::remove_dir_all(db::app_dir(handle).unwrap());
}

#[test]
fn restore_refuses_while_a_vault_operation_is_pending() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    let carried = tempfile::tempdir().unwrap();
    let source = installation_with_backup(handle, &state, carried.path());
    app_service::lock(&state).unwrap();
    let root = db::app_dir(handle).unwrap();
    std::fs::write(root.join("vault-operation.json"), b"{}").unwrap();
    let token = state
        .store_restore_selection(source.backup.clone())
        .unwrap();
    let result = backup_service::prepare(
        handle,
        &state,
        &token,
        Some(&credential(
            RestoreCredentialKind::Password,
            ORIGINAL_PASSWORD,
        )),
    )
    .and_then(|prepared| backup_service::commit(handle, &state, &prepared.token));
    assert!(matches!(result, Err(Error::VaultInterrupted)));
    assert!(root.join("vault-operation.json").exists());

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

    let backup_path = backup_service::create(handle, &state, "2026-10-10-12-00-00")
        .expect("backup_create must succeed against the auto-computed backup directory");
    let backup_path = db::app_dir(handle)
        .unwrap()
        .join("Backups")
        .join(backup_path);
    assert!(backup_path.exists());
    backup::validate(
        &backup_path.to_string_lossy(),
        Some(&state.unlocked().unwrap()),
        None,
    )
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

#[test]
fn archived_owners_cannot_be_bypassed_by_reassignment_and_active_owners_can() {
    use legalmaster_lib::services::{
        document_service, finance_service, hearing_service, task_service,
    };
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    app_service::initialize(
        handle,
        &state,
        InitializeInput {
            password: ORIGINAL_PASSWORD.into(),
            full_name: "Synthetic".into(),
            language: "en".into(),
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();
    let client = "00000000-0000-0000-0000-000000000001";
    let old = "00000000-0000-0000-0000-000000000002";
    let new = "00000000-0000-0000-0000-000000000003";
    let (_, path) = db::paths(handle).unwrap();
    let conn = db::open_db(&path, &state.unlocked().unwrap()).unwrap();
    conn.execute("INSERT INTO clients(id,internal_number,full_name,created_at,updated_at) VALUES (?1,'1','Synthetic','now','now')", [client]).unwrap();
    for (id, number) in [(old, "1"), (new, "2")] {
        conn.execute("INSERT INTO cases(id,internal_number,status,created_at,updated_at) VALUES (?1,?2,'ACTIVE','now','now')", rusqlite::params![id,number]).unwrap();
        conn.execute("INSERT INTO case_clients(case_id,client_id,created_at,updated_at) VALUES (?1,?2,'now','now')",rusqlite::params![id,client]).unwrap();
    }
    let task_input = |id: Option<String>, owner: Option<&str>| {
        serde_json::from_value(
            serde_json::json!({"id":id,"caseId":owner,"title":"Synthetic","dueDate":"2026-10-10"}),
        )
        .unwrap()
    };
    let payment_input = |id: Option<String>, owner: &str| {
        serde_json::from_value(serde_json::json!({"id":id,"caseId":owner,"payerClientId":client,"amountMinor":100,"paymentDate":"2026-10-10"})).unwrap()
    };
    let expense_input = |id: Option<String>, owner: Option<&str>| {
        serde_json::from_value(serde_json::json!({"id":id,"caseId":owner,"amountMinor":100,"expenseDate":"2026-10-10","expenseType":"OTHER"})).unwrap()
    };
    let hearing_input = |id: Option<String>, owner: &str| {
        serde_json::from_value(
            serde_json::json!({"id":id,"caseId":owner,"hearingDate":"2026-10-10"}),
        )
        .unwrap()
    };
    let task = task_service::save(handle, &state, task_input(None, Some(old))).unwrap();
    let payment = finance_service::save_payment(handle, &state, payment_input(None, old)).unwrap();
    let expense =
        finance_service::save_expense(handle, &state, expense_input(None, Some(old))).unwrap();
    let hearing = hearing_service::save(handle, &state, hearing_input(None, old)).unwrap();
    let fixture = tempfile::NamedTempFile::new().unwrap();
    std::fs::write(fixture.path(), b"Synthetic attachment").unwrap();
    let source = state.store_document_source(fixture.path().into()).unwrap();
    let document = document_service::add(
        handle,
        &state,
        serde_json::from_value(
            serde_json::json!({"expenseId":expense.id,"sourceToken":source,"category":"OTHER"}),
        )
        .unwrap(),
    )
    .unwrap();
    conn.execute("UPDATE cases SET archived_at='now' WHERE id=?1", [old])
        .unwrap();
    assert!(matches!(
        task_service::save(handle, &state, task_input(Some(task.id.clone()), Some(new))),
        Err(Error::CaseArchived)
    ));
    assert!(matches!(
        task_service::save(handle, &state, task_input(Some(task.id.clone()), None)),
        Err(Error::CaseArchived)
    ));
    assert!(matches!(
        finance_service::save_payment(handle, &state, payment_input(Some(payment.id.clone()), new)),
        Err(Error::CaseArchived)
    ));
    assert!(matches!(
        finance_service::save_expense(
            handle,
            &state,
            expense_input(Some(expense.id.clone()), None)
        ),
        Err(Error::CaseArchived)
    ));
    assert!(matches!(
        hearing_service::save(handle, &state, hearing_input(Some(hearing.id.clone()), new)),
        Err(Error::CaseArchived)
    ));
    assert!(matches!(
        document_service::remove(handle, &state, &document.id),
        Err(Error::CaseArchived)
    ));
    assert!(matches!(
        task_service::save(handle, &state, task_input(None, Some(old))),
        Err(Error::CaseArchived)
    ));
    conn.execute("UPDATE cases SET archived_at=NULL WHERE id=?1", [old])
        .unwrap();
    assert_eq!(
        task_service::save(handle, &state, task_input(Some(task.id), Some(new)))
            .unwrap()
            .case_id
            .as_deref(),
        Some(new)
    );
    finance_service::save_payment(handle, &state, payment_input(Some(payment.id), new)).unwrap();
    assert_eq!(
        finance_service::save_expense(
            handle,
            &state,
            expense_input(Some(expense.id.clone()), None)
        )
        .unwrap()
        .case_id,
        None
    );
    hearing_service::save(handle, &state, hearing_input(Some(hearing.id), old)).unwrap();
    assert!(matches!(
        finance_service::delete_expense(handle, &state, &expense.id),
        Err(Error::ExpenseHasAttachments)
    ));
    document_service::remove(handle, &state, &document.id).unwrap();
    finance_service::delete_expense(handle, &state, &expense.id).unwrap();
}

#[test]
fn client_edits_refresh_linked_search_and_normalized_numbers_collide() {
    use legalmaster_lib::services::{client_service, search_service};
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    app_service::initialize(
        handle,
        &state,
        InitializeInput {
            password: ORIGINAL_PASSWORD.into(),
            full_name: "Synthetic".into(),
            language: "en".into(),
            lock_timeout_minutes: 15,
        },
    )
    .unwrap();
    let make = |number: &str, name: &str| {
        serde_json::from_value(
            serde_json::json!({"internalNumber":number,"fullName":name,"confirmDuplicate":true}),
        )
        .unwrap()
    };
    let client = client_service::create(handle, &state, make("١٢", "أحمد التجريبي")).unwrap();
    assert_eq!(client.internal_number, "12");
    assert!(client_service::create(handle, &state, make("۱۲", "Other Synthetic")).is_err());
    let (_, path) = db::paths(handle).unwrap();
    let conn = db::open_db(&path, &state.unlocked().unwrap()).unwrap();
    let case = "00000000-0000-0000-0000-000000000002";
    let poa = "00000000-0000-0000-0000-000000000003";
    conn.execute("INSERT INTO cases(id,internal_number,status,created_at,updated_at) VALUES (?1,'1','ACTIVE','now','now')",[case]).unwrap();
    conn.execute("INSERT INTO case_clients(case_id,client_id,created_at,updated_at) VALUES (?1,?2,'now','now')",rusqlite::params![case,client.id]).unwrap();
    conn.execute("INSERT INTO powers_of_attorney(id,internal_sequence,created_at,updated_at) VALUES (?1,'1','now','now')",[poa]).unwrap();
    conn.execute("INSERT INTO power_of_attorney_clients(power_of_attorney_id,client_id,created_at) VALUES (?1,?2,'now')",rusqlite::params![poa,client.id]).unwrap();
    search_service::rebuild_index(handle, &state).unwrap();
    assert_eq!(
        search_service::search(handle, &state, "احمد التجريبي")
            .unwrap()
            .len(),
        3
    );
    client_service::update(
        handle,
        &state,
        serde_json::from_value(
            serde_json::json!({"id":client.id,"internalNumber":"12","fullName":"محمود الاختباري"}),
        )
        .unwrap(),
    )
    .unwrap();
    assert!(search_service::search(handle, &state, "احمد التجريبي")
        .unwrap()
        .is_empty());
    let hits = search_service::search(handle, &state, "محمود الاختباري").unwrap();
    assert_eq!(hits.len(), 3);
    assert!(hits.iter().any(|hit| hit.entity_type == "CASE"));
    assert!(hits
        .iter()
        .any(|hit| hit.entity_type == "POWER_OF_ATTORNEY"));
    assert!(search_service::search(handle, &state, "%_")
        .unwrap()
        .is_empty());
}

#[test]
fn restore_tokens_are_one_use_and_cancel_or_lock_removes_preparation() {
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let handle = app.handle();
    let state: State<AppState> = handle.state();
    let carry = tempfile::tempdir().unwrap();
    let installation = installation_with_backup(handle, &state, carry.path());
    let (_, db_path) = db::paths(handle).unwrap();
    let before = std::fs::read(&db_path).unwrap();
    let selection = state
        .store_restore_selection(installation.backup.clone())
        .unwrap();
    let prepared = backup_service::prepare(handle, &state, &selection, None).unwrap();
    assert_eq!(std::fs::read(&db_path).unwrap(), before);
    state.clear_restore_selection().unwrap();
    assert!(matches!(
        backup_service::commit(handle, &state, &prepared.token),
        Err(Error::Validation)
    ));
    assert!(backup_service::prepare(handle, &state, &selection, None).is_err());
    let selection = state
        .store_restore_selection(installation.backup.clone())
        .unwrap();
    let prepared = backup_service::prepare(handle, &state, &selection, None).unwrap();
    app_service::lock(&state).unwrap();
    app_service::unlock(handle, &state, ORIGINAL_PASSWORD).unwrap();
    assert!(matches!(
        backup_service::commit(handle, &state, &prepared.token),
        Err(Error::Validation)
    ));
    let selection = state.store_restore_selection(installation.backup).unwrap();
    let mismatch = RestoreCredentialInput {
        kind: RestoreCredentialKind::RecoveryKey,
        secret: installation.recovery_key,
        new_password: Some("synthetic new password".into()),
        confirm_password: Some("different confirmation".into()),
    };
    assert!(matches!(
        backup_service::prepare(handle, &state, &selection, Some(&mismatch)),
        Err(Error::Validation)
    ));
    let prepared = backup_service::prepare(handle, &state, &selection, None).unwrap();
    backup_service::commit(handle, &state, &prepared.token).unwrap();
    assert!(state.unlocked().is_err());
    app_service::unlock(handle, &state, ORIGINAL_PASSWORD).unwrap();
    assert!(matches!(
        backup_service::commit(handle, &state, &prepared.token),
        Err(Error::Validation)
    ));
    assert!(!std::fs::read_dir(db::app_dir(handle).unwrap())
        .unwrap()
        .any(|entry| entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".prepared-")));
}

#[test]
fn local_client_export_preserves_live_data_and_refuses_unwritable_destinations() {
    use legalmaster_lib::{dto::ClientCreateInput, services::client_service};
    let _guard = lock_app_dir();
    let app = fresh_mock_app();
    app.manage(AppState::default());
    let state: State<AppState> = app.state();
    app_service::initialize(app.handle(), &state, setup_input()).unwrap();
    let client = client_service::create(
        app.handle(),
        &state,
        ClientCreateInput {
            internal_number: "EXPORT-1".into(),
            full_name: "Fictional export client".into(),
            national_id: None,
            primary_phone: None,
            email: None,
            address: None,
            notes: None,
            confirm_duplicate: false,
        },
    )
    .unwrap();
    let destination = tempfile::tempdir().unwrap();
    let exported =
        client_service::export(app.handle(), &state, &client.id, destination.path()).unwrap();
    let contents: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&exported).unwrap()).unwrap();
    assert_eq!(contents["client"]["id"], client.id);
    assert_eq!(contents["client"]["internalNumber"], "EXPORT-1");
    assert_eq!(contents["cases"], serde_json::json!([]));
    assert_eq!(contents["payments"], serde_json::json!([]));
    let before = std::fs::read(&exported).unwrap();
    assert!(client_service::export(
        app.handle(),
        &state,
        &client.id,
        &destination.path().join("missing")
    )
    .is_err());
    assert_eq!(std::fs::read(&exported).unwrap(), before);
    assert_eq!(
        client_service::get(app.handle(), &state, &client.id)
            .unwrap()
            .internal_number,
        "EXPORT-1"
    );
    app_service::lock(&state).unwrap();
    assert!(matches!(
        client_service::export(app.handle(), &state, &client.id, destination.path()),
        Err(Error::Locked)
    ));
}
