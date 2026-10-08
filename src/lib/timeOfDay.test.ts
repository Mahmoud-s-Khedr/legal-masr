import { describe, expect, it } from 'vitest';
import { isCanonicalTime, normalizeTypedTime } from './timeOfDay';

describe('normalizeTypedTime', () => {
  it.each([
    ['9:30', '09:30'],
    ['09:30', '09:30'],
    ['9.30', '09:30'],
    ['٩:٣٠', '09:30'],
    ['930', '09:30'],
    ['1430', '14:30'],
    ['14:00', '14:00'],
    ['2:00 م', '14:00'],
    ['2 م', '14:00'],
    ['2:00', '14:00'],
    ['06:00', '06:00'],
    ['12:15 م', '12:15'],
    ['12:15 ص', '00:15'],
    ['9:30 am', '09:30'],
    ['7:45 pm', '19:45'],
    ['10', '10:00'],
    ['9:30 صباحًا', '09:30'],
  ])('reads %s as %s', (typed, canonical) => {
    expect(normalizeTypedTime(typed)).toBe(canonical);
  });

  it.each(['', '24:00', '9:60', '13 م', '0 ص', 'تسعة', '9:3', '12345'])('refuses %s', (typed) => {
    expect(normalizeTypedTime(typed)).toBeNull();
  });

  it('recognizes only the stored 24-hour form as canonical', () => {
    expect(isCanonicalTime('09:30')).toBe(true);
    expect(isCanonicalTime('9:30')).toBe(false);
    expect(isCanonicalTime('9:30 ص')).toBe(false);
  });
});

it('reads the time as the app itself displays it, direction marks included', () => {
  expect(normalizeTypedTime('‏9:30 ص‏')).toBe('09:30');
});
