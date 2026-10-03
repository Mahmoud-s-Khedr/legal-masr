import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { logCommandFailure } from './devDiagnostics';
import { captureInvoke, captureModeEnabled } from '../dev/captureBridge';

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (captureModeEnabled()) return captureInvoke<T>(command);
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    logCommandFailure(command, error);
    throw error;
  }
}
