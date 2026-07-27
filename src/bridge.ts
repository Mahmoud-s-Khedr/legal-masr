import { invoke } from "@tauri-apps/api/core";

export type AppStatus = { initialized: boolean; unlocked: boolean };
export type InitializeResult = { recoveryKey: string };
export type AppError = { code: string; message: string; details: null };

export const bridge = {
  status: () => invoke<AppStatus>("app_get_status"),
  initialize: (password: string) => invoke<InitializeResult>("app_initialize", { password }),
  unlock: (password: string) => invoke<void>("app_unlock", { password }),
  recover: (recoveryKey: string, newPassword: string) => invoke<void>("app_recover_access", { recoveryKey, newPassword }),
  lock: () => invoke<void>("app_lock")
};
