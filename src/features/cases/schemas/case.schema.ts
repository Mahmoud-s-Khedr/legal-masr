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
  officialYear: z.union([z.number().int(), z.nan()]).optional(),
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
