//! Manual, local diagnostics. No raw settings, filenames or log bytes enter the ZIP.
use crate::{
    db, dto::SettingsDto, errors::Error, logging, repositories::settings_repository,
    state::AppState, vault_operation,
};
use std::{
    fs,
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Runtime};
use zip::{write::SimpleFileOptions, ZipWriter};

const README: &str = "\u{feff}حزمة دعم ليجال مصر / Legal Masr support bundle\r\n\r\n\
المحتويات فقط: إصدار التطبيق، عائلة وإصدار نظام التشغيل الرقمي، معمارية الجهاز، لغة الواجهة والمظهر (القيم المعروفة فقط)، إصدار مخطط قاعدة البيانات، رموز الأخطاء الحديثة وتوقيتها، والسجلات المحلية بعد التنقيح بقائمة سماح.\r\n\
Contains only: application version, OS family and numeric version, architecture, interface language and theme (known values only), database schema/migration version, recent stable error codes with timestamps, and allow-listed redacted local logs.\r\n\r\n\
لا تحتوي على قاعدة البيانات أو المستندات أو النسخ الاحتياطية أو المفاتيح أو كلمات المرور أو مفاتيح الاسترداد أو المسارات أو أسماء المستخدمين أو الأسماء أو تفاصيل المكتب أو البريد الإلكتروني أو أرقام الهواتف أو الأرقام القومية أو محتوى السجلات القانونية. تُحذف أسطر السجل غير المعروفة.\r\n\
Never contains the database, documents, backups, keys, passwords, recovery keys, file paths, usernames, names, office details, emails, phone numbers, national IDs or legal record content. Unrecognized log lines are dropped.\r\n\r\n\
لا يرسل التطبيق هذه الحزمة. أنت تختار كيف تشاركها. قد لا تظهر أحدث الأخطاء حتى تُكتب في السجل المحلي.\r\n\
The app never sends this bundle. You decide how to share it. The latest errors may not appear until the local logger flushes.\r\n\
logs/*.log: up to 14 recent files, 1 MiB each; recent-codes.log: last 200 recognized errors. Linux version means kernel version; unavailable OS versions are null.\r\n\
السجلات: حتى ١٤ ملفًا حديثًا، بحد أقصى ١ ميجابايت لكل ملف؛ ملف الرموز: آخر ٢٠٠ خطأ معروف. إصدار لينكس هو إصدار النواة؛ الإصدار غير المتاح قيمته null.\r\n";
const MAX_LOG_BYTES: u64 = 1024 * 1024;
const MAX_LOG_FILES: usize = 14;

pub fn pick_destination<R: Runtime>(
    app: &AppHandle<R>,
    filter_label: &str,
) -> Result<PathBuf, Error> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_file_name("legal-masr-support.zip")
        .add_filter(filter_label, &["zip"])
        .blocking_save_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

pub fn create<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    generation: u64,
    destination: &Path,
) -> Result<(), Error> {
    state.check_generation(generation)?;
    let master = state.unlocked()?;
    let root = db::app_dir(app)?;
    if vault_operation::pending(&root) {
        return Err(Error::VaultInterrupted);
    }
    let (_, database) = db::paths(app)?;
    let connection = db::open_db(&database, &master)?;
    let settings = settings_repository::get_settings(&connection)?;
    let bytes = build(
        &root,
        &settings,
        db::schema_version(&connection),
        os_version(),
    )?;
    state.check_generation(generation)?;
    state.unlocked()?;
    save(&root, destination, &bytes)
}

fn build(
    root: &Path,
    settings: &SettingsDto,
    schema: i64,
    os_version: Option<String>,
) -> Result<Vec<u8>, Error> {
    let metadata = serde_json::json!({
        "applicationVersion": env!("CARGO_PKG_VERSION"),
        "osFamily": std::env::consts::OS,
        "osVersion": os_version,
        "architecture": std::env::consts::ARCH,
        "schemaMigrationVersion": schema,
        "settings": {
            "language": match settings.language.as_str() { "ar" => Some("ar"), "en" => Some("en"), _ => None },
            "theme": match settings.theme.as_str() { "system" => Some("system"), "light" => Some("light"), "dark" => Some("dark"), _ => None },
        }
    });
    let mut zip = ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o600);
    zip.start_file("README.txt", options)?;
    zip.write_all(README.as_bytes())?;
    zip.start_file("system.json", options)?;
    zip.write_all(&serde_json::to_vec_pretty(&metadata)?)?;
    let logs = root.join("logs");
    let mut files = Vec::new();
    match fs::symlink_metadata(&logs) {
        Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => {
            for entry in fs::read_dir(&logs)? {
                let entry = entry?;
                let name = entry.file_name();
                if logging::is_log_filename(&name.to_string_lossy()) {
                    let meta = fs::symlink_metadata(entry.path())?;
                    if meta.is_file() && !meta.file_type().is_symlink() {
                        files.push(entry.path());
                    }
                }
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
        Ok(_) => return Err(Error::Operation),
        Err(e) => return Err(e.into()),
    }
    files.sort();
    let mut recent = std::collections::VecDeque::new();
    for (index, file) in files.iter().rev().take(MAX_LOG_FILES).rev().enumerate() {
        // Bounded reads, including malformed files and a concurrently running logger.
        let mut source = fs::File::open(file)?;
        let offset = source.metadata()?.len().saturating_sub(MAX_LOG_BYTES);
        source.seek(SeekFrom::Start(offset))?;
        let mut bytes = Vec::new();
        source.take(MAX_LOG_BYTES).read_to_end(&mut bytes)?;
        if offset > 0 {
            // A tail read starts inside an unknown line. Drop that first fragment.
            let start = bytes
                .iter()
                .position(|byte| *byte == b'\n')
                .map_or(bytes.len(), |p| p + 1);
            bytes.drain(..start);
        }
        // A concurrently written final event must be complete before acceptance.
        bytes.truncate(
            bytes
                .iter()
                .rposition(|byte| *byte == b'\n')
                .map_or(0, |p| p + 1),
        );
        let mut redacted = String::new();
        for line in String::from_utf8_lossy(&bytes).lines() {
            if let Some(safe) = logging::redact_line(line) {
                redacted.push_str(&safe);
                redacted.push('\n');
                if safe.contains(" error_code=") {
                    if recent.len() == 200 {
                        recent.pop_front();
                    }
                    recent.push_back(safe);
                }
            }
        }
        // Original log filenames are never copied, even if they contain user input.
        zip.start_file(format!("logs/{:02}.log", index + 1), options)?;
        zip.write_all(redacted.as_bytes())?;
    }
    zip.start_file("recent-codes.log", options)?;
    for line in recent {
        writeln!(zip, "{line}")?;
    }
    Ok(zip.finish()?.into_inner())
}

fn save(root: &Path, destination: &Path, bytes: &[u8]) -> Result<(), Error> {
    save_with(root, destination, bytes, |output, bytes| {
        output.write_all(bytes)
    })
}

fn save_with(
    root: &Path,
    destination: &Path,
    bytes: &[u8],
    write: impl FnOnce(&mut fs::File, &[u8]) -> std::io::Result<()>,
) -> Result<(), Error> {
    let destination = if destination
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"))
    {
        destination.to_path_buf()
    } else {
        destination.with_extension("zip")
    };
    let parent = destination
        .parent()
        .ok_or(Error::Validation)?
        .canonicalize()?;
    // Never overwrite vault files, follow an existing symlink, or silently replace an
    // existing bundle (Windows and Linux behave identically). Choose a fresh filename.
    if parent.starts_with(root.canonicalize()?) {
        return Err(Error::Validation);
    }
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&destination)?;
    let result = (|| -> Result<(), Error> {
        write(&mut output, bytes)?;
        output.sync_all()?;
        Ok(())
    })();
    drop(output);
    if result.is_err() {
        let _ = fs::remove_file(&destination);
    }
    result
}

// Read only the numeric kernel release; never include distro labels, hostname,
// environment variables, usernames or shell output. No subprocess is used.
#[cfg(target_os = "linux")]
fn os_version() -> Option<String> {
    numeric_version(&fs::read_to_string("/proc/sys/kernel/osrelease").ok()?)
}
#[cfg(any(target_os = "linux", target_os = "windows", test))]
fn numeric_version(value: &str) -> Option<String> {
    let core: String = value
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    let parts: Vec<_> = core.split('.').take(3).collect();
    if parts.len() != 3
        || parts
            .iter()
            .any(|p| p.is_empty() || p.len() > 5 || !p.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    Some(parts.join("."))
}
#[cfg(target_os = "windows")]
fn os_version() -> Option<String> {
    #[repr(C)]
    struct Version {
        size: u32,
        major: u32,
        minor: u32,
        build: u32,
        platform: u32,
        service_pack: [u16; 128],
    }
    #[link(name = "ntdll")]
    unsafe extern "system" {
        fn RtlGetVersion(version: *mut Version) -> i32;
    }
    let mut version = Version {
        size: std::mem::size_of::<Version>() as u32,
        major: 0,
        minor: 0,
        build: 0,
        platform: 0,
        service_pack: [0; 128],
    };
    // SAFETY: RtlGetVersion receives an initialized, correctly sized OSVERSIONINFOW.
    if unsafe { RtlGetVersion(&mut version) } != 0 {
        return None;
    }
    numeric_version(&format!(
        "{}.{}.{}",
        version.major, version.minor, version.build
    ))
}
#[cfg(not(any(target_os = "linux", target_os = "windows")))]
fn os_version() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    fn settings() -> SettingsDto {
        SettingsDto {
            language: "ar".into(),
            theme: "dark".into(),
            date_format: "dd/MM/yyyy".into(),
            week_starts_on: 6,
            usage_counters_enabled: false,
            lock_timeout_minutes: 30,
            keep_running_in_tray: false,
        }
    }
    fn contents(bytes: Vec<u8>) -> std::collections::BTreeMap<String, String> {
        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
        (0..archive.len())
            .map(|i| {
                let mut file = archive.by_index(i).unwrap();
                let name = file.name().unwrap().into_owned();
                let mut text = String::new();
                file.read_to_string(&mut text).unwrap();
                (name, text)
            })
            .collect()
    }
    const SAFE: &str = "2026-10-21T12:34:56.123Z ERROR legalmaster_lib::logging: command failed error_code=\"VALIDATION_FAILED\"\n";
    #[test]
    fn bundle_has_only_expected_files_safe_settings_and_redacted_logs() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("logs")).unwrap();
        let sensitive = [
            "Client Secret Name",
            "أحمد محمد السري",
            "/home/secret-lawyer/private.pdf",
            "C:\\Users\\SecretLawyer\\private.pdf",
            "secret@example.test",
            "01012345678",
            "29001011234567",
            "password=Sup3rSecretToken!",
            "٠١٠١٢٣٤٥٦٧٨",
            "٢٩٠٠١٠١١٢٣٤٥٦٧",
        ];
        let mut log = SAFE.to_string();
        log.push_str("2026-10-21T12:34:56Z  INFO legalmaster_lib::logging: application starting version=\"0.1.0\" os=\"linux\"\n");
        for secret in sensitive {
            log.push_str(&format!("{secret}\n{SAFE}{SAFE}"));
            log.push_str(&format!("2026-10-21T12:34:56Z ERROR legalmaster_lib::logging: command failed error_code=\"{secret}\"\n"));
            log.push_str(&format!("{} secret=\"{secret}\"\n", SAFE.trim_end()));
        }
        fs::write(root.path().join("logs/legalmaster.log.2026-10-21"), log).unwrap();
        fs::write(root.path().join("logs/private.log"), sensitive.join("\n")).unwrap();
        for name in [
            "legalmaster.sqlite",
            "security.json",
            "document.pdf",
            "backup.lmsbackup",
        ] {
            fs::write(root.path().join(name), sensitive.join("\n")).unwrap();
        }
        let archive = contents(build(root.path(), &settings(), 5, Some("6.8.0".into())).unwrap());
        assert_eq!(
            archive.keys().map(String::as_str).collect::<Vec<_>>(),
            vec![
                "README.txt",
                "logs/01.log",
                "recent-codes.log",
                "system.json"
            ]
        );
        let metadata: serde_json::Value = serde_json::from_str(&archive["system.json"]).unwrap();
        assert_eq!(metadata["schemaMigrationVersion"], 5);
        assert_eq!(metadata["osVersion"], "6.8.0");
        assert_eq!(
            metadata["settings"],
            serde_json::json!({"language":"ar", "theme":"dark"})
        );
        assert!(archive["logs/01.log"].contains("application starting"));
        assert!(archive["recent-codes.log"]
            .contains("2026-10-21T12:34:56Z ERROR command failed error_code=VALIDATION_FAILED"));
        assert!(archive["README.txt"].contains("The app never sends"));
        assert!(archive["README.txt"].contains("لا يرسل التطبيق"));
        for secret in sensitive {
            let mut malicious = settings();
            malicious.language = secret.into();
            malicious.theme = secret.into();
            malicious.date_format = secret.into();
            let files = contents(build(root.path(), &malicious, 5, None).unwrap());
            for text in files.values() {
                assert!(!text.contains(secret), "leaked {secret}");
            }
            let metadata: serde_json::Value = serde_json::from_str(&files["system.json"]).unwrap();
            assert!(metadata["settings"]["language"].is_null());
            assert!(metadata["settings"]["theme"].is_null());
        }
    }
    #[test]
    fn missing_logs_are_allowed_but_unreadable_or_unsafe_logs_fail_cleanly() {
        let root = tempfile::tempdir().unwrap();
        let archive = contents(build(root.path(), &settings(), 5, None).unwrap());
        assert_eq!(archive.len(), 3);
        assert!(archive["recent-codes.log"].is_empty());
        fs::write(root.path().join("logs"), b"not a directory").unwrap();
        assert_eq!(
            build(root.path(), &settings(), 5, None).unwrap_err().code(),
            "OPERATION_FAILED"
        );
    }
    #[cfg(unix)]
    #[test]
    fn skips_symlinked_logs_and_refuses_symlinked_log_directories() {
        let root = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("logs")).unwrap();
        fs::write(other.path().join("private"), SAFE).unwrap();
        std::os::unix::fs::symlink(
            other.path().join("private"),
            root.path().join("logs/legalmaster.log"),
        )
        .unwrap();
        assert_eq!(
            contents(build(root.path(), &settings(), 5, None).unwrap()).len(),
            3
        );
        fs::remove_file(root.path().join("logs/legalmaster.log")).unwrap();
        fs::remove_dir(root.path().join("logs")).unwrap();
        std::os::unix::fs::symlink(other.path(), root.path().join("logs")).unwrap();
        assert!(build(root.path(), &settings(), 5, None).is_err());
    }
    #[test]
    fn bounds_log_files_bytes_and_recent_codes() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("logs")).unwrap();
        for day in 1..=16 {
            fs::write(
                root.path()
                    .join(format!("logs/legalmaster.log.2026-10-{day:02}")),
                SAFE.repeat(250),
            )
            .unwrap();
        }
        let archive = contents(build(root.path(), &settings(), 5, None).unwrap());
        assert_eq!(archive.len(), MAX_LOG_FILES + 3);
        assert_eq!(archive["recent-codes.log"].lines().count(), 200);
        // Keep the most recent complete event even when the day's file is huge;
        // the leading partial line and incomplete trailing event are discarded.
        let mut huge = vec![b'x'; MAX_LOG_BYTES as usize];
        huge.push(b'\n');
        huge.extend_from_slice(SAFE.as_bytes());
        huge.extend_from_slice(SAFE.trim_end().as_bytes());
        fs::write(root.path().join("logs/legalmaster.log.2026-10-17"), huge).unwrap();
        let archive = contents(build(root.path(), &settings(), 5, None).unwrap());
        assert_eq!(archive["logs/14.log"].lines().count(), 1);
        assert!(archive["logs/14.log"].contains("VALIDATION_FAILED"));
    }
    #[test]
    fn saves_zip_and_reports_write_failures_without_overwriting_any_existing_file() {
        let root = tempfile::tempdir().unwrap();
        let output = tempfile::tempdir().unwrap();
        let bytes = build(root.path(), &settings(), 5, None).unwrap();
        let path = output.path().join("support");
        save(root.path(), &path, &bytes).unwrap();
        assert_eq!(
            contents(fs::read(path.with_extension("zip")).unwrap()).len(),
            3
        );
        for dest in [
            output.path().join("missing/bundle.zip"),
            output.path().join("folder.zip"),
            path.with_extension("zip"),
            root.path().join("vault.zip"),
        ] {
            if dest.ends_with("folder.zip") {
                fs::create_dir(&dest).unwrap();
            }
            let error = save(root.path(), &dest, &bytes).unwrap_err();
            assert!(matches!(
                error.code(),
                "OPERATION_FAILED" | "VALIDATION_FAILED"
            ));
            let serialized = serde_json::to_string(&error).unwrap();
            assert!(!serialized.contains(&dest.to_string_lossy().to_string()));
        }
        assert_eq!(fs::read(path.with_extension("zip")).unwrap(), bytes);
    }
    #[test]
    fn removes_partial_bundle_when_a_write_fails_and_withholds_the_source_error() {
        let root = tempfile::tempdir().unwrap();
        let output = tempfile::tempdir().unwrap();
        let path = output.path().join("support.zip");
        let error = save_with(root.path(), &path, b"test", |file, bytes| {
            file.write_all(&bytes[..2])?;
            Err(std::io::Error::other(
                "disk full /home/private secret@example.test",
            ))
        })
        .unwrap_err();
        assert_eq!(error.code(), "OPERATION_FAILED");
        assert!(!path.exists());
        let serialized = serde_json::to_string(&error).unwrap();
        assert!(!serialized.contains("/home/private"));
        assert!(!serialized.contains("secret@example.test"));
    }
    #[test]
    fn includes_only_known_language_and_theme_choices() {
        let root = tempfile::tempdir().unwrap();
        for language in ["ar", "en"] {
            for theme in ["system", "light", "dark"] {
                let mut settings = settings();
                settings.language = language.into();
                settings.theme = theme.into();
                let files = contents(build(root.path(), &settings, 5, None).unwrap());
                let metadata: serde_json::Value =
                    serde_json::from_str(&files["system.json"]).unwrap();
                assert_eq!(
                    metadata["settings"],
                    serde_json::json!({"language":language,"theme":theme})
                );
            }
        }
    }
    #[cfg(unix)]
    #[test]
    fn refuses_destination_symlinks_and_directory_aliases_into_the_vault() {
        let root = tempfile::tempdir().unwrap();
        let output = tempfile::tempdir().unwrap();
        let target = root.path().join("private");
        fs::write(&target, b"keep").unwrap();
        let path = output.path().join("support.zip");
        std::os::unix::fs::symlink(&target, &path).unwrap();
        assert!(save(root.path(), &path, b"bundle").is_err());
        assert_eq!(fs::read(&target).unwrap(), b"keep");
        std::os::unix::fs::symlink(root.path(), output.path().join("alias")).unwrap();
        assert!(matches!(
            save(
                root.path(),
                &output.path().join("alias/support.zip"),
                b"bundle"
            ),
            Err(Error::Validation)
        ));
        assert!(!root.path().join("support.zip").exists());
    }
    #[test]
    fn rejects_locked_and_stale_sessions_before_accessing_the_vault() {
        let app = tauri::test::mock_app();
        let state = AppState::default();
        assert_eq!(
            create(
                app.handle(),
                &state,
                state.generation(),
                Path::new("unused.zip")
            )
            .unwrap_err()
            .code(),
            "APP_LOCKED"
        );
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        let generation = state.generation();
        state.advance_generation();
        assert_eq!(
            create(app.handle(), &state, generation, Path::new("unused.zip"))
                .unwrap_err()
                .code(),
            "APP_LOCKED"
        );
    }
    #[test]
    fn os_release_uses_only_three_numeric_components() {
        assert_eq!(
            numeric_version("6.8.0-secret@example.test"),
            Some("6.8.0".into())
        );
        assert_eq!(numeric_version("10.0.26100"), Some("10.0.26100".into()));
        for bad in ["lawyer", "6..0", "6.8", "1234567.0.0", "٠١٠١٢٣٤٥٦٧٨"] {
            assert_eq!(numeric_version(bad), None);
        }
    }
}
