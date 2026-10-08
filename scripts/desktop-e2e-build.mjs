export const WINDOWS_WEBVIEW_DEBUG_PORT = 9222;

// Wry 0.55.1 defaults, including its default-enabled autoplay policy. Supplying
// additionalBrowserArgs replaces these defaults rather than extending them.
const windowsDefaultBrowserArgs =
  '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required';

export function desktopE2eBuildArgs(platform, config) {
  const args = ['tauri', 'build', '--debug', '--no-bundle', '--features', 'desktop-e2e'];
  if (platform !== 'win32') return args;
  const windows = config?.app?.windows;
  if (!Array.isArray(windows) || windows.length !== 1) {
    throw new Error('Desktop harness requires one configured window');
  }
  const window = windows[0];
  const additionalBrowserArgs = `${window.additionalBrowserArgs ?? windowsDefaultBrowserArgs} --remote-debugging-port=${WINDOWS_WEBVIEW_DEBUG_PORT}`;
  // Elevated WebView2 150+ ignores environment-supplied browser arguments. The
  // Tauri config passes this argument through the WebView2 API instead. This
  // override is compiled only into the separate, marked desktop-e2e binary.
  args.push(
    '--config',
    JSON.stringify({ app: { windows: [{ ...window, additionalBrowserArgs }] } }),
  );
  return args;
}
