import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatBytes,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatMoney,
  formatMonthYear,
  formatTime,
} from './format';

// Strip bidi marks Intl inserts around currency symbols so assertions stay readable.
const plain = (value: string) =>
  value.replace(/[\u200e\u200f\u061c]/g, '').replace(/[\u00a0\u202f]/g, ' ');

describe('date presentation', () => {
  it('follows the short date preference without timezone conversion', () => {
    expect(formatDateShort('2026-10-03', 'dd/MM/yyyy')).toBe('03/10/2026');
    expect(formatDateShort('2026-10-03', 'yyyy-MM-dd')).toBe('2026-10-03');
    expect(formatDateShort('2026-01-01')).toBe('01/01/2026');
  });

  it('leaves values that are not date-only untouched', () => {
    expect(formatDateShort('')).toBe('');
    expect(formatDateShort('not-a-date')).toBe('not-a-date');
    expect(formatDateLong('2026-10', 'ar')).toBe('2026-10');
  });

  it('uses Gregorian Egyptian month names with Western digits', () => {
    const long = formatDateLong('2026-10-03', 'ar');
    expect(long).toContain('أكتوبر');
    expect(long).toContain('السبت');
    expect(long).toContain('2026');
    expect(long).not.toMatch(/[٠-٩]/);
    expect(long).not.toContain('هـ');
    expect(formatMonthYear(new Date(2026, 9, 1), 'ar')).toBe('أكتوبر 2026');
    expect(formatDateLong('2026-10-03', 'en')).toBe('Saturday, 3 October 2026');
  });

  it('keeps the calendar day across a DST-sensitive date', () => {
    expect(formatDateLong('2026-04-24', 'en')).toContain('24 April');
  });

  it('shows court times on a 12-hour clock', () => {
    expect(formatTime('10:30', 'ar')).toBe('10:30 ص');
    expect(formatTime('13:05', 'ar')).toBe('1:05 م');
    expect(formatTime('09:00', 'en').toLowerCase()).toBe('9:00 am');
    expect(formatTime('later', 'ar')).toBe('later');
  });

  it('formats instants and rejects invalid ones without throwing', () => {
    expect(formatDateTime('2026-10-03T09:00:00Z', 'ar')).toContain('أكتوبر');
    expect(formatDateTime('invalid', 'ar')).toBe('invalid');
  });

  it('counts whole calendar days between date-only values', () => {
    expect(daysBetween('2026-10-03', '2026-10-03')).toBe(0);
    expect(daysBetween('2026-10-01', '2026-10-03')).toBe(2);
    expect(daysBetween('2026-10-03', '2026-09-30')).toBe(-3);
    expect(daysBetween('2026-03-25', '2026-04-05')).toBe(11);
  });
});

describe('money and size presentation', () => {
  it('converts integer piasters to Egyptian pounds', () => {
    expect(plain(formatMoney(150_000, 'ar'))).toBe('1,500.00 ج.م.');
    expect(plain(formatMoney(5, 'ar'))).toBe('0.05 ج.م.');
    expect(plain(formatMoney(0, 'en'))).toBe('EGP 0.00');
    expect(plain(formatMoney(-2_550, 'en'))).toBe('-EGP 25.50');
  });

  it('formats file sizes with readable units', () => {
    expect(formatBytes(0, 'ar')).toBe('0 بايت');
    expect(formatBytes(12_000, 'ar')).toBe('12 ك.ب');
    expect(formatBytes(1_536, 'en')).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 ** 3, 'en')).toBe('5 GB');
  });
});
