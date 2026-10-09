import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { logCommandFailure } from './devDiagnostics';
import { captureInvoke, captureModeEnabled } from '../dev/captureBridge';

let sessionEpoch = 0;
const boundaries = new Set([
  'app_initialize',
  'app_unlock',
  'app_lock',
  'app_recover_access',
  'app_change_password',
  'app_replace_recovery_key',
  'backup_commit_restore',
]);

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (boundaries.has(command)) sessionEpoch += 1;
  const generation = sessionEpoch;
  try {
    const result = captureModeEnabled()
      ? await captureInvoke<T>(command)
      : await tauriInvoke<T>(command, args);
    if (generation !== sessionEpoch)
      throw { code: 'APP_LOCKED', message: 'Session changed.', details: null };
    return result;
  } catch (error) {
    logCommandFailure(command, error);
    throw error;
  }
}
