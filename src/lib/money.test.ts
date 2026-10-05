import { describe, expect, it } from 'vitest';
import { minorToInput, parseMoneyToMinor } from './money';

describe('parseMoneyToMinor', () => {
  it('parses Western, Arabic-Indic and Persian digits to the same piasters', () => {
    expect(parseMoneyToMinor('123.45')).toBe(12_345);
    expect(parseMoneyToMinor('١٢٣٫٤٥')).toBe(12_345);
    expect(parseMoneyToMinor('۱۲۳.۴۵')).toBe(12_345);
    expect(parseMoneyToMinor(' 1250 ')).toBe(125_000);
  });

  it('accepts unambiguous thousands groups and a currency suffix', () => {
    expect(parseMoneyToMinor('1,500')).toBe(150_000);
    expect(parseMoneyToMinor('1,500,000.25')).toBe(150_000_025);
    expect(parseMoneyToMinor('١٬٥٠٠')).toBe(150_000);
    expect(parseMoneyToMinor('1500 ج.م')).toBe(150_000);
    expect(parseMoneyToMinor('1 500')).toBe(150_000);
  });

  it('keeps the decimal comma for one or two places', () => {
    expect(parseMoneyToMinor('1250,05')).toBe(125_005);
    expect(parseMoneyToMinor('1250,5')).toBe(125_050);
  });

  it('rejects zero, negatives, ambiguous grouping, extra places and overflow', () => {
    expect(parseMoneyToMinor('0')).toBeNull();
    expect(parseMoneyToMinor('0.00')).toBeNull();
    expect(parseMoneyToMinor('-10')).toBeNull();
    expect(parseMoneyToMinor('12.345')).toBeNull();
    expect(parseMoneyToMinor('1,50,0')).toBeNull();
    expect(parseMoneyToMinor('1.500,25')).toBeNull();
    expect(parseMoneyToMinor('')).toBeNull();
    expect(parseMoneyToMinor('not money')).toBeNull();
    expect(parseMoneyToMinor('99999999999999999')).toBeNull();
  });
});

describe('minorToInput', () => {
  it('round-trips piasters through the editable value', () => {
    expect(minorToInput(150_000)).toBe('1500');
    expect(minorToInput(150_050)).toBe('1500.50');
    expect(minorToInput(5)).toBe('0.05');
    expect(parseMoneyToMinor(minorToInput(123_456))).toBe(123_456);
  });
});
