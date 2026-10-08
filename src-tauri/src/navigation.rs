//! Keeps the window on the bundled app. A stray `tel:`, `mailto:` or web link would
//! otherwise navigate the whole WebView away, leaving a blank window with no way back.
//! External destinations go through narrow Rust commands instead.
use tauri::{plugin::TauriPlugin, Runtime, Url};

/// True for the app's own pages on every platform (and the Vite dev server in debug builds).
pub fn is_app_url(url: &Url) -> bool {
    match url.scheme() {
        // macOS and Linux serve the bundle from tauri://localhost.
        "tauri" => url.host_str() == Some("localhost"),
        // Windows serves it from http(s)://tauri.localhost.
        "http" | "https" if url.host_str() == Some("tauri.localhost") => true,
        "http" => {
            cfg!(debug_assertions)
                && url.host_str() == Some("localhost")
                && url.port() == Some(1420)
        }
        _ => false,
    }
}

pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|_, url| is_app_url(url))
        .build()
}

#[cfg(test)]
mod tests {
    use super::is_app_url;
    use tauri::Url;

    fn allowed(url: &str) -> bool {
        is_app_url(&Url::parse(url).unwrap())
    }

    #[test]
    fn the_bundled_app_may_navigate_within_itself() {
        assert!(allowed("tauri://localhost/clients/1"));
        assert!(allowed("http://tauri.localhost/cases/2?tab=hearings"));
        assert!(allowed("https://tauri.localhost/"));
    }

    #[test]
    fn links_that_would_replace_the_window_are_refused() {
        assert!(!allowed("tel:+201000000000"));
        assert!(!allowed("mailto:someone@example.test"));
        assert!(!allowed("https://wa.me/201000000000"));
        assert!(!allowed("https://example.test/"));
        assert!(!allowed("tauri://elsewhere/"));
        assert!(!allowed("file:///etc/passwd"));
        assert!(!allowed("http://localhost:8080/"));
    }
}
