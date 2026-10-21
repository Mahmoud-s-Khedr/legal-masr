import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Synthetic records only. The caller supplies the isolated desktop command
// bridge; this fixture never opens a database or the user's application data.
export async function seedRealisticOffice(
  h,
  { language, today, shift, client, second, outsider, caseItem },
) {
  const names = [
    'أحمد المثال',
    'سارة المثال',
    'شركة النيل التجريبية',
    'محمد المثال',
    'فاطمة المثال',
    'خالد المثال',
    'مريم المثال',
    'شركة الأفق التجريبية',
    'يوسف المثال',
    'نور المثال',
  ];
  const areas = [
    'مدينة نصر، القاهرة',
    'المعادي، القاهرة',
    'الدقي، الجيزة',
    'سموحة، الإسكندرية',
    'طنطا، الغربية',
    'المنصورة، الدقهلية',
    'الزقازيق، الشرقية',
  ];
  const clients = [client, second, outsider];
  assert.equal((await h.invoke('client_list', { input: { includeArchived: true } })).length, 3);
  assert.equal((await h.invoke('case_list', { input: { includeArchived: true } })).length, 1);
  for (let index = 0; index < 10; index++) {
    const input = {
      internalNumber: `CL-DEMO-${String(index + 1).padStart(3, '0')}`,
      fullName:
        index < 3
          ? clients[index].fullName
          : language === 'ar'
            ? `${names[index]} — خيالي`
            : `Fictional client ${index + 1}`,
      primaryPhone: `01000000${String(index + 1).padStart(3, '0')}`,
      email: `client${index + 1}@example.invalid`,
      address: areas[index % areas.length],
      notes: 'بيانات خيالية للاختبار فقط؛ لا تمثل موكلاً أو نزاعاً حقيقياً.',
      confirmDuplicate: true,
    };
    if (index < 3)
      clients[index] = await h.invoke('client_update', {
        input: { id: clients[index].id, ...input },
      });
    else clients.push(await h.invoke('client_create', { input }));
  }
  const cases = [caseItem];
  const types = ['تعويض مدني', 'نفقة', 'نزاع عمل', 'إيجار', 'مطالبة تجارية', 'استئناف مدني'];
  const methods = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ELECTRONIC', 'OTHER'];
  const categories = ['COURT_FEE', 'TRANSPORT', 'OFFICE_SUPPLIES', 'EXPERT_FEE', 'OTHER'];
  for (let index = 1; index < 7; index++) {
    const owners = index === 1 ? [clients[2], clients[3]] : [clients[index + 2]];
    await h.invoke('power_of_attorney_create', {
      input: {
        internalSequence: `POA-DEMO-${String(index + 1).padStart(3, '0')}`,
        officialNumber: String(1200 + index),
        issueDate: shift(-60 - index),
        issueYear: Number(today.slice(0, 4)),
        notaryOffice: 'مكتب توثيق تجريبي، القاهرة',
        notes: 'توكيل خيالي للاختبار',
        clientIds: owners.map((owner) => owner.id),
        lawyers: [{ fullName: 'محامٍ تجريبي', barNumber: `TEST-${index}`, notes: 'بيانات خيالية' }],
      },
    });
    const record = await h.invoke('case_create', {
      input: {
        internalNumber: `CASE-DEMO-${String(index + 1).padStart(3, '0')}`,
        officialNumber: String(2000 + index),
        officialYear: Number(today.slice(0, 4)),
        courtName: index % 2 ? 'محكمة القاهرة الجديدة التجريبية' : 'محكمة الجيزة التجريبية',
        circuitName: `الدائرة التجريبية ${index}`,
        caseType: types[index - 1],
        litigationDegree: ['FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'OTHER'][index % 4],
        status: ['ACTIVE', 'SUSPENDED', 'CLOSED'][index % 3],
        filedOn: shift(-40 - index),
        subject: `نزاع خيالي للاختبار: ${types[index - 1]}`,
        notes: 'جميع البيانات خيالية.',
        clients: owners.map((owner, n) => ({
          clientId: owner.id,
          legalCapacity: n ? 'متدخل' : 'مدعٍ',
          notes: 'صفة تجريبية',
        })),
      },
    });
    cases.push(record);
    await h.invoke('case_add_opponent', {
      input: {
        caseId: record.id,
        fullName: `خصم خيالي ${index}`,
        legalCapacity: 'مدعى عليه',
        lawyerName: 'محامٍ خيالي',
        phone: '0200000000',
        address: 'عنوان خيالي، القاهرة',
        notes: 'بيانات للاختبار',
      },
    });
    const previous = await h.invoke('hearing_create', {
      input: {
        caseId: record.id,
        hearingDate: shift(-index),
        hearingTime: '09:30',
        hearingType: 'مرافعة',
        location: record.courtName,
        circuitName: record.circuitName,
        requiredDocuments: 'عقد ومذكرة خياليان',
        notes: 'جلسة سابقة خيالية',
      },
    });
    await h.invoke('hearing_record_decision', {
      input: {
        id: previous.id,
        decisionText: 'تأجيل لتقديم المستندات التجريبية',
        nextHearing: { caseId: record.id, hearingDate: shift(index), hearingTime: '11:00' },
      },
    });
    const task = await h.invoke('task_create', {
      input: {
        caseId: record.id,
        title: `مراجعة مستندات القضية التجريبية ${index}`,
        dueDate: shift(index - 3),
        details: 'إعداد ومراجعة مذكرة خيالية',
        notes: 'مهمة للاختبار',
      },
    });
    if (index % 3 === 0) await h.invoke('task_complete', { id: task.id });
    await h.invoke('fee_agreement_save', {
      input: {
        caseId: record.id,
        amountMinor: 1000000 + index * 10000,
        agreementDate: shift(-30),
        notes: 'اتفاق أتعاب خيالي',
      },
    });
    await h.invoke('payment_save', {
      input: {
        caseId: record.id,
        payerClientId: owners[0].id,
        amountMinor: 200025 + index * 100,
        paymentDate: shift(-index),
        paymentMethod: methods[(index - 1) % methods.length],
        notes: 'دفعة خيالية',
      },
    });
    await h.invoke('expense_save', {
      input: {
        caseId: record.id,
        amountMinor: 25010 + index * 10,
        expenseDate: shift(-index),
        expenseType: categories[(index - 1) % categories.length],
        notes: 'مصروف خيالي',
      },
    });
    await h.invoke('attachment_add', {
      input: {
        caseId: record.id,
        sourceToken: (await h.invoke('attachment_select_source')).sourceToken,
        category: 'CASE_FILE',
        documentDate: today,
        description: 'مستند PDF خيالي للقضية',
      },
    });
  }
  await h.invoke('task_create', {
    input: {
      clientId: clients[9].id,
      title: 'متابعة موكل دون قضية — خيالي',
      dueDate: shift(2),
      details: 'متابعة توكيل تجريبي',
    },
  });
  for (const owner of [{ clientId: clients[9].id }, {}])
    await h.invoke('expense_save', {
      input: {
        ...owner,
        amountMinor: 7515,
        expenseDate: today,
        expenseType: 'OTHER',
        notes: 'مصروف خيالي خارج القضية',
      },
    });
  assert.equal((await h.invoke('client_list', { input: { includeArchived: true } })).length, 10);
  assert.equal((await h.invoke('case_list', { input: { includeArchived: true } })).length, 7);
  return { clients, cases };
}

export async function officeSnapshot(h, today) {
  const clients = await h.invoke('client_list', { input: { includeArchived: true } });
  const cases = await h.invoke('case_list', { input: { includeArchived: true } });
  const poas = await h.invoke('power_of_attorney_list', { input: { includeArchived: true } });
  const sorted = (rows) => rows.sort((a, b) => a.id.localeCompare(b.id));
  const attachments = sorted(await h.invoke('attachment_list', { input: {} }));
  return {
    clients: sorted(await Promise.all(clients.map((x) => h.invoke('client_get', { id: x.id })))),
    cases: sorted(await Promise.all(cases.map((x) => h.invoke('case_get', { id: x.id })))),
    poas: sorted(
      await Promise.all(poas.map((x) => h.invoke('power_of_attorney_get', { id: x.id }))),
    ),
    hearings: sorted(await h.invoke('hearing_list', { input: {} })),
    tasks: sorted(await h.invoke('task_list', { input: { view: 'ALL', referenceDate: today } })),
    payments: sorted(await h.invoke('payment_list', { input: {} })),
    expenses: sorted(await h.invoke('expense_list', { input: {} })),
    caseAccounts: await Promise.all(
      sorted(cases).map((x) => h.invoke('finance_case_summary', { id: x.id })),
    ),
    clientAccounts: await Promise.all(
      sorted(clients).map((x) => h.invoke('finance_client_summary', { id: x.id })),
    ),
    attachments,
    documentHashes: await Promise.all(
      attachments.map(async (x) =>
        createHash('sha256')
          .update(await readFile(join(h.root, 'vault/attachments', x.storedFilename)))
          .digest('hex'),
      ),
    ),
    settings: await h.invoke('settings_get'),
    profile: await h.invoke('profile_get'),
  };
}

export async function assertOfficeIntegrity(h, today) {
  const data = await officeSnapshot(h, today);
  assert.equal(data.clients.length, 10);
  assert.equal(data.cases.length, 7);
  const sum = (rows) => rows.reduce((total, row) => total + row.amountMinor, 0);
  for (const account of data.caseAccounts) {
    const record = data.cases.find((x) => x.id === account.caseId);
    assert(record.clients.length > 0);
    for (const link of record.clients) assert(data.clients.some((x) => x.id === link.clientId));
    const received = sum(data.payments.filter((x) => x.caseId === record.id));
    const expenses = sum(data.expenses.filter((x) => x.caseId === record.id));
    assert.equal(account.receivedMinor, received);
    assert.equal(account.expensesMinor, expenses);
    assert.equal(account.outstandingMinor, Math.max(0, account.agreedFeeMinor - received));
    assert.equal(account.netCashMinor, received - expenses);
  }
  for (const account of data.clientAccounts) {
    const linkedCases = data.cases.filter((x) =>
      x.clients.some((c) => c.clientId === account.clientId),
    );
    const received = sum(data.payments.filter((x) => x.payerClientId === account.clientId));
    const expenses = sum(
      data.expenses.filter(
        (x) => x.clientId === account.clientId || linkedCases.some((c) => c.id === x.caseId),
      ),
    );
    assert.equal(account.receivedMinor, received);
    assert.equal(account.expensesMinor, expenses);
    assert.equal(account.netCashMinor, received - expenses);
  }
  for (const payment of data.payments) {
    assert(Number.isSafeInteger(payment.amountMinor) && payment.amountMinor > 0);
    assert(
      data.cases
        .find((x) => x.id === payment.caseId)
        .clients.some((x) => x.clientId === payment.payerClientId),
    );
  }
  for (const row of [...data.expenses, ...data.tasks]) assert(!(row.caseId && row.clientId));
  for (const hearing of data.hearings) {
    assert(data.cases.some((x) => x.id === hearing.caseId));
    if (hearing.previousHearingId)
      assert(
        data.hearings.some(
          (x) => x.id === hearing.previousHearingId && x.caseId === hearing.caseId,
        ),
      );
  }
  for (const attachment of data.attachments) {
    assert.equal(
      ['clientId', 'caseId', 'powerOfAttorneyId', 'expenseId'].filter((key) => attachment[key])
        .length,
      1,
    );
  }
  for (const record of data.clients)
    assert(
      data.poas.filter((x) => !x.archivedAt && x.clients.some((c) => c.id === record.id)).length <=
        1,
    );
}
