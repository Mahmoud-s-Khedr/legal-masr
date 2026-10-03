import type {
  AppStatus,
  AttachmentDto,
  CaseDto,
  CaseSummary,
  ClientDto,
  ClientSummary,
  DashboardSummary,
  ExpenseDto,
  FeeAgreementDto,
  HearingDto,
  LawyerProfile,
  PaymentDto,
  PowerOfAttorneyDto,
  PowerOfAttorneySummary,
  Settings,
  TaskDto,
} from '../bridge/types';

/**
 * Browser-only fixture bridge used by the screenshot runner. It is deliberately
 * not a seed: it never calls Tauri, SQLite, the filesystem, or a network API.
 * Keep fixtures plainly fictional and free of source document paths.
 */
export const captureModeEnabledFor = (development: boolean, requested: string | undefined) =>
  development && requested === 'true';
export const captureModeEnabled = () =>
  captureModeEnabledFor(import.meta.env.DEV, import.meta.env.VITE_CAPTURE_MODE);

const stamp = '2026-10-03T09:00:00Z';
const locale = (): 'ar' | 'en' =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('captureLocale') === 'en'
    ? 'en'
    : 'ar';

const client: ClientDto = {
  id: 'demo-client-adel',
  internalNumber: 'CL-2026-014',
  fullName: 'أدهم منصور — DEMO',
  nationalId: null,
  primaryPhone: '01000000000',
  email: 'demo@example.invalid',
  address: 'عنوان تجريبي، القاهرة',
  notes: 'بيانات عرض خيالية فقط.',
  archivedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
};
const clientSummary: ClientSummary = {
  id: client.id,
  internalNumber: client.internalNumber,
  fullName: client.fullName,
  primaryPhone: client.primaryPhone,
  archivedAt: null,
};
const caseSummary: CaseSummary = {
  id: 'demo-case-14',
  internalNumber: 'دعوى ١٤ / ٢٠٢٦',
  officialNumber: '447',
  officialYear: 2026,
  status: 'ACTIVE',
  clientNames: [client.fullName],
  archivedAt: null,
};
const caseItem: CaseDto = {
  ...caseSummary,
  courtName: 'محكمة تجريبية',
  circuitName: 'الدائرة الثالثة',
  caseType: 'مدني',
  litigationDegree: 'FIRST_INSTANCE',
  filedOn: '2026-09-14',
  closedOn: null,
  subject: 'مطالبة تجريبية',
  notes: 'سجل مخصص للقطات الواجهة.',
  createdAt: stamp,
  updatedAt: stamp,
  clients: [
    {
      clientId: client.id,
      fullName: client.fullName,
      internalNumber: client.internalNumber,
      legalCapacity: 'أصيل',
      powerOfAttorneyId: 'demo-poa-1',
      notes: null,
    },
  ],
  opponents: [
    {
      id: 'demo-opponent-1',
      caseId: 'demo-case-14',
      fullName: 'شركة المثال',
      legalCapacity: null,
      lawyerName: null,
      phone: null,
      address: null,
      notes: null,
    },
  ],
};
const hearing: HearingDto = {
  id: 'demo-hearing-1',
  caseId: caseItem.id,
  previousHearingId: null,
  hearingDate: '2026-10-03',
  hearingTime: '10:30',
  hearingType: 'جلسة نظر',
  location: 'محكمة تجريبية',
  circuitName: 'الثالثة',
  requiredDocuments: 'مذكرة تجريبية',
  notes: null,
  decisionText: null,
  status: 'SCHEDULED',
  completedAt: null,
  reminderMinutes: 60,
  createdAt: stamp,
  updatedAt: stamp,
};
const task: TaskDto = {
  id: 'demo-task-1',
  clientId: client.id,
  caseId: caseItem.id,
  title: 'مراجعة مذكرة الجلسة',
  details: 'بيان عرض فقط',
  notes: null,
  dueDate: '2026-10-03',
  reminderMinutes: 60,
  completed: false,
  completedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
};
const poa: PowerOfAttorneyDto = {
  id: 'demo-poa-1',
  internalSequence: 'توكيل ٠٠٧',
  officialNumber: '123',
  issueYear: 2026,
  issueDate: '2026-08-21',
  notaryOffice: 'توثيق تجريبي',
  notes: 'للعرض فقط',
  archivedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
  clients: [{ id: client.id, fullName: client.fullName, internalNumber: client.internalNumber }],
  lawyers: [{ id: 'demo-lawyer-1', fullName: 'مكتب العرض القانوني', barNumber: null, notes: null }],
  caseIds: [caseItem.id],
};
const attachment: AttachmentDto = {
  id: 'demo-attachment-1',
  clientId: client.id,
  caseId: caseItem.id,
  powerOfAttorneyId: null,
  expenseId: null,
  originalFilename: 'demo-court-note.pdf',
  storedFilename: 'fixture-attachment.pdf',
  relativePath: 'fixture-attachment.pdf',
  category: 'CASE_FILE',
  description: 'ملف تجريبي بلا مسار مصدر',
  documentDate: '2026-09-30',
  mimeType: 'application/pdf',
  fileSizeBytes: 24000,
  sha256: 'fixture-hash-not-a-secret',
  createdAt: stamp,
  updatedAt: stamp,
};
const payment: PaymentDto = {
  id: 'demo-payment-1',
  caseId: caseItem.id,
  payerClientId: client.id,
  amountMinor: 150000,
  paymentDate: '2026-10-01',
  paymentMethod: 'CASH',
  notes: 'دفعة تجريبية',
  createdAt: stamp,
  updatedAt: stamp,
};
const expense: ExpenseDto = {
  id: 'demo-expense-1',
  caseId: caseItem.id,
  clientId: client.id,
  amountMinor: 25000,
  expenseDate: '2026-10-02',
  expenseType: 'COURT_FEE',
  notes: 'رسم تجريبي',
  createdAt: stamp,
  updatedAt: stamp,
};
const settings = (): Settings => ({
  language: locale(),
  theme: 'light',
  dateFormat: 'yyyy-MM-dd',
  weekStartsOn: 6,
  defaultReminderMinutes: 60,
  autostartEnabled: false,
  usageCountersEnabled: false,
  lockTimeoutMinutes: 15,
});
const profile: LawyerProfile = {
  fullName: 'مكتب العرض القانوني',
  barNumber: 'DEMO-2026',
  phone: null,
  officeAddress: 'عنوان عرض خيالي',
  defaultCurrency: 'EGP',
};

/** Returns DTO-shaped data for every read command used by a representative route. */
export async function captureInvoke<T>(command: string): Promise<T> {
  const dashboard: DashboardSummary = {
    todayHearings: [hearing],
    todayTasks: [task],
    overdueTasks: [],
    upcomingHearings: [hearing],
  };
  const values: Record<string, unknown> = {
    app_get_status: { initialized: true, unlocked: true } satisfies AppStatus,
    settings_get: settings(),
    profile_get: profile,
    client_list: [clientSummary],
    client_get: client,
    case_list: [caseSummary],
    case_get: caseItem,
    power_of_attorney_list: [
      {
        id: poa.id,
        internalSequence: poa.internalSequence,
        officialNumber: poa.officialNumber,
        issueYear: poa.issueYear,
        archivedAt: null,
        clientNames: [client.fullName],
      },
    ] satisfies PowerOfAttorneySummary[],
    power_of_attorney_get: poa,
    hearing_list: [hearing],
    hearing_get: hearing,
    task_list: [task],
    dashboard_get_summary: dashboard,
    attachment_list: [attachment],
    payment_list: [payment],
    expense_list: [expense],
    finance_case_summary: {
      caseId: caseItem.id,
      agreedFeeMinor: 300000,
      receivedMinor: 150000,
      outstandingMinor: 150000,
      expensesMinor: 25000,
      netCashMinor: 125000,
    },
    finance_client_summary: {
      clientId: client.id,
      receivedMinor: 150000,
      expensesMinor: 25000,
      netCashMinor: 125000,
    },
    search_global: [
      {
        entityType: 'CLIENT',
        entityId: client.id,
        title: client.fullName,
        subtitle: client.internalNumber,
      },
    ],
    backup_latest_successful: { completedAt: stamp, archiveSizeBytes: 12000 },
    fee_agreement_save: {
      id: 'demo-fee-1',
      caseId: caseItem.id,
      amountMinor: 300000,
      agreementDate: '2026-09-01',
      notes: null,
      createdAt: stamp,
      updatedAt: stamp,
    } satisfies FeeAgreementDto,
    attachment_select_source: {
      sourceToken: 'fixture-source-token',
      filename: 'demo-document.pdf',
    },
  };
  if (command in values) return values[command] as T;
  // Mutations are harmless local no-ops in capture mode. Return a DTO-shaped
  // representative object when a page consumes its result.
  if (command.startsWith('client_')) return client as T;
  if (command.startsWith('case_')) return caseItem as T;
  if (command.startsWith('power_of_attorney_')) return poa as T;
  if (command.startsWith('hearing_')) return hearing as T;
  if (command.startsWith('task_')) return task as T;
  if (command.startsWith('payment_')) return payment as T;
  if (command.startsWith('expense_')) return expense as T;
  return undefined as T;
}

export function assertSafeCaptureFixture(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  if (/([a-z]:\\|\/home\/|\/users\/|bearer\s|api[_-]?key|password\s*[:=])/.test(serialized))
    throw new Error('Capture fixtures must not contain real-looking paths or secrets.');
}

assertSafeCaptureFixture({ client, caseItem, poa, attachment, payment, expense });
