import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOfficeIntegrity, seedRealisticOffice } from './realistic-office-fixture.mjs';

function office() {
  const clients = Array.from({ length: 10 }, (_, i) => ({ id: `client-${i}` }));
  const cases = Array.from({ length: 7 }, (_, i) => ({
    id: `case-${i}`,
    clients: [{ clientId: clients[i].id }],
  }));
  const payments = [
    { id: 'payment', caseId: cases[0].id, payerClientId: clients[0].id, amountMinor: 200025 },
  ];
  const expenses = [{ id: 'expense', caseId: cases[0].id, clientId: null, amountMinor: 25010 }];
  const caseAccounts = cases.map((c, i) => ({
    caseId: c.id,
    agreedFeeMinor: 1000000,
    receivedMinor: i ? 0 : 200025,
    expensesMinor: i ? 0 : 25010,
    outstandingMinor: i ? 1000000 : 799975,
    netCashMinor: i ? 0 : 175015,
  }));
  const clientAccounts = clients.map((c, i) => ({
    clientId: c.id,
    receivedMinor: i ? 0 : 200025,
    expensesMinor: i ? 0 : 25010,
    netCashMinor: i ? 0 : 175015,
  }));
  const hearings = [
    { id: 'previous', caseId: cases[0].id },
    { id: 'next', caseId: cases[0].id, previousHearingId: 'previous' },
  ];
  const tasks = [{ id: 'task', caseId: cases[0].id, clientId: null }];
  const poas = [{ id: 'poa', clients: [{ id: clients[0].id }], archivedAt: null }];
  const rows = {
    clients,
    cases,
    payments,
    expenses,
    caseAccounts,
    clientAccounts,
    hearings,
    tasks,
    poas,
  };
  const invoke = async (command, { id } = {}) => {
    const collections = {
      client_list: clients,
      case_list: cases,
      power_of_attorney_list: poas,
      hearing_list: hearings,
      task_list: tasks,
      payment_list: payments,
      expense_list: expenses,
      attachment_list: [],
    };
    if (command in collections) return structuredClone(collections[command]);
    const details = { client_get: clients, case_get: cases, power_of_attorney_get: poas };
    if (command in details) return structuredClone(details[command].find((x) => x.id === id));
    if (command === 'finance_case_summary')
      return structuredClone(caseAccounts.find((x) => x.caseId === id));
    if (command === 'finance_client_summary')
      return structuredClone(clientAccounts.find((x) => x.clientId === id));
    if (command === 'settings_get' || command === 'profile_get') return {};
    throw new Error('UNEXPECTED_COMMAND');
  };
  return { rows, invoke };
}

test('independent office reconciliation accepts exact piastre totals and valid links', async () => {
  await assertOfficeIntegrity(office(), '2026-10-14');
});
for (const [name, corrupt] of [
  ['missing client', (r) => r.clients.pop()],
  ['missing case', (r) => r.cases.pop()],
  [
    'case with no clients',
    (r) => {
      r.cases[0].clients = [];
    },
  ],
  [
    'orphaned client link',
    (r) => {
      r.cases[0].clients[0].clientId = 'missing';
    },
  ],
  [
    'payer outside case',
    (r) => {
      r.payments[0].payerClientId = 'client-9';
    },
  ],
  [
    'fractional minor units',
    (r) => {
      r.payments[0].amountMinor += 0.01;
    },
  ],
  [
    'incorrect case total',
    (r) => {
      r.caseAccounts[0].receivedMinor++;
    },
  ],
  [
    'incorrect client total',
    (r) => {
      r.clientAccounts[0].expensesMinor++;
    },
  ],
  [
    'dual expense ownership',
    (r) => {
      r.expenses[0].clientId = 'client-0';
    },
  ],
  [
    'dual task ownership',
    (r) => {
      r.tasks[0].clientId = 'client-0';
    },
  ],
  [
    'broken hearing predecessor',
    (r) => {
      r.hearings[1].previousHearingId = 'missing';
    },
  ],
  [
    'cross-case hearing predecessor',
    (r) => {
      r.hearings[1].caseId = 'case-1';
    },
  ],
  [
    'two active powers of attorney',
    (r) => {
      r.poas.push({ ...r.poas[0], id: 'second-poa' });
    },
  ],
])
  test(`office reconciliation detects ${name}`, async () => {
    const h = office();
    corrupt(h.rows);
    await assert.rejects(assertOfficeIntegrity(h, '2026-10-14'), { code: 'ERR_ASSERTION' });
  });

test('seeding refuses an unexpected workspace before performing any write', async () => {
  const calls = [];
  const h = {
    invoke: async (command) => {
      calls.push(command);
      return [];
    },
  };
  await assert.rejects(seedRealisticOffice(h, {}), { code: 'ERR_ASSERTION' });
  assert.deepEqual(calls, ['client_list']);
});
