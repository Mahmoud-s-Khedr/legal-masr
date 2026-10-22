//! Native desktop lifecycle. Only static localized text crosses into tray UI.
use crate::{dto::SettingsDto, errors::Error, services::app_service, state::AppState};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[derive(Default)]
pub struct TrayState {
    available: AtomicBool,
    keep_running: AtomicBool,
    english: AtomicBool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum CloseDecision {
    RefuseBusy,
    LockAndHide,
    Quit,
}

/// Quit always bypasses the preference; busy operations always veto both paths.
pub fn close_decision(enabled: bool, available: bool, busy: bool, quit: bool) -> CloseDecision {
    if busy {
        CloseDecision::RefuseBusy
    } else if enabled && available && !quit {
        CloseDecision::LockAndHide
    } else {
        CloseDecision::Quit
    }
}

fn text<R: Runtime>(app: &AppHandle<R>, key: &str) -> String {
    let english = app
        .try_state::<TrayState>()
        .is_some_and(|state| state.english.load(Ordering::SeqCst));
    let json = if english {
        include_str!("../../src/i18n/en/common.json")
    } else {
        include_str!("../../src/i18n/ar/common.json")
    };
    // Both bundled catalogs are checked by tests; never use record data here.
    serde_json::from_str::<serde_json::Value>(json)
        .ok()
        .and_then(|value| value["tray"][key].as_str().map(str::to_owned))
        .unwrap_or_else(|| "LegalMaster".into())
}

pub fn available<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.try_state::<TrayState>()
        .is_some_and(|state| state.available.load(Ordering::SeqCst))
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn disable<R: Runtime>(app: &AppHandle<R>) {
    app.state::<TrayState>()
        .available
        .store(false, Ordering::SeqCst);
    tracing::warn!(code = "TRAY_UNAVAILABLE", "TRAY_UNAVAILABLE");
    show(app);
}

pub fn show<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn report<R: Runtime>(app: &AppHandle<R>, key: &str) {
    show(app);
    app.dialog()
        .message(text(app, key))
        .title(text(app, "tooltip"))
        .kind(MessageDialogKind::Warning)
        .show(|_| {});
}

/// Same native lock service as app_lock, plus a renderer session boundary.
/// Refuse to hide if delivery fails: the visible window can still be recovered.
fn lock<R: Runtime>(app: &AppHandle<R>) -> Result<(), Error> {
    app_service::lock(&app.state::<AppState>())?;
    app.emit("vault-locked", ()).map_err(|_| Error::Operation)
}

fn lock_now<R: Runtime>(app: &AppHandle<R>) -> Result<(), Error> {
    let state = app.state::<AppState>();
    let _operation = state.operation()?;
    lock(app)
}

pub fn request_close<R: Runtime>(app: &AppHandle<R>, quit: bool) {
    let state = app.state::<AppState>();
    let operation = state.operation();
    let tray = app.state::<TrayState>();
    // Recheck the local host before hiding, including between monitor ticks.
    let can_hide = available(app) && platform_host_available();
    match close_decision(
        tray.keep_running.load(Ordering::SeqCst),
        can_hide,
        operation.is_err(),
        quit,
    ) {
        CloseDecision::RefuseBusy => report(app, "busy"),
        CloseDecision::LockAndHide => {
            if lock(app).is_err() {
                report(app, "lockFailed");
                return;
            }
            if let Some(window) = app.get_webview_window("main") {
                if window.hide().is_err() {
                    report(app, "hideFailed");
                }
            }
        }
        CloseDecision::Quit => {
            // Keep admission closed after releasing the guard; app.exit is
            // delivered to the event loop and must not race another command.
            state.begin_shutdown();
            app.exit(0);
        }
    }
}

pub fn apply_settings<R: Runtime>(app: &AppHandle<R>, settings: &SettingsDto) {
    let Some(state) = app.try_state::<TrayState>() else {
        return;
    };
    state
        .keep_running
        .store(settings.keep_running_in_tray, Ordering::SeqCst);
    let english = settings.language == "en";
    if state.english.swap(english, Ordering::SeqCst) != english {
        #[cfg(any(target_os = "windows", target_os = "linux"))]
        {
            let app = app.clone();
            let handle = app.clone();
            if handle
                .run_on_main_thread(move || {
                    if let Some(tray) = app.tray_by_id("legalmaster") {
                        let result = menu(&app).and_then(|menu| {
                            tray.set_menu(Some(menu))?;
                            tray.set_tooltip(Some(text(&app, "tooltip")))
                        });
                        if result.is_err() {
                            disable(&app);
                        }
                    }
                })
                .is_err()
            {
                disable(&handle);
            }
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{Menu, MenuItem};
    let show = MenuItem::with_id(app, "tray-show", text(app, "show"), true, None::<&str>)?;
    let lock = MenuItem::with_id(app, "tray-lock", text(app, "lock"), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", text(app, "quit"), true, None::<&str>)?;
    Menu::with_items(app, &[&show, &lock, &quit])
}

#[cfg(target_os = "linux")]
fn platform_host_available() -> bool {
    use gio::glib::variant::ToVariant;
    let Ok(bus) = gio::bus_get_sync(gio::BusType::Session, None::<&gio::Cancellable>) else {
        return false;
    };
    bus.call_sync(
        Some("org.kde.StatusNotifierWatcher"),
        "/StatusNotifierWatcher",
        "org.freedesktop.DBus.Properties",
        "Get",
        Some(
            &(
                "org.kde.StatusNotifierWatcher",
                "IsStatusNotifierHostRegistered",
            )
                .to_variant(),
        ),
        None,
        gio::DBusCallFlags::NO_AUTO_START,
        300,
        None::<&gio::Cancellable>,
    )
    .ok()
    .and_then(|reply| reply.get::<(gio::glib::Variant,)>())
    .and_then(|(value,)| value.get::<bool>())
    .unwrap_or(false)
}

#[cfg(not(target_os = "linux"))]
fn platform_host_available() -> bool {
    cfg!(target_os = "windows")
}

#[cfg(target_os = "linux")]
fn indicator_library_available() -> bool {
    ["libayatana-appindicator3.so.1", "libappindicator3.so.1"]
        .iter()
        .any(|name| {
            // Fixed system library names only; no user-supplied paths/symbols.
            // Preflight avoids libappindicator's panic when neither is installed.
            unsafe { libloading::Library::new(name) }.is_ok()
        })
}

pub fn setup<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let result = (|| -> tauri::Result<()> {
            if !platform_host_available() {
                return Err(tauri::Error::AssetNotFound("TRAY_UNAVAILABLE".into()));
            }
            #[cfg(target_os = "linux")]
            if !indicator_library_available() {
                return Err(tauri::Error::AssetNotFound("TRAY_UNAVAILABLE".into()));
            }
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| tauri::Error::AssetNotFound("TRAY_ICON_UNAVAILABLE".into()))?;
            tauri::tray::TrayIconBuilder::with_id("legalmaster")
                .icon(icon)
                .tooltip(text(app, "tooltip"))
                .menu(&menu(app)?)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "tray-show" => show(app),
                    "tray-lock" => match lock_now(app) {
                        Ok(()) => (),
                        Err(Error::OperationBusy) => report(app, "busy"),
                        Err(_) => report(app, "lockFailed"),
                    },
                    "tray-quit" => request_close(app, true),
                    _ => (),
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        }
                    ) {
                        show(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })();
        if result.is_err() {
            disable(app);
            return;
        }
        app.state::<TrayState>()
            .available
            .store(true, Ordering::SeqCst);
        #[cfg(target_os = "linux")]
        {
            let app = app.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                if !platform_host_available() {
                    let handle = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        disable(&handle);
                    });
                    // Conservative: restart is required after tray host loss.
                    break;
                }
            });
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    let _ = app;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_defaults_to_quit_and_hides_only_with_both_opt_in_and_a_tray() {
        use CloseDecision::*;
        for (enabled, available, quit, expected) in [
            (false, false, false, Quit),
            (false, true, false, Quit),
            (true, false, false, Quit),
            (true, true, false, LockAndHide),
            (false, false, true, Quit),
            (false, true, true, Quit),
            (true, false, true, Quit),
            (true, true, true, Quit),
        ] {
            assert_eq!(close_decision(enabled, available, false, quit), expected);
        }
    }

    #[test]
    fn operations_block_close_hide_and_explicit_quit() {
        for enabled in [false, true] {
            for available in [false, true] {
                for quit in [false, true] {
                    assert_eq!(
                        close_decision(enabled, available, true, quit),
                        CloseDecision::RefuseBusy
                    );
                }
            }
        }
    }

    #[test]
    fn native_lock_clears_the_existing_session_and_notifies_the_renderer() {
        use std::sync::Arc;
        use tauri::Listener;
        let app = tauri::test::mock_app();
        app.manage(AppState::default());
        let state = app.state::<AppState>();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let token = state.store_document_source("fictional.pdf".into()).unwrap();
        let request = state.begin_restore_selection().unwrap();
        let generation = state.generation();
        let received = Arc::new(AtomicBool::new(false));
        let flag = received.clone();
        app.listen("vault-locked", move |_| {
            flag.store(true, Ordering::SeqCst);
        });
        lock(app.handle()).unwrap();
        assert!(received.load(Ordering::SeqCst));
        assert!(state.unlocked().is_err());
        assert!(state.check_generation(generation).is_err());
        assert!(state.take_document_source(&token).is_err());
        assert!(state
            .finish_restore_selection(request, "fictional.lmbak".into())
            .is_err());
    }

    #[test]
    fn tray_lock_refuses_busy_work_then_locks_when_it_finishes() {
        let app = tauri::test::mock_app();
        app.manage(AppState::default());
        let state = app.state::<AppState>();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let guard = state.operation().unwrap();
        assert!(matches!(lock_now(app.handle()), Err(Error::OperationBusy)));
        assert!(state.unlocked().is_ok());
        drop(guard);
        lock_now(app.handle()).unwrap();
        assert!(state.unlocked().is_err());
    }

    #[test]
    fn failed_native_lock_does_not_announce_a_successful_session_boundary() {
        use std::sync::Arc;
        use tauri::Listener;
        let app = tauri::test::mock_app();
        app.manage(AppState::default());
        let state = app.state::<AppState>();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let received = Arc::new(AtomicBool::new(false));
        let flag = received.clone();
        app.listen("vault-locked", move |_| {
            flag.store(true, Ordering::SeqCst);
        });
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = state.deletion.lock().unwrap();
            panic!("synthetic lock failure");
        }));
        assert!(lock(app.handle()).is_err());
        assert!(!received.load(Ordering::SeqCst));
        assert!(state.unlocked().is_ok());
    }

    #[test]
    fn native_catalogs_have_all_static_labels_and_failures() {
        for json in [
            include_str!("../../src/i18n/ar/common.json"),
            include_str!("../../src/i18n/en/common.json"),
        ] {
            let catalog: serde_json::Value = serde_json::from_str(json).unwrap();
            for key in [
                "show",
                "lock",
                "quit",
                "busy",
                "lockFailed",
                "hideFailed",
                "tooltip",
            ] {
                assert!(!catalog["tray"][key].as_str().unwrap().is_empty());
            }
        }
    }
}
