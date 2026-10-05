import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;

const newPassword = {
  password: z.string().min(PASSWORD_MIN_LENGTH),
  confirmPassword: z.string(),
};
const passwordsMatch = (values: { password: string; confirmPassword: string }) =>
  values.password === values.confirmPassword;
const mismatch = { path: ['confirmPassword'], message: 'mismatch' };

export const setupSchema = z
  .object({ fullName: z.string().trim().min(1), ...newPassword })
  .refine(passwordsMatch, mismatch);
export type SetupFormValues = z.infer<typeof setupSchema>;

export const recoverySchema = z
  .object({ recoveryKey: z.string().trim().min(1), ...newPassword })
  .refine(passwordsMatch, mismatch);
export type RecoveryFormValues = z.infer<typeof recoverySchema>;

export const unlockSchema = z.object({
  password: z.string().min(1),
});
export type UnlockFormValues = z.infer<typeof unlockSchema>;
