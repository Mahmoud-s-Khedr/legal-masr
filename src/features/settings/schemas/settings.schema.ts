import { z } from 'zod';

export const settingsSchema = z.object({
  language: z.enum(['ar', 'en']),
  theme: z.enum(['system', 'light', 'dark']),
  dateFormat: z.enum(['dd/MM/yyyy', 'yyyy-MM-dd']),
  weekStartsOn: z.number().int().min(0).max(6),
  defaultReminderMinutes: z.number().int().min(0).max(10_080),
  lockTimeoutMinutes: z.number().int().min(1).max(1440),
});
export type SettingsFormValues = z.infer<typeof settingsSchema>;
