import { describe, expect, it } from 'vitest';
import { parseMoneyToMinor } from './FinancesPage';

describe('parseMoneyToMinor', () => {
  it('converts Egyptian-pound input to integer piastres without floating-point math', () => {
    expect(parseMoneyToMinor('1250')).toBe(125_000);
    expect(parseMoneyToMinor('1250.5')).toBe(125_050);
    expect(parseMoneyToMinor('1250,05')).toBe(125_005);
  });

  it('rejects zero, negative, malformed, and over-precise amounts', () => {
    expect(parseMoneyToMinor('0')).toBeNull();
    expect(parseMoneyToMinor('-10')).toBeNull();
    expect(parseMoneyToMinor('12.345')).toBeNull();
    expect(parseMoneyToMinor('not money')).toBeNull();
  });
});
