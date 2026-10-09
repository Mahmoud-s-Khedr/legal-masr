//! Blocking dialogs and archive work run off the event loop. Vault commands share
//! AppState’s operation gate and recheck session generation after native dialogs.
use crate::errors::Error;

/// Runs blocking work (such as waiting for a native dialog) on a worker thread.
pub async fn on_worker<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, Error> + Send + 'static,
) -> Result<T, Error> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| Error::Operation)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worker_results_and_errors_reach_the_caller() {
        let value = tauri::async_runtime::block_on(on_worker(|| Ok::<_, Error>(7)));
        assert_eq!(value.unwrap(), 7);
        let refused = tauri::async_runtime::block_on(on_worker(|| Err::<(), _>(Error::Cancelled)));
        assert!(matches!(refused, Err(Error::Cancelled)));
    }

    #[test]
    fn worker_does_not_run_on_the_calling_thread() {
        let caller = std::thread::current().id();
        let worker = tauri::async_runtime::block_on(on_worker(move || {
            Ok::<_, Error>(std::thread::current().id())
        }))
        .unwrap();
        assert_ne!(worker, caller);
    }
}
