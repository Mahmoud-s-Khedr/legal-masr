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
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        os = std::env::consts::OS,
        "application starting"
    );
    guard
}
