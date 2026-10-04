// Desktop Tauri does not expose a supported OS sleep/resume callback. A
// substantial wall-clock gap therefore acts as a conservative resume signal:
// sleeping or a heavily suspended WebView locks before legal records render.
export const LIFECYCLE_LOCK_GAP_MS = 5_000;

export const shouldLockForLifecycleGap = (lastCheckAt: number, currentTime: number) =>
  currentTime - lastCheckAt >= LIFECYCLE_LOCK_GAP_MS;
