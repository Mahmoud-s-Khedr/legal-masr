import { expect, it } from 'vitest';
import { backupStamp } from './backupStamp';

it('names a backup after the local date and time, padded', () => {
  expect(backupStamp(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05-0907');
  expect(backupStamp(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28-2359');
});
