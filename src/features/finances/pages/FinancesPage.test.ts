import { describe, expect, it } from 'vitest';
import { parseMoneyToMinor, paymentPayerOptions } from './FinancesPage';

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

describe('paymentPayerOptions', () => {
  it('only exposes clients attached to the selected case as payment payers', () => {
    expect(
      paymentPayerOptions([
        { clientId: 'client-a', fullName: 'أحمد' },
        { clientId: 'client-b', fullName: 'منى' },
      ]),
    ).toEqual([
      { id: 'client-a', fullName: 'أحمد' },
      { id: 'client-b', fullName: 'منى' },
    ]);
  });

  it('fails closed while no case has been selected or loaded', () => {
    expect(paymentPayerOptions(undefined)).toEqual([]);
  });
});
