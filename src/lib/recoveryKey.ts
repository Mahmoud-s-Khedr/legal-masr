/**
 * Shows an issued recovery key (64 lowercase hex characters) in groups of eight,
 * so it is easier to copy, write down and read back without losing your place.
 * The backend accepts the grouped form, in any case, with or without separators.
 * Anything that is not a hex key is returned untouched.
 */
export function groupRecoveryKey(key: string): string {
  const compact = key.replace(/[\s-]+/g, '');
  if (!/^[0-9a-f]+$/i.test(compact)) return key;
  return (compact.match(/.{1,8}/g) ?? []).join(' ');
}
