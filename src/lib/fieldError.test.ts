import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { requiredDate, moneyText } from './formSchemas';
import { fieldError } from './fieldError';

const t = ((key: string) => key) as unknown as TFunction;

describe('fieldError', () => {
  it('has no message without an error', () => {
    expect(fieldError(undefined, t)).toBeUndefined();
  });

  it('says required for an empty required date or amount', () => {
    for (const schema of [requiredDate, moneyText]) {
      const result = schema.safeParse('');
      expect(result.success).toBe(false);
      const type = result.error?.issues[0]?.code;
      expect(fieldError({ type }, t)).toBe('forms.required');
    }
  });

  it('says invalid for a filled value that fails validation', () => {
    const date = requiredDate.safeParse('31/31/2026');
    expect(fieldError({ type: date.error?.issues[0]?.code }, t)).toBe('forms.invalid');
    const amount = moneyText.safeParse('0');
    expect(fieldError({ type: amount.error?.issues[0]?.code }, t)).toBe('forms.invalid');
  });
});
