import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '../../bridge/invoke';

export type UpdateMode = 'manual' | 'notify' | 'download';
export type UpdateInfo = { version: string; notes: string; downloaded: boolean };
export type UpdateStatus = {
  currentVersion: string;
  available: boolean;
  reason: 'not-configured' | 'manual-install' | null;
};
type Phase = 'idle' | 'checking' | 'downloading' | 'installing';
export type UpdateSnapshot = {
  mode: UpdateMode;
  status: UpdateStatus;
  update: UpdateInfo | null;
  phase: Phase;
  message:
    | 'current'
    | 'updated'
    | 'checkFailed'
    | 'downloadFailed'
    | 'backupFailed'
    | 'installFailed'
    | 'preferenceFailed'
    | null;
};
export type UpdateApi = {
  status: () => Promise<UpdateStatus>;
  check: () => Promise<UpdateInfo | null>;
  download: () => Promise<void>;
  install: () => Promise<void>;
};
const MODE_KEY = 'legal-masr.update-mode';
const TARGET_KEY = 'legal-masr.update-target';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export class UpdateController {
  private listeners = new Set<() => void>();
  private initialized: Promise<void> | undefined;
  private lastAutomatic = 0;
  private snapshot: UpdateSnapshot;

  constructor(
    private api: UpdateApi,
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  ) {
    let mode: UpdateMode = 'manual';
    try {
      const saved = storage.getItem(MODE_KEY);
      if (saved === 'notify' || saved === 'download') mode = saved;
    } catch {
      /* Unavailable storage must not block the offline workspace. */
    }
    this.snapshot = {
      mode,
      status: {
        currentVersion: import.meta.env.VITE_APP_VERSION,
        available: false,
        reason: 'not-configured',
      },
      update: null,
      phase: 'idle',
      message: null,
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(patch: Partial<UpdateSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  initialize = () => {
    this.initialized ??= this.api
      .status()
      .then((status) => {
        let updated = false;
        try {
          const target = this.storage.getItem(TARGET_KEY);
          updated = target === status.currentVersion;
          if (target) this.storage.removeItem(TARGET_KEY);
        } catch {
          /* Update success notices are best effort. */
        }
        this.set({ status, message: updated ? 'updated' : null });
      })
      .catch(() => {
        /* Native availability must not block startup. */
      });
    return this.initialized;
  };

  setMode = (mode: UpdateMode) => {
    try {
      this.storage.setItem(MODE_KEY, mode);
      this.lastAutomatic = 0;
      this.set({ mode, message: null });
    } catch {
      this.set({ message: 'preferenceFailed' });
    }
  };

  check = async (automatic = false) => {
    await this.initialize();
    if (!this.snapshot.status.available || this.snapshot.phase !== 'idle') return;
    if (automatic) {
      if (this.snapshot.mode === 'manual' || Date.now() - this.lastAutomatic < CHECK_INTERVAL)
        return;
      this.lastAutomatic = Date.now();
    }
    this.set({ phase: 'checking', message: null });
    try {
      const update = await this.api.check();
      this.set({ update, phase: 'idle', message: update ? null : 'current' });
      // Re-read the preference after the network request: disabling automatic
      // downloads while a check is in flight must prevent that download.
      if (automatic && this.snapshot.mode === 'download' && update && !update.downloaded) {
        await this.download();
      }
    } catch {
      this.set({ phase: 'idle', message: automatic ? null : 'checkFailed' });
    }
  };

  download = async () => {
    if (!this.snapshot.update || this.snapshot.phase !== 'idle') return;
    this.set({ phase: 'downloading', message: null });
    try {
      await this.api.download();
      this.set({ update: { ...this.snapshot.update!, downloaded: true }, phase: 'idle' });
    } catch {
      this.set({ phase: 'idle', message: 'downloadFailed' });
    }
  };

  install = async () => {
    if (!this.snapshot.update?.downloaded || this.snapshot.phase !== 'idle') return;
    this.set({ phase: 'installing', message: null });
    try {
      this.storage.setItem(TARGET_KEY, this.snapshot.update.version);
    } catch {
      /* Best effort. */
    }
    try {
      // Rust creates a fresh, validated encrypted backup before installation.
      await this.api.install();
    } catch (error) {
      try {
        this.storage.removeItem(TARGET_KEY);
      } catch {
        /* Best effort. */
      }
      this.set({
        phase: 'idle',
        update: { ...this.snapshot.update, downloaded: false },
        message: error === 'BACKUP_FAILED' ? 'backupFailed' : 'installFailed',
      });
    }
  };
}

// The browser preview and capture harness never make update network requests.
const api: UpdateApi = {
  status: () =>
    isTauri()
      ? invoke<UpdateStatus>('update_status')
      : Promise.resolve({
          currentVersion: import.meta.env.VITE_APP_VERSION,
          available: false,
          reason: 'not-configured',
        }),
  check: () => invoke<UpdateInfo | null>('update_check'),
  download: () => invoke<void>('update_download'),
  install: () => invoke<void>('update_install'),
};
const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => window.localStorage.getItem(key),
  removeItem: (key) => window.localStorage.removeItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
export const updateController = new UpdateController(api, storage);
