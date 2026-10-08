import { describe, expect, it } from 'vitest';
import { caseCreateFormSchema, caseCoreSchema, parseYearInput } from './case.schema';

const base = { internalNumber: 'CA-1', status: 'ACTIVE' as const };

describe.each([
  ['edit', caseCoreSchema, base],
  ['create', caseCreateFormSchema, { ...base, clientIds: ['c1'] }],
])('%s case schema: a year needs the court case number', (_name, schema, values) => {
  it.each([
    ['judicialYear', { judicialYear: 89 }],
    ['officialYear', { officialYear: 2026 }],
  ])('refuses %s without a number, blaming the number field', (_field, year) => {
    const result = schema.safeParse({ ...values, ...year });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['officialNumber']);
  });

  it('treats a blank number as missing', () => {
    expect(schema.safeParse({ ...values, officialNumber: '   ', judicialYear: 89 }).success).toBe(
      false,
    );
  });

  it('accepts a year with a number, and no year without one', () => {
    expect(schema.safeParse({ ...values, officialNumber: '1234', judicialYear: 89 }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({ ...values, officialNumber: '1234', officialYear: 2026 }).success,
    ).toBe(true);
    expect(schema.safeParse(values).success).toBe(true);
  });

  it('treats an emptied year field as no year', () => {
    expect(
      schema.safeParse({ ...values, officialYear: undefined, judicialYear: undefined }).success,
    ).toBe(true);
  });

  it('reports a year typed in letters (parsed as NaN) on its own field', () => {
    const result = schema.safeParse({ ...values, officialNumber: '1', officialYear: NaN });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['officialYear']);
  });
});

describe('parseYearInput', () => {
  it('reads digits in any script and leaves empty fields empty', () => {
    expect(parseYearInput('2026')).toBe(2026);
    expect(parseYearInput(' ٢٠٢٦ ')).toBe(2026);
    expect(parseYearInput('۸۹')).toBe(89);
    expect(parseYearInput('')).toBeUndefined();
    expect(parseYearInput(undefined)).toBeUndefined();
    expect(parseYearInput(2026)).toBe(2026);
  });

  it('turns anything else into NaN so validation can report it', () => {
    expect(parseYearInput('20a6')).toBeNaN();
    expect(parseYearInput('-3')).toBeNaN();
  });
});
