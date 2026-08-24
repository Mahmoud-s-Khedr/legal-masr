import { z } from 'zod';

export const clientFormSchema = z.object({
  internalNumber: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  nationalId: z.string().trim().optional(),
  primaryPhone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const clientFormDefaults: ClientFormValues = {
  internalNumber: '',
  fullName: '',
  nationalId: undefined,
  primaryPhone: undefined,
  email: undefined,
  address: undefined,
  notes: undefined,
};
