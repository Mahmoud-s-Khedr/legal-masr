import { z } from 'zod';
import { normalizeTypedDate } from '@/components/forms/DatePicker';
import type { CaseStatus } from '../../../bridge/types';

export const CASE_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
] as const satisfies readonly CaseStatus[];
export const LITIGATION_DEGREES = ['FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'OTHER'] as const;

const optionalDateOnly = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional()
  .refine((value) => !value || normalizeTypedDate(value) === value, 'INVALID_DATE');

const caseCoreObject = z.object({
  internalNumber: z.string().trim().min(1),
  officialNumber: z.string().trim().optional(),
  // Gregorian case year, e.g. 2026 in «رقم 447 لسنة 2026». Empty is undefined; anything
  // typed that is not a year arrives as NaN (see parseYearInput) and is reported.
  officialYear: z.number().int().min(1800).max(9999).optional(),
  // Court year, e.g. 89 in «رقم 1234 لسنة 89 قضائية». Not a calendar year.
  judicialYear: z.number().int().min(1).max(9999).optional(),
  courtName: z.string().trim().optional(),
  circuitName: z.string().trim().optional(),
  caseType: z.string().trim().optional(),
  litigationDegree: z.enum(LITIGATION_DEGREES).optional(),
  status: z.enum(CASE_STATUSES),
  filedOn: optionalDateOnly,
  closedOn: optionalDateOnly,
  subject: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** Reads a year field: digits in any script, empty as undefined, anything else as NaN. */
export function parseYearInput(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  const text = String(value ?? '')
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 0xf));
  if (!text) return undefined;
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

const isYear = (value: number | undefined) => typeof value === 'number' && !Number.isNaN(value);

// A year is only meaningful inside the reference «رقم N لسنة Y»: lists and detail pages draw the
// reference from the number, so a year saved without one would be stored but never shown.
function requireNumberWithYear(values: z.infer<typeof caseCoreObject>, context: z.RefinementCtx) {
  if (
    !values.officialNumber?.trim() &&
    (isYear(values.officialYear) || isYear(values.judicialYear))
  )
    context.addIssue({
      code: 'custom',
      path: ['officialNumber'],
      message: 'NUMBER_REQUIRED_WITH_YEAR',
    });
  if (values.filedOn && values.closedOn && values.closedOn < values.filedOn)
    context.addIssue({ code: 'custom', path: ['closedOn'], message: 'CLOSED_BEFORE_FILED' });
}

export const caseCoreSchema = caseCoreObject.superRefine(requireNumberWithYear);
export type CaseCoreFormValues = z.infer<typeof caseCoreSchema>;

export const caseCoreFormDefaults: CaseCoreFormValues = {
  internalNumber: '',
  officialNumber: undefined,
  officialYear: undefined,
  judicialYear: undefined,
  courtName: undefined,
  circuitName: undefined,
  caseType: undefined,
  litigationDegree: undefined,
  status: 'ACTIVE',
  filedOn: undefined,
  closedOn: undefined,
  subject: undefined,
  notes: undefined,
};

export const caseCreateFormSchema = caseCoreObject
  .extend({ clientIds: z.array(z.string()).min(1) })
  .superRefine(requireNumberWithYear);
export type CaseCreateFormValues = z.infer<typeof caseCreateFormSchema>;

export const caseCreateFormDefaults: CaseCreateFormValues = {
  ...caseCoreFormDefaults,
  clientIds: [],
};
