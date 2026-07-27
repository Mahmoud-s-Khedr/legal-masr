use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling;
use tracing_subscriber::EnvFilter;

pub fn init(app_data_dir: &Path) -> WorkerGuard {
    let log_dir = app_data_dir.join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
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
