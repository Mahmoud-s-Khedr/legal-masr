import { describe, expect, it } from 'vitest';
import { suggestNextNumber } from './nextNumber';

describe('suggestNextNumber', () => {
  it.each([
    [[], '1'],
    [['1', '2', '7'], '8'],
    [['C-1', 'C-9', 'C-10'], 'C-11'],
    [['2026/015', '2026/016'], '2026/017'],
    [['٢٠٢٦/٩'], '2026/10'],
    [['A-1', 'B-1', 'B-2'], 'B-3'],
    [['ملف أحمد', 'ملف علي'], '1'],
    [['5', 'م-1'], '6'],
    [['دعوى 14 / 2026'], 'دعوى 15 / 2026'],
    [['015/2026', '016/2026'], '017/2026'],
    [['9007199254740991'], '1'],
  ])('after %j suggests %s', (existing, expected) => {
    expect(suggestNextNumber(existing)).toBe(expected);
  });

  it('skips a number that is already taken', () => {
    expect(suggestNextNumber(['C-1', 'C-2', 'c-3'])).toBe('C-4');
    expect(suggestNextNumber(['ملف', '1'])).toBe('2');
  });
});
