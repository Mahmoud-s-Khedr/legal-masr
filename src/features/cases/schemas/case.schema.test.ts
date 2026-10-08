import { describe, expect, it } from 'vitest';
import { caseCreateFormSchema, caseCoreSchema } from './case.schema';

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

  it('ignores the NaN an emptied number input produces', () => {
    expect(schema.safeParse({ ...values, officialYear: NaN, judicialYear: NaN }).success).toBe(
      true,
    );
  });
});
