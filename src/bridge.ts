import { invoke } from "@tauri-apps/api/core";

export type AppStatus = { initialized: boolean; unlocked: boolean; onboardingCompleted: boolean };
export type AppError = { code: string; message: string; details: null };
export type Settings = { language: "ar" | "en"; theme: "system" | "light" | "dark"; lockTimeoutMinutes: number; managedDocumentsDirectory: string | null; backupDirectory: string | null; onboardingCompleted: boolean };
export type InitializeInput = { password: string; fullName: string; language: "ar" | "en"; managedDocumentsDirectory: string; backupDirectory: string; lockTimeoutMinutes: number };

export const bridge = {
  status: () => invoke<AppStatus>("app_get_status"),
  initialize: (input: InitializeInput) => invoke<{ recoveryKey: string }>("app_initialize", { input }),
  unlock: (password: string) => invoke<void>("app_unlock", { password }),
  recover: (recoveryKey: string, newPassword: string) => invoke<void>("app_recover_access", { recoveryKey, newPassword }),
  lock: () => invoke<void>("app_lock"),
  createBackup: (destination: string) => invoke<string>("backup_create", { destination }),
  completeOnboarding: () => invoke<void>("onboarding_complete"),
  settings: () => invoke<Settings>("settings_get"),
  updateSettings: (settings: Pick<Settings, "language" | "theme" | "lockTimeoutMinutes">) => invoke<Settings>("settings_update", settings),
};
