import { z } from 'zod';

export const CASE_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;

export const caseCoreSchema = z.object({
  internalNumber: z.string().trim().min(1),
  officialNumber: z.string().trim().optional(),
  officialYear: z.union([z.number().int(), z.nan()]).optional(),
  courtName: z.string().trim().optional(),
  circuitName: z.string().trim().optional(),
  caseType: z.string().trim().optional(),
  litigationDegree: z.enum(['FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'OTHER']).optional(),
  status: z.enum(CASE_STATUSES),
  filedOn: z.string().trim().optional(),
  closedOn: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CaseCoreFormValues = z.infer<typeof caseCoreSchema>;

export const caseCreateFormSchema = caseCoreSchema.extend({
  clientIds: z.array(z.string()).min(1),
});
export type CaseCreateFormValues = z.infer<typeof caseCreateFormSchema>;
