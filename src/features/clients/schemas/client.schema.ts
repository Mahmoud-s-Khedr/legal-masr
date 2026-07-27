import { z } from 'zod';

export const clientFormSchema = z.object({
  clientType: z.enum(['INDIVIDUAL', 'ORGANIZATION']),
  displayName: z.string().trim().min(1),
  nationalId: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  primaryPhone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type ClientFormValues = z.infer<typeof clientFormSchema>;
