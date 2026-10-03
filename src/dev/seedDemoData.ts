import { bridge } from '../bridge/commands';

export type DemoSeedResult = 'seeded' | 'skipped_nonempty_vault';

function localDate(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Development-only fixture data. Every write goes through the typed Rust
 * command bridge, so the same validation and business rules apply as they do
 * to normal product interactions.
 */
export async function seedDemoData(): Promise<DemoSeedResult> {
  const existingClients = await bridge.clientList({ includeArchived: true });
  if (existingClients.length > 0) return 'skipped_nonempty_vault';

  const today = localDate();
  const primaryClient = await bridge.clientCreate({
    internalNumber: 'DEMO-CL-001',
    fullName: 'أحمد محمود علي',
    nationalId: '29501011234567',
    primaryPhone: '01012345678',
    email: 'ahmed.demo@example.test',
    address: 'مدينة نصر، القاهرة',
    notes: 'بيانات تجريبية لعرض تدفق العمل.',
    confirmDuplicate: true,
  });
  const coClient = await bridge.clientCreate({
    internalNumber: 'DEMO-CL-002',
    fullName: 'سارة إبراهيم حسن',
    primaryPhone: '01123456789',
    email: 'sara.demo@example.test',
    address: 'المعادي، القاهرة',
    confirmDuplicate: true,
  });
  await bridge.clientCreate({
    internalNumber: 'DEMO-CL-003',
    fullName: 'شركة النيل للتجارة',
    primaryPhone: '01234567890',
    address: 'الدقي، الجيزة',
    notes: 'موكل تجريبي مستقل.',
    confirmDuplicate: true,
  });

  const powerOfAttorney = await bridge.powerOfAttorneyCreate({
    internalSequence: 'DEMO-POA-001',
    officialNumber: '1187',
    issueDate: localDate(-45),
    notaryOffice: 'مكتب توثيق مدينة نصر',
    notes: 'توكيل تجريبي مرتبط بالقضية المعروضة.',
    clientIds: [primaryClient.id],
    lawyers: [
      {
        fullName: 'محمود السيد',
        barNumber: '45678',
        notes: 'محامٍ مشارك',
      },
    ],
  });

  const legalCase = await bridge.caseCreate({
    internalNumber: 'DEMO-CASE-001',
    officialNumber: '2045',
    officialYear: new Date().getFullYear(),
    courtName: 'محكمة جنوب القاهرة الابتدائية',
    circuitName: 'الدائرة المدنية الثالثة',
    caseType: 'تعويض مدني',
    litigationDegree: 'FIRST_INSTANCE',
    status: 'ACTIVE',
    filedOn: localDate(-30),
    subject: 'دعوى تعويض عن إخلال بالتزام تعاقدي',
    notes: 'قضية تجريبية لعرض الجلسات والمهام والحسابات.',
    clients: [
      {
        clientId: primaryClient.id,
        legalCapacity: 'مدعٍ',
        powerOfAttorneyId: powerOfAttorney.id,
      },
      {
        clientId: coClient.id,
        legalCapacity: 'متدخل انضمامي',
      },
    ],
  });

  await bridge.caseAddOpponent({
    caseId: legalCase.id,
    fullName: 'شركة الأفق للمقاولات',
    legalCapacity: 'مدعى عليه',
    lawyerName: 'عمر فؤاد',
    phone: '0223456789',
    address: 'وسط البلد، القاهرة',
  });
  await bridge.hearingCreate({
    caseId: legalCase.id,
    hearingDate: today,
    hearingTime: '10:30',
    hearingType: 'جلسة مرافعة',
    location: 'محكمة جنوب القاهرة',
    circuitName: 'الدائرة المدنية الثالثة',
    requiredDocuments: 'أصل العقد وكشف الحساب',
    notes: 'متابعة طلب التعويض.',
    reminderMinutes: 120,
  });
  await bridge.hearingCreate({
    caseId: legalCase.id,
    hearingDate: localDate(14),
    hearingTime: '09:00',
    hearingType: 'جلسة حكم',
    location: 'محكمة جنوب القاهرة',
    reminderMinutes: 60,
  });

  await bridge.taskCreate({
    clientId: primaryClient.id,
    caseId: legalCase.id,
    title: 'مراجعة أصل العقد',
    details: 'مطابقة النسخة المقدمة مع أصل العقد قبل الجلسة.',
    dueDate: localDate(-1),
    reminderMinutes: 60,
  });
  await bridge.taskCreate({
    clientId: primaryClient.id,
    caseId: legalCase.id,
    title: 'تجهيز مذكرة المرافعة',
    details: 'تجهيز مذكرة مختصرة بالنقاط الرئيسية.',
    dueDate: today,
    reminderMinutes: 90,
  });
  const completedTask = await bridge.taskCreate({
    clientId: coClient.id,
    caseId: legalCase.id,
    title: 'استلام المستندات من الموكل',
    dueDate: localDate(-3),
  });
  await bridge.taskComplete(completedTask.id);

  await bridge.feeAgreementSave({
    caseId: legalCase.id,
    amountMinor: 1_200_000,
    agreementDate: localDate(-30),
    notes: 'أتعاب متفق عليها للقضية التجريبية.',
  });
  await bridge.paymentSave({
    caseId: legalCase.id,
    payerClientId: primaryClient.id,
    amountMinor: 450_000,
    paymentDate: localDate(-7),
    paymentMethod: 'BANK_TRANSFER',
    notes: 'دفعة مقدمة تجريبية.',
  });
  await bridge.expenseSave({
    caseId: legalCase.id,
    clientId: primaryClient.id,
    amountMinor: 15_000,
    expenseDate: localDate(-2),
    expenseType: 'COURT_FEE',
    notes: 'رسم قضائي تجريبي.',
  });

  return 'seeded';
}

let activeSeed: Promise<DemoSeedResult> | undefined;

export function seedDemoDataOnce() {
  activeSeed ??= seedDemoData();
  return activeSeed;
}
