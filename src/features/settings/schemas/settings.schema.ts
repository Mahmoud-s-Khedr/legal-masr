import { z } from 'zod';

export const settingsSchema = z.object({
  language: z.enum(['ar', 'en']),
  theme: z.enum(['system', 'light', 'dark']),
  lockTimeoutMinutes: z.number().int().min(1),
});
export type SettingsFormValues = z.infer<typeof settingsSchema>;
