import { z } from 'zod';
import { normalizeTypedDate } from '@/components/forms/DatePicker';
import { parseMoneyToMinor } from './money';
export const requiredText = z.string().trim().min(1);
export const optionalText = z.string();
export const requiredDate = z
  .string()
  .min(1)
  .refine((value) => !!normalizeTypedDate(value), 'Invalid date');
export const optionalDate = z
  .string()
  .refine((value) => !value || !!normalizeTypedDate(value), 'Invalid date');
export const timeText = z
  .string()
  .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), 'Invalid time');
export const moneyText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => (parseMoneyToMinor(value) ?? 0) > 0, 'Invalid amount');
export const taskDraftSchema = z.object({
  title: requiredText,
  dueDate: requiredDate,
  caseId: optionalText,
  clientId: optionalText,
  details: optionalText,
  notes: optionalText,
});
export const hearingDraftSchema = z.object({
  caseId: requiredText,
  date: requiredDate,
  time: timeText,
  type: optionalText,
  location: optionalText,
  circuit: optionalText,
  requiredDocuments: optionalText,
  notes: optionalText,
});
export const decisionDraftSchema = z.object({ decisionText: optionalText, nextDate: optionalDate });
export const paymentDraftSchema = z.object({
  caseId: requiredText,
  payerClientId: requiredText,
  amount: moneyText,
  date: requiredDate,
  method: z.enum(['', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'ELECTRONIC', 'OTHER']),
  notes: optionalText,
});
export const expenseDraftSchema = z.object({
  caseId: optionalText,
  clientId: optionalText,
  amount: moneyText,
  date: requiredDate,
  type: z.enum(['COURT_FEE', 'TRANSPORT', 'OFFICE_SUPPLIES', 'EXPERT_FEE', 'OTHER']),
  notes: optionalText,
});
export const opponentDraftSchema = z.object({
  fullName: requiredText,
  legalCapacity: optionalText,
  lawyerName: optionalText,
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});
export const attachmentDraftSchema = z.object({
  category: z.enum([
    'IDENTIFICATION',
    'POWER_OF_ATTORNEY',
    'CASE_FILE',
    'COURT_DECISION',
    'EVIDENCE',
    'RECEIPT',
    'CORRESPONDENCE',
    'OTHER',
  ]),
  descriptionValue: optionalText,
  documentDate: optionalDate,
});
export const profileDraftSchema = z.object({
  fullName: requiredText,
  barNumber: optionalText,
  phone: optionalText,
  officeAddress: optionalText,
});
export const passwordDraftSchema = z
  .object({ current: z.string().min(1), next: z.string().min(12), confirm: z.string() })
  .refine((values) => values.next === values.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
export const feeDraftSchema = z.object({ amount: moneyText });
