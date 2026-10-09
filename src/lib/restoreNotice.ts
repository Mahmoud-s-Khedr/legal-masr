/**
 * A restore locks the app, so the lawyer next sees the password screen. This one-time
 * flag lets that screen say why. It is kept in memory only and holds no data.
 */
let restored = false;
let passwordSource: 'currentPassword' | 'backupPassword' | 'newPassword' = 'currentPassword';

export const markRestored = (source: typeof passwordSource = 'currentPassword') => {
  passwordSource = source;
  restored = true;
};

export const restoreNoticePending = () => restored;
export const restoredPasswordSource = () => passwordSource;

export const clearRestoreNotice = () => {
  restored = false;
};
