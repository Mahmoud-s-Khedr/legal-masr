//! Only fixed, public release URLs cross the network. The renderer never gets
//! an updater resource or permission to bypass the native backup gate.
use crate::{services::backup_service, state::AppState};
use serde::Serialize;
use std::{path::Path, time::Duration};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const FEED: &str =
    "https://github.com/Mahmoud-s-Khedr/legal-masr/releases/latest/download/latest.json";
const RELEASE_PATH: &str = "/Mahmoud-s-Khedr/legal-masr/releases/download/";

pub fn public_key() -> Option<&'static str> {
    if cfg!(feature = "desktop-e2e") {
        return None;
    }
    option_env!("LEGAL_MASR_UPDATER_PUBLIC_KEY")
        .map(str::trim)
        .filter(|key| !key.is_empty())
}

#[derive(Default)]
pub struct UpdateState(tauri::async_runtime::Mutex<Pending>);

#[derive(Default)]
struct Pending {
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpdateError {
    Unavailable,
    Busy,
    CheckFailed,
    DownloadFailed,
    NotDownloaded,
    BackupFailed,
    InstallFailed,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    notes: String,
    downloaded: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    current_version: String,
    available: bool,
    reason: Option<&'static str>,
}

fn supported_delivery(os: &str, appimage: bool, installed_windows: bool) -> bool {
    match os {
        "linux" => appimage,
        "windows" => installed_windows,
        "macos" => true,
        _ => false,
    }
}

fn installed_windows(executable: Option<&Path>) -> bool {
    executable
        .and_then(Path::parent)
        .is_some_and(|directory| directory.join(".legal-masr-installed").is_file())
}

fn availability(app: &AppHandle) -> Option<&'static str> {
    public_key()?;
    let executable = std::env::current_exe().ok();
    #[cfg(target_os = "linux")]
    let appimage = app.env().appimage.is_some();
    #[cfg(not(target_os = "linux"))]
    let appimage = false;
    if !supported_delivery(
        std::env::consts::OS,
        appimage,
        installed_windows(executable.as_deref()),
    ) {
        return Some("manual-install");
    }
    None
}

fn require_available(app: &AppHandle) -> Result<(), UpdateError> {
    if public_key().is_none() || availability(app).is_some() {
        return Err(UpdateError::Unavailable);
    }
    Ok(())
}

fn trusted_release_url(url: &tauri::Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.path().starts_with(RELEASE_PATH)
        && url.username().is_empty()
        && url.password().is_none()
}

#[tauri::command]
pub fn update_status(app: AppHandle) -> UpdateStatus {
    let reason = if public_key().is_none() {
        Some("not-configured")
    } else {
        availability(&app)
    };
    UpdateStatus {
        current_version: app.package_info().version.to_string(),
        available: reason.is_none(),
        reason,
    }
}

#[tauri::command]
pub async fn update_check(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Option<UpdateInfo>, UpdateError> {
    require_available(&app)?;
    let mut pending = state.inner().0.try_lock().map_err(|_| UpdateError::Busy)?;
    let mut update = app
        .updater_builder()
        .endpoints(vec![FEED.parse().map_err(|_| UpdateError::CheckFailed)?])
        .map_err(|_| UpdateError::CheckFailed)?
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|_| UpdateError::CheckFailed)?
        .check()
        .await
        .map_err(|_| UpdateError::CheckFailed)?;
    if let Some(update) = &mut update {
        update.timeout = Some(Duration::from_secs(600));
    }
    if let Some(update) = &update {
        if !trusted_release_url(&update.download_url) {
            return Err(UpdateError::CheckFailed);
        }
    }
    // Preserve verified bytes if a repeated check announces the same payload.
    let unchanged = pending
        .update
        .as_ref()
        .zip(update.as_ref())
        .is_some_and(|(a, b)| {
            a.version == b.version && a.signature == b.signature && a.download_url == b.download_url
        });
    if !unchanged {
        pending.bytes = None;
    }
    let info = update.as_ref().map(|update| UpdateInfo {
        version: update.version.clone(),
        notes: update.body.clone().unwrap_or_default(),
        downloaded: pending.bytes.is_some(),
    });
    pending.update = update;
    Ok(info)
}

#[tauri::command]
pub async fn update_download(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<(), UpdateError> {
    require_available(&app)?;
    let mut pending = state.inner().0.try_lock().map_err(|_| UpdateError::Busy)?;
    let update = pending.update.as_ref().ok_or(UpdateError::CheckFailed)?;
    // Tauri authenticates the signature before returning these bytes.
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|_| UpdateError::DownloadFailed)?;
    pending.bytes = Some(bytes);
    Ok(())
}

fn backup_then_install(
    backup: impl FnOnce() -> Result<(), UpdateError>,
    install: impl FnOnce() -> Result<(), UpdateError>,
) -> Result<(), UpdateError> {
    backup()?;
    install()
}

#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<(), UpdateError> {
    require_available(&app)?;
    let mut pending = state.inner().0.try_lock().map_err(|_| UpdateError::Busy)?;
    let update = pending.update.clone().ok_or(UpdateError::NotDownloaded)?;
    let bytes = pending.bytes.take().ok_or(UpdateError::NotDownloaded)?;
    let handle = app.clone();
    // Keep the updater lock while blocking work runs. Other checks, downloads,
    // and installs are refused. Never return backup paths or raw source errors.
    let result = tauri::async_runtime::spawn_blocking(move || {
        backup_then_install(
            || {
                backup_service::create(&handle, &handle.state::<AppState>())
                    .map(|_| ())
                    .map_err(|_| UpdateError::BackupFailed)
            },
            || {
                update
                    .install(&bytes)
                    .map_err(|_| UpdateError::InstallFailed)
            },
        )
    })
    .await
    .map_err(|_| UpdateError::InstallFailed)?;
    // On failure require another verified download before retrying.
    result?;
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn manifest_cannot_redirect_downloads_to_other_repositories_or_insecure_urls() {
        assert!(trusted_release_url(
            &format!("https://github.com{RELEASE_PATH}v0.2.0/package.exe")
                .parse()
                .unwrap()
        ));
        for url in [
            "http://github.com/Mahmoud-s-Khedr/legal-masr/releases/download/v0.2.0/package.exe",
            "https://example.com/Mahmoud-s-Khedr/legal-masr/releases/download/v0.2.0/package.exe",
            "https://github.com/other/repository/releases/download/v0.2.0/package.exe",
            "https://github.com/Mahmoud-s-Khedr/legal-masr/releases/download/../../other/package.exe",
            "https://user:password@github.com/Mahmoud-s-Khedr/legal-masr/releases/download/v0.2.0/package.exe",
        ] {
            assert!(!trusted_release_url(&url.parse().unwrap()));
        }
    }

    #[test]
    fn only_supported_installations_can_update() {
        assert!(supported_delivery("windows", false, true));
        assert!(!supported_delivery("windows", false, false));
        assert!(supported_delivery("linux", true, false));
        assert!(!supported_delivery("linux", false, false));
        assert!(supported_delivery("macos", false, false));
        assert!(!supported_delivery("android", false, false));
    }

    #[test]
    fn installation_requires_installer_marker() {
        let root = tempfile::tempdir().unwrap();
        let exe = root.path().join("legalmaster-solo.exe");
        assert!(!installed_windows(None));
        assert!(!installed_windows(Some(&exe)));
        std::fs::write(root.path().join(".legal-masr-installed"), b"installed").unwrap();
        assert!(installed_windows(Some(&exe)));
    }

    #[test]
    fn failed_backup_never_installs() {
        let installed = Cell::new(false);
        let result = backup_then_install(
            || Err(UpdateError::BackupFailed),
            || {
                installed.set(true);
                Ok(())
            },
        );
        assert_eq!(result, Err(UpdateError::BackupFailed));
        assert!(!installed.get());
    }

    #[test]
    fn successful_backup_precedes_installation_and_install_errors_propagate() {
        let backed_up = Cell::new(false);
        let result = backup_then_install(
            || {
                backed_up.set(true);
                Ok(())
            },
            || {
                assert!(backed_up.get());
                Err(UpdateError::InstallFailed)
            },
        );
        assert_eq!(result, Err(UpdateError::InstallFailed));
        assert!(backup_then_install(|| Ok(()), || Ok(())).is_ok());
    }
}
