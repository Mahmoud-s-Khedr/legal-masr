import { describe, expect, it, vi } from 'vitest';
import { dateOnlyToLocalDate, localDateOnly } from './dateOnly';

describe('localDateOnly', () => {
  it('preserves local calendar components instead of converting through UTC', () => {
    const date = new Date(2026, 0, 1, 0, 30);
    vi.spyOn(date, 'toISOString').mockReturnValue('2025-12-31T22:30:00.000Z');
    expect(localDateOnly(date)).toBe('2026-01-01');
  });

  it('parses stored date-only values as local calendar dates', () => {
    const date = dateOnlyToLocalDate('2026-01-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });
});
