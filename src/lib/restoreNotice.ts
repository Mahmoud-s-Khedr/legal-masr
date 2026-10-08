/**
 * A restore locks the app, so the lawyer next sees the password screen. This one-time
 * flag lets that screen say why. It is kept in memory only and holds no data.
 */
let restored = false;

export const markRestored = () => {
  restored = true;
};

export const restoreNoticePending = () => restored;

export const clearRestoreNotice = () => {
  restored = false;
};
