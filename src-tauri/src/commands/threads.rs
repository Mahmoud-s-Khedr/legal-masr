//! Native dialogs are created on the main thread, which is also where every synchronous
//! command runs. A synchronous command that waits for a dialog therefore waits for itself
//! and the window freezes for good. Commands that open a dialog are `async` instead: they
//! wait for the dialog on a worker thread, then hand any vault work back to the main
//! thread so it stays serialized with every other command, exactly as before.
use crate::errors::Error;
use tauri::{AppHandle, Runtime};

/// Runs blocking work (such as waiting for a native dialog) on a worker thread.
pub async fn on_worker<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, Error> + Send + 'static,
) -> Result<T, Error> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| Error::Operation)?
}

/// Runs vault work on the main thread, serialized with the synchronous commands.
pub async fn on_main_thread<R: Runtime, T: Send + 'static>(
    app: &AppHandle<R>,
    work: impl FnOnce(&AppHandle<R>) -> Result<T, Error> + Send + 'static,
) -> Result<T, Error> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(work(&handle));
    })
    .map_err(|_| Error::Operation)?;
    on_worker(move || receiver.recv().map_err(|_| Error::Operation)?).await
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
