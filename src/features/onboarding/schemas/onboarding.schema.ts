import { z } from "zod";

export const setupSchema = z.object({
  fullName: z.string().trim().min(1),
  password: z.string().min(12),
});
export type SetupFormValues = z.infer<typeof setupSchema>;

export const recoverySchema = z.object({
  recoveryKey: z.string().trim().min(1),
  password: z.string().min(12),
});
export type RecoveryFormValues = z.infer<typeof recoverySchema>;

export const unlockSchema = z.object({
  password: z.string().min(1),
});
export type UnlockFormValues = z.infer<typeof unlockSchema>;
