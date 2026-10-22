use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime},
};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling;
use tracing_subscriber::EnvFilter;

const LOG_RETENTION: Duration = Duration::from_secs(14 * 24 * 60 * 60);

fn prune_old_logs(log_dir: &Path) {
    let Ok(entries) = fs::read_dir(log_dir) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with("legalmaster.log") {
            continue;
        }
        let expired = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age > LOG_RETENTION);
        if expired {
            let _ = fs::remove_file(entry.path());
        }
    }
}

pub fn init(app_data_dir: &Path) -> WorkerGuard {
    let log_dir = app_data_dir.join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
    prune_old_logs(&log_dir);
    let file_appender = rolling::daily(log_dir, "legalmaster.log");
    let (writer, guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .with_writer(writer)
        .with_ansi(false)
        .with_env_filter(EnvFilter::new("info"))
        .init();
    application_starting();
    guard
}

fn application_starting() {
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        os = std::env::consts::OS,
        "application starting"
    );
}

/// All builds record stable codes only. Diagnostics displayed in developer mode
/// never reach the local log (even schema identifiers can contain personal data).
pub(crate) fn command_failed(code: &'static str) {
    tracing::error!(error_code = code, "command failed");
}

pub(crate) fn is_log_filename(name: &str) -> bool {
    name == "legalmaster.log"
        || name
            .strip_prefix("legalmaster.log.")
            .is_some_and(valid_date)
}

fn valid_date(date: &str) -> bool {
    if !date.is_ascii()
        || date.len() != 10
        || date.as_bytes()[4] != b'-'
        || date.as_bytes()[7] != b'-'
    {
        return false;
    }
    let number = |part: &str| {
        part.bytes()
            .all(|b| b.is_ascii_digit())
            .then(|| part.parse::<u16>().ok())
            .flatten()
    };
    let (Some(year), Some(month), Some(day)) =
        (number(&date[..4]), number(&date[5..7]), number(&date[8..]))
    else {
        return false;
    };
    (2000..=2099).contains(&year)
        && time::Month::try_from(month as u8)
            .ok()
            .and_then(|month| time::Date::from_calendar_date(year as i32, month, day as u8).ok())
            .is_some()
}

// Defense in depth: reject rather than mask suspected paths/contact data. This
// operates only on fields, not the validated timestamp. Enum matching below is
// the primary boundary, so names, credentials and unexpected fields also drop.
fn suspicious(value: &str) -> bool {
    if !value.is_ascii() || value.contains(['@', '/', '\\', '~', '+']) {
        return true;
    }
    let mut digits = 0;
    for byte in value.bytes() {
        if byte.is_ascii_digit() {
            digits += 1;
        } else if !matches!(byte, b' ' | b'-' | b'(' | b')') {
            digits = 0;
        }
        if digits >= 7 {
            return true;
        }
    }
    false
}

/// Accept exactly the two structures this module produces. No substring matching,
/// dynamic field names, diagnostic text, span context or raw trailing text passes.
/// Reconstruct each line from validated fields; fractional timestamps are omitted.
pub(crate) fn redact_line(line: &str) -> Option<String> {
    if !line.is_ascii() || line.len() > 512 {
        return None;
    }
    let (timestamp, rest) = line.split_once(' ')?;
    if timestamp.len() < 20 || !timestamp.ends_with('Z') {
        return None;
    }
    let base = &timestamp[..19];
    if !valid_date(&base[..10]) || base.as_bytes()[10] != b'T' {
        return None;
    }
    let clock = &base[11..];
    if clock.len() != 8 || clock.as_bytes()[2] != b':' || clock.as_bytes()[5] != b':' {
        return None;
    }
    for (index, part) in clock.split(':').enumerate() {
        if !part.bytes().all(|b| b.is_ascii_digit())
            || part.parse::<u8>().ok()? > if index == 0 { 23 } else { 59 }
        {
            return None;
        }
    }
    let fraction = &timestamp[19..timestamp.len() - 1];
    if !fraction.is_empty()
        && (fraction.len() < 2
            || fraction.len() > 10
            || !fraction.starts_with('.')
            || !fraction[1..].bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    let rest = rest.trim_start_matches(' ');
    if let Some(fields) = rest.strip_prefix("INFO legalmaster_lib::logging: application starting ")
    {
        if suspicious(fields) {
            return None;
        }
        let (version, os) = fields.strip_prefix("version=\"")?.split_once("\" os=\"")?;
        let os = os.strip_suffix('"')?;
        // Only this executable's compiled version and known OS constants survive.
        if version != env!("CARGO_PKG_VERSION") || !matches!(os, "linux" | "windows" | "macos") {
            return None;
        }
        return Some(format!(
            "{base}Z INFO application starting version={version} os={os}"
        ));
    }
    let fields =
        rest.strip_prefix("ERROR legalmaster_lib::logging: command failed error_code=\"")?;
    let code = fields.strip_suffix('"')?;
    if suspicious(code) || !SAFE_ERROR_CODES.contains(&code) {
        return None;
    }
    Some(format!("{base}Z ERROR command failed error_code={code}"))
}

const SAFE_ERROR_CODES: &[&str] = &[
    "DELETION_NOT_ARCHIVED",
    "DELETION_SHARED_INTEGRITY",
    "DELETION_PREVIEW_EXPIRED",
    "OPERATION_BUSY",
    "INVALID_PASSWORD",
    "APP_LOCKED",
    "ALREADY_INITIALIZED",
    "RECOVERY_KEY_INVALID",
    "BACKUP_CORRUPTED",
    "BACKUP_KEY_MISMATCH",
    "BACKUP_NEWER_VERSION",
    "LEGACY_DATA_MIGRATION_REQUIRED",
    "VAULT_INTERRUPTED",
    "VAULT_MISSING",
    "VAULT_INCOMPLETE",
    "VAULT_CORRUPT",
    "VAULT_NEWER_SCHEMA",
    "VALIDATION_FAILED",
    "CLIENT_NOT_FOUND",
    "CASE_NOT_FOUND",
    "POWER_OF_ATTORNEY_NOT_FOUND",
    "CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY",
    "LINK_CASE_OR_CLIENT",
    "HEARING_NOT_FOUND",
    "CLIENT_PROBABLE_DUPLICATE",
    "CLIENT_NUMBER_TAKEN",
    "CASE_NUMBER_TAKEN",
    "POWER_OF_ATTORNEY_NUMBER_TAKEN",
    "CASE_MUST_HAVE_CLIENT",
    "CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED",
    "CASE_CLIENT_HAS_PAYMENTS",
    "CLIENT_ARCHIVED",
    "CASE_ARCHIVED",
    "BACKUP_MISSING",
    "TASK_NOT_FOUND",
    "ATTACHMENT_SOURCE_MISSING",
    "ATTACHMENT_NOT_FOUND",
    "PAYMENT_NOT_FOUND",
    "EXPENSE_NOT_FOUND",
    "EXPENSE_HAS_ATTACHMENTS",
    "OPERATION_FAILED",
    "OPERATION_CANCELLED",
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    #[derive(Clone, Default)]
    struct Buffer(Arc<Mutex<Vec<u8>>>);
    impl std::io::Write for Buffer {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    #[test]
    fn accepts_the_actual_formatter_and_release_error_serialization() {
        let buffer = Buffer::default();
        let writer = buffer.clone();
        let subscriber = tracing_subscriber::fmt()
            .with_ansi(false)
            .with_writer(move || writer.clone())
            .finish();
        tracing::subscriber::with_default(subscriber, || {
            application_starting();
            serde_json::to_string(&crate::errors::Error::Operation).unwrap();
        });
        let text = String::from_utf8(buffer.0.lock().unwrap().clone()).unwrap();
        let lines: Vec<_> = text.lines().collect();
        assert_eq!(lines.len(), 2, "{text}");
        assert!(redact_line(lines[0])
            .unwrap()
            .contains("application starting"));
        assert!(redact_line(lines[1])
            .unwrap()
            .contains("error_code=OPERATION_FAILED"));
    }
    #[test]
    fn drops_malformed_timestamps_unknown_targets_fields_codes_and_sensitive_shapes() {
        let valid = "2026-10-21T12:34:56.123456789Z ERROR legalmaster_lib::logging: command failed error_code=\"OPERATION_FAILED\"";
        assert_eq!(
            redact_line(valid).unwrap(),
            "2026-10-21T12:34:56Z ERROR command failed error_code=OPERATION_FAILED"
        );
        for bad in [
            valid.replace("OPERATION_FAILED", "SECRET_PASSWORD"),
            valid.replace("logging:", "other:"),
            valid.replace("2026-10-21", "2026-02-30"),
            valid.replace("12:34:56", "29:34:56"),
            format!("{valid} client=private"),
            valid.replace("OPERATION_FAILED", "/home/lawyer/private"),
            valid.replace("OPERATION_FAILED", "01012345678"),
            valid.replace("OPERATION_FAILED", "lawyer@example.test"),
        ] {
            assert!(redact_line(&bad).is_none(), "{bad}");
        }
        for value in [
            "/home/lawyer",
            "C:\\Users\\Lawyer",
            "test@example.test",
            "010 1234 5678",
            "٢٩٠٠١٠١١٢٣٤٥٦٧",
            "29001011234567",
        ] {
            assert!(suspicious(value));
        }
        assert!(is_log_filename("legalmaster.log.2026-10-21"));
        for name in [
            "legalmaster.log.password",
            "legalmaster.log.2026-02-30",
            "legalmaster.log.2026-10-21@example.test",
        ] {
            assert!(!is_log_filename(name));
        }
    }
}
