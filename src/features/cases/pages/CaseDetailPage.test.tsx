import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

  fireEvent.click(await screen.findByRole('button', { name: 'أرشفة' }));
  await waitFor(() =>
    expect(vi.mocked(bridge.caseArchive).mock.calls[0]?.[0]).toBe(fixtures.caseItem.id),
  );
  view.unmount();

  vi.mocked(bridge.caseGet).mockResolvedValue({
    ...fixtures.caseItem,
    archivedAt: '2026-10-05T10:00:00',
  });
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
  expect(screen.queryByRole('button', { name: 'أرشفة' })).not.toBeInTheDocument();
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
