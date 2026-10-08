import { z } from 'zod';
import type { CaseStatus } from '../../../bridge/types';

export const CASE_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
] as const satisfies readonly CaseStatus[];
export const LITIGATION_DEGREES = ['FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'OTHER'] as const;

export const caseCoreSchema = z.object({
  internalNumber: z.string().trim().min(1),
  officialNumber: z.string().trim().optional(),
  // Gregorian case year, e.g. 2026 in «رقم 447 لسنة 2026».
  officialYear: z.union([z.number().int().min(1800).max(9999), z.nan()]).optional(),
  // Court year, e.g. 89 in «رقم 1234 لسنة 89 قضائية». Not a calendar year.
  judicialYear: z.union([z.number().int().min(1).max(9999), z.nan()]).optional(),
  courtName: z.string().trim().optional(),
  circuitName: z.string().trim().optional(),
  caseType: z.string().trim().optional(),
  litigationDegree: z.enum(LITIGATION_DEGREES).optional(),
  status: z.enum(CASE_STATUSES),
  filedOn: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  closedOn: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  subject: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
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

export const caseCreateFormSchema = caseCoreSchema.extend({
  clientIds: z.array(z.string()).min(1),
});
export type CaseCreateFormValues = z.infer<typeof caseCreateFormSchema>;

export const caseCreateFormDefaults: CaseCreateFormValues = {
  ...caseCoreFormDefaults,
  clientIds: [],
};
