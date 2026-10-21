import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fictionalFailure, fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { LocalePresentationContext } from '@/i18n/LocalePresentation';
import { enUS, arEG } from 'date-fns/locale';
import { CaseDetailPage } from './CaseDetailPage';

const completed = {
  ...fixtures.hearing,
  id: 'demo-hearing-done',
  hearingDate: '2026-09-01',
  status: 'COMPLETED' as const,
  decisionText: 'حجز للحكم — DEMO',
  completedAt: '2026-09-01T12:00:00',
};

beforeEach(async () => {
  prepareWorkflowMocks();
  vi.mocked(bridge.hearingList).mockResolvedValue([fixtures.hearing, completed]);
  await i18n.changeLanguage('ar');
});

it('lists hearings with edit and record-decision only where the service accepts them', async () => {
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click(await screen.findByRole('tab', { name: /الجلسات/ }));

  expect(await screen.findByText('حجز للحكم — DEMO')).toBeInTheDocument();
  // Two hearings are listed; only the scheduled one can be edited or decided.
  expect(screen.getAllByRole('button', { name: 'تعديل الجلسة' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'تسجيل القرار' })).toHaveLength(1);
});

it('tells the lawyer a case number is already used, in words that fix it, and keeps the draft', async () => {
  vi.mocked(bridge.caseUpdate).mockRejectedValue({
    code: 'CASE_NUMBER_TAKEN',
    message: 'safe',
    details: null,
  });
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click((await screen.findAllByRole('button', { name: 'تعديل' }))[0]);
  const dialog = await screen.findByRole('dialog');
  const number = within(dialog).getByLabelText('رقم الملف الداخلي');
  fireEvent.change(number, { target: { value: 'DEMO-DUPLICATE' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));

  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent('رقم القضية هذا مستخدم لقضية أخرى');
  expect(alert).not.toHaveTextContent('أعد المحاولة');
  expect(number).toHaveValue('DEMO-DUPLICATE');
});

it('archives an active case and restores an archived one', async () => {
  vi.mocked(bridge.caseArchive).mockResolvedValue({
    ...fixtures.caseItem,
    archivedAt: '2026-10-05T10:00:00',
  });
  vi.mocked(bridge.caseRestore).mockResolvedValue(fixtures.caseItem);
  const view = renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  // Archiving asks first; cancelling changes nothing.
  fireEvent.click(await screen.findByRole('button', { name: 'أرشفة' }));
  fireEvent.click(await screen.findByRole('button', { name: 'إلغاء' }));
  expect(bridge.caseArchive).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'أرشفة' }));
  fireEvent.click(await screen.findByRole('button', { name: 'أرشفة القضية' }));
  await waitFor(() =>
    expect(vi.mocked(bridge.caseArchive).mock.calls[0]?.[0]).toBe(fixtures.caseItem.id),
  );
  view.unmount();

  vi.mocked(bridge.caseGet).mockResolvedValue({
    ...fixtures.caseItem,
    archivedAt: '2026-10-05T10:00:00',
  });
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
  expect(await screen.findByText(/هذه القضية مؤرشفة/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'أرشفة' })).not.toBeInTheDocument();
  // Read-only until restored: no edit and no new hearing.
  expect(screen.queryByRole('button', { name: 'تعديل' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'إضافة جلسة' })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'استعادة' }));
  await waitFor(() =>
    expect(vi.mocked(bridge.caseRestore).mock.calls[0]?.[0]).toBe(fixtures.caseItem.id),
  );
});

it('saves the agreed fee and refuses an amount it cannot read', async () => {
  vi.mocked(bridge.feeAgreementSave).mockResolvedValue({
    caseId: fixtures.caseItem.id,
    amountMinor: 1550000,
  } as Awaited<ReturnType<typeof bridge.feeAgreementSave>>);
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click(await screen.findByRole('tab', { name: 'الحساب' }));
  const amount = await screen.findByLabelText(i18n.t('cases.detail.feeLabel'));
  const save = screen.getByRole('button', { name: i18n.t('cases.detail.feeSave') });

  fireEvent.change(amount, { target: { value: 'abc' } });
  fireEvent.click(save);
  expect(await screen.findByText(i18n.t('cases.detail.feeInvalid'))).toBeInTheDocument();
  expect(bridge.feeAgreementSave).not.toHaveBeenCalled();

  fireEvent.change(amount, { target: { value: '15,500.00' } });
  fireEvent.click(save);
  expect(await screen.findByText(i18n.t('cases.detail.feeSaved'))).toBeInTheDocument();
  expect(vi.mocked(bridge.feeAgreementSave).mock.calls[0]?.[0]).toEqual({
    caseId: fixtures.caseItem.id,
    amountMinor: 1550000,
  });
});

it('keeps the typed fee and says so when saving it fails', async () => {
  vi.mocked(bridge.feeAgreementSave).mockRejectedValue(fictionalFailure);
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click(await screen.findByRole('tab', { name: 'الحساب' }));
  const amount = await screen.findByLabelText(i18n.t('cases.detail.feeLabel'));
  fireEvent.change(amount, { target: { value: '9000' } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('cases.detail.feeSave') }));

  expect(await screen.findByText(i18n.t('cases.detail.feeSaveError'))).toBeInTheDocument();
  expect(screen.queryByText(i18n.t('cases.detail.feeSaved'))).not.toBeInTheDocument();
  expect(amount).toHaveValue('9000');
});

it('lists payments and expenses of the case and opens one for inspection', async () => {
  vi.mocked(bridge.paymentList).mockResolvedValue([
    {
      id: 'p-1',
      caseId: fixtures.caseItem.id,
      payerClientId: fixtures.client.id,
      amountMinor: 150000,
      paymentDate: '2026-10-01',
      paymentMethod: 'CASH',
      notes: 'دفعة تجريبية',
      createdAt: '2026-10-01T09:00:00',
      updatedAt: '2026-10-01T09:00:00',
    },
  ]);
  vi.mocked(bridge.expenseList).mockResolvedValue([
    {
      id: 'e-1',
      caseId: fixtures.caseItem.id,
      clientId: fixtures.client.id,
      amountMinor: 25000,
      expenseDate: '2026-10-02',
      expenseType: 'COURT_FEE',
      notes: 'رسم تجريبي',
      createdAt: '2026-10-02T09:00:00',
      updatedAt: '2026-10-02T09:00:00',
    },
  ]);
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click(await screen.findByRole('tab', { name: 'الحساب' }));
  expect(screen.queryByText(i18n.t('cases.detail.noPayments'))).not.toBeInTheDocument();
  expect(screen.queryByText(i18n.t('cases.detail.noExpenses'))).not.toBeInTheDocument();
  expect(
    await screen.findByText(fixtures.client.fullName, { selector: 'span' }),
  ).toBeInTheDocument();

  const rows = document.querySelectorAll<HTMLButtonElement>('.ledger-row');
  expect(rows).toHaveLength(2);
  fireEvent.click(rows[0]);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

it.each([
  ['en', 'DEMO Amal, DEMO Basma'],
  ['ar', 'DEMO Amal، DEMO Basma'],
])('separates two clients with the %s list separator', async (language, expected) => {
  await i18n.changeLanguage(language);
  const [first] = fixtures.caseItem.clients;
  vi.mocked(bridge.caseGet).mockResolvedValue({
    ...fixtures.caseItem,
    clients: [
      { ...first, fullName: 'DEMO Amal' },
      { ...first, clientId: 'demo-client-2', fullName: 'DEMO Basma' },
    ],
  });
  const presentation = {
    language: language as 'ar' | 'en',
    direction: language === 'ar' ? ('rtl' as const) : ('ltr' as const),
    dateLocale: language === 'ar' ? arEG : enUS,
    weekStartsOn: 6,
    dateFormat: 'dd/MM/yyyy' as const,
  };
  renderWorkflow(
    <LocalePresentationContext.Provider value={presentation}>
      <CaseDetailPage />
    </LocalePresentationContext.Provider>,
    `/cases/${fixtures.caseItem.id}`,
    '/cases/:id',
  );

  expect(await screen.findByText(expected)).toBeInTheDocument();
});

it.each([
  ['hearings', 'hearingList', 'noHearings'],
  ['tasks', 'taskList', 'noTasks'],
  ['account', 'paymentList', 'noPayments'],
  ['account', 'expenseList', 'noExpenses'],
] as const)(
  'does not treat a failed %s/%s read as an empty list, and retries only that section',
  async (tab, command, emptyKey) => {
    vi.mocked(bridge[command]).mockRejectedValueOnce(fictionalFailure).mockResolvedValue([]);
    renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
    fireEvent.click(await screen.findByRole('tab', { name: i18n.t(`cases.detail.tabs.${tab}`) }));
    const alert = await screen.findByRole('alert');
    expect(screen.queryByText(i18n.t(`cases.detail.${emptyKey}`))).not.toBeInTheDocument();
    if (tab === 'hearings')
      expect(screen.getByRole('button', { name: i18n.t('agenda.add') })).toBeDisabled();
    if (tab === 'tasks')
      expect(screen.getByRole('button', { name: i18n.t('tasks.add') })).toBeDisabled();
    if (command === 'paymentList')
      expect(
        screen.getByRole('button', { name: i18n.t('cases.detail.addPayment') }),
      ).toBeDisabled();
    if (command === 'expenseList')
      expect(
        screen.getByRole('button', { name: i18n.t('cases.detail.addExpense') }),
      ).toBeDisabled();
    const reads = [
      bridge.hearingList,
      bridge.taskList,
      bridge.paymentList,
      bridge.expenseList,
      bridge.financeCaseSummary,
    ];
    const before = reads.map((read) => vi.mocked(read).mock.calls.length);
    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('app.retry') }));
    expect(await screen.findByText(i18n.t(`cases.detail.${emptyKey}`))).toBeVisible();
    reads.forEach((read, index) => {
      expect(vi.mocked(read).mock.calls.length).toBe(
        before[index] + Number(read === bridge[command]),
      );
    });
  },
);

it.each([
  ['caseList', 'cases.title'],
  ['clientList', 'clients.title'],
] as const)(
  'recovers failed transaction choices from %s without refetching the ledgers',
  async (command, labelKey) => {
    vi.mocked(bridge[command]).mockRejectedValueOnce(fictionalFailure);
    renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
    fireEvent.click(await screen.findByRole('tab', { name: i18n.t('cases.detail.tabs.account') }));
    const payment = screen.getByRole('button', { name: i18n.t('cases.detail.addPayment') });
    const expense = screen.getByRole('button', { name: i18n.t('cases.detail.addExpense') });
    expect(payment).toBeDisabled();
    expect(expense).toBeDisabled();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      i18n.t('records.sectionLoadError', { section: i18n.t(labelKey) }),
    );
    const reads = [bridge.paymentList, bridge.expenseList, bridge.financeCaseSummary];
    const before = reads.map((read) => vi.mocked(read).mock.calls.length);
    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('app.retry') }));
    await waitFor(() => {
      expect(payment).not.toBeDisabled();
      expect(expense).not.toBeDisabled();
    });
    reads.forEach((read, index) => expect(vi.mocked(read).mock.calls.length).toBe(before[index]));
    fireEvent.click(payment);
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

it.each(['hearingList', 'taskList', 'paymentList', 'expenseList'] as const)(
  'shows loading instead of empty while the case %s read is pending',
  async (command) => {
    vi.mocked(bridge[command]).mockImplementation(() => new Promise<never[]>(() => {}));
    renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
    const tab =
      command === 'hearingList' ? 'hearings' : command === 'taskList' ? 'tasks' : 'account';
    fireEvent.click(await screen.findByRole('tab', { name: i18n.t(`cases.detail.tabs.${tab}`) }));
    expect(await screen.findByRole('status')).toBeVisible();
    const emptyKey =
      command === 'hearingList'
        ? 'noHearings'
        : command === 'taskList'
          ? 'noTasks'
          : command === 'paymentList'
            ? 'noPayments'
            : 'noExpenses';
    expect(screen.queryByText(i18n.t(`cases.detail.${emptyKey}`))).not.toBeInTheDocument();
  },
);

it('hides failed case totals, disables fee changes and retries the account', async () => {
  let reject!: (reason: unknown) => void;
  vi.mocked(bridge.financeCaseSummary)
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue({
      caseId: fixtures.caseItem.id,
      agreedFeeMinor: 300000,
      receivedMinor: 150000,
      outstandingMinor: 150000,
      expensesMinor: 25000,
      netCashMinor: 125000,
    });
  const { container } = renderWorkflow(
    <CaseDetailPage />,
    `/cases/${fixtures.caseItem.id}`,
    '/cases/:id',
  );
  fireEvent.click(await screen.findByRole('tab', { name: i18n.t('cases.detail.tabs.account') }));
  const input = screen.getByLabelText(i18n.t('cases.detail.feeLabel'));
  expect(input).toBeDisabled();
  expect(container.querySelector('.finance-summary')).toBeNull();
  await act(async () => reject(fictionalFailure));
  const alert = await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: i18n.t('cases.detail.feeSave') })).toBeDisabled();
  expect(bridge.feeAgreementSave).not.toHaveBeenCalled();
  fireEvent.click(within(alert).getByRole('button', { name: i18n.t('app.retry') }));
  expect(await screen.findByText(/3,000.00/)).toBeVisible();
  expect(input).toHaveValue('3000');
  expect(input).not.toBeDisabled();
});

it('does not present cached balances as current after a refetch fails and retains a dirty fee draft', async () => {
  const account = {
    caseId: fixtures.caseItem.id,
    agreedFeeMinor: 300000,
    receivedMinor: 100000,
    outstandingMinor: 200000,
    expensesMinor: 0,
    netCashMinor: 100000,
  };
  vi.mocked(bridge.financeCaseSummary).mockResolvedValue(account);
  const { container, queryClient } = renderWorkflow(
    <CaseDetailPage />,
    `/cases/${fixtures.caseItem.id}`,
    '/cases/:id',
  );
  fireEvent.click(await screen.findByRole('tab', { name: i18n.t('cases.detail.tabs.account') }));
  const input = await screen.findByLabelText(i18n.t('cases.detail.feeLabel'));
  await waitFor(() => expect(input).toHaveValue('3000'));
  fireEvent.change(input, { target: { value: '9000' } });
  vi.mocked(bridge.financeCaseSummary)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(account);
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['cases', fixtures.caseItem.id, 'account'] });
  });
  const alert = await screen.findByRole('alert');
  expect(container.querySelector('.finance-summary')).toBeNull();
  expect(input).toHaveValue('9000');
  expect(input).toBeDisabled();
  fireEvent.click(within(alert).getByRole('button', { name: i18n.t('app.retry') }));
  await waitFor(() => expect(input).not.toBeDisabled());
  expect(input).toHaveValue('9000');
});

it.each([false, true])(
  'offers permanent deletion only when the case is archived: %s',
  async (archived) => {
    vi.mocked(bridge.caseGet).mockResolvedValue({
      ...fixtures.caseItem,
      archivedAt: archived ? '2026-10-21T10:00:00Z' : null,
    });
    renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
    await screen.findByRole('button', { name: archived ? 'استعادة' : 'أرشفة' });
    expect(Boolean(screen.queryByRole('button', { name: i18n.t('deletion.title.case') }))).toBe(
      archived,
    );
  },
);
