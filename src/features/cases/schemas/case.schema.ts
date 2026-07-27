import { z } from "zod";

export const CASE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "JUDGMENT_ISSUED",
  "APPEALED",
  "ENFORCEMENT",
  "CLOSED",
  "ARCHIVED",
] as const;

export const casePartyRoleSchema = z.enum(["OPPONENT", "WITNESS", "EXPERT", "OTHER"]);

export const caseCoreSchema = z.object({
  caseNumber: z.string().trim().min(1),
  judicialYear: z.union([z.number().int(), z.nan()]).optional(),
  courtName: z.string().trim().optional(),
  circuitName: z.string().trim().optional(),
  caseType: z.string().trim().optional(),
  clientLegalCapacity: z.string().trim().optional(),
  status: z.enum(CASE_STATUSES),
  filedOn: z.string().trim().optional(),
  closedOn: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CaseCoreFormValues = z.infer<typeof caseCoreSchema>;

export const caseCreateFormSchema = caseCoreSchema.extend({
  clientIds: z.array(z.string()).min(1),
  primaryClientId: z.string().min(1),
});
export type CaseCreateFormValues = z.infer<typeof caseCreateFormSchema>;

export const casePartyFormSchema = z.object({
  role: casePartyRoleSchema,
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CasePartyFormValues = z.infer<typeof casePartyFormSchema>;
