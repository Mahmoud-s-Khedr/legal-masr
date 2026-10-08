import type { Settings, SettingsUpdateInput } from '../bridge/types';

/**
 * A language picked on the lock screen cannot be saved until the vault opens. It is kept
 * here (in memory only) and saved right after unlocking, instead of being overridden by
 * the stored setting.
 */
let pending: Settings['language'] | null = null;

export const rememberLanguageChoice = (language: Settings['language']) => {
  pending = language;
};

export const takeLanguageChoice = () => {
  const choice = pending;
  pending = null;
  return choice;
};

export const settingsWithLanguage = (
  settings: Settings,
  language: Settings['language'],
): SettingsUpdateInput => ({
  language,
  theme: settings.theme,
  dateFormat: settings.dateFormat,
  weekStartsOn: settings.weekStartsOn,
  defaultReminderMinutes: settings.defaultReminderMinutes,
  lockTimeoutMinutes: settings.lockTimeoutMinutes,
});
