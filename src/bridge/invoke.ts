import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { logCommandFailure } from './devDiagnostics';

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    logCommandFailure(command, error);
    throw error;
  }
}
