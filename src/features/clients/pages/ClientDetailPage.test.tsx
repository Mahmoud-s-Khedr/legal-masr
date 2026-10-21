import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { ClientDetailPage } from './ClientDetailPage';

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});

it('tells the lawyer a client number is already used, in words that fix it, and keeps the draft', async () => {
  vi.mocked(bridge.clientUpdate).mockRejectedValue({
    code: 'CLIENT_NUMBER_TAKEN',
    message: 'safe',
    details: null,
  });
  renderWorkflow(<ClientDetailPage />, `/clients/${fixtures.client.id}`, '/clients/:id');

  fireEvent.click((await screen.findAllByRole('button', { name: 'تعديل' }))[0]);
  const dialog = await screen.findByRole('dialog');
  const number = within(dialog).getByLabelText('الرقم الداخلي');
  fireEvent.change(number, { target: { value: 'DEMO-DUPLICATE' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));

  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent('رقم الموكل هذا مستخدم لموكل آخر');
  expect(alert).not.toHaveTextContent('أعد المحاولة');
  expect(number).toHaveValue('DEMO-DUPLICATE');
});

it('shows the phone as copyable text, never as a link that would navigate the window away', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  vi.mocked(bridge.clientGet).mockResolvedValue({
    ...fixtures.client,
    primaryPhone: '01000000009',
  });
  const { container } = renderWorkflow(
    <ClientDetailPage />,
    `/clients/${fixtures.client.id}`,
    '/clients/:id',
  );

  fireEvent.click(await screen.findByRole('button', { name: 'نسخ رقم الهاتف' }));

  expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  expect(writeText).toHaveBeenCalledWith('01000000009');
  expect(await screen.findByText('تم النسخ')).toBeInTheDocument();
});

it('reports a failed copy instead of pretending it worked', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    configurable: true,
  });
  document.execCommand = vi.fn().mockReturnValue(false);
  vi.mocked(bridge.clientGet).mockResolvedValue({
    ...fixtures.client,
    primaryPhone: '01000000009',
  });
  renderWorkflow(<ClientDetailPage />, `/clients/${fixtures.client.id}`, '/clients/:id');

  fireEvent.click(await screen.findByRole('button', { name: 'نسخ رقم الهاتف' }));

  expect(await screen.findByText('تعذر النسخ')).toBeInTheDocument();
});

it.each([
  ['cases', 'caseList', 'casesTitle', 'noCases'],
  ['poas', 'powerOfAttorneyList', 'poasTitle', 'noPoas'],
] as const)(
  'separates loading, failed and successfully empty client %s reads',
  async (tab, command, labelKey, emptyKey) => {
    let resolve!: (value: never[]) => void;
    vi.mocked(bridge[command]).mockImplementationOnce(
      () =>
        new Promise<never[]>((done) => {
          resolve = done;
        }),
    );
    renderWorkflow(<ClientDetailPage />, `/clients/${fixtures.client.id}`, '/clients/:id');
    fireEvent.click(await screen.findByRole('tab', { name: i18n.t(`clients.detail.tabs.${tab}`) }));
    const label = i18n.t(`clients.detail.${labelKey}`);
    expect(
      await screen.findByRole('status', {
        name: i18n.t('records.sectionLoading', { section: label }),
      }),
    ).toBeVisible();
    expect(screen.queryByText(i18n.t(`clients.detail.${emptyKey}`))).not.toBeInTheDocument();
    await act(async () => resolve([]));
    expect(await screen.findByText(i18n.t(`clients.detail.${emptyKey}`))).toBeVisible();
  },
);

it.each([
  ['cases', 'caseList', 'casesTitle', 'noCases'],
  ['poas', 'powerOfAttorneyList', 'poasTitle', 'noPoas'],
] as const)(
  'shows a failed %s read with a working section retry, never an empty result',
  async (tab, command, labelKey, emptyKey) => {
    vi.mocked(bridge[command])
      .mockRejectedValueOnce({ code: 'OPERATION_FAILED' })
      .mockResolvedValue([]);
    renderWorkflow(<ClientDetailPage />, `/clients/${fixtures.client.id}`, '/clients/:id');
    fireEvent.click(await screen.findByRole('tab', { name: i18n.t(`clients.detail.tabs.${tab}`) }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(
      i18n.t('records.sectionLoadError', { section: i18n.t(`clients.detail.${labelKey}`) }),
    );
    expect(screen.queryByText(i18n.t(`clients.detail.${emptyKey}`))).not.toBeInTheDocument();
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('app.retry') }));
    expect(await screen.findByText(i18n.t(`clients.detail.${emptyKey}`))).toBeVisible();
  },
);

it('does not show a zero client balance while loading or after failure, and recovers on retry', async () => {
  let reject!: (reason: unknown) => void;
  vi.mocked(bridge.financeClientSummary)
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue({
      clientId: fixtures.client.id,
      receivedMinor: 1500000,
      expensesMinor: 25000,
      netCashMinor: 1475000,
    });
  const { container } = renderWorkflow(
    <ClientDetailPage />,
    `/clients/${fixtures.client.id}`,
    '/clients/:id',
  );
  fireEvent.click(await screen.findByRole('tab', { name: i18n.t('clients.detail.tabs.account') }));
  expect(
    await screen.findByRole('status', {
      name: i18n.t('records.sectionLoading', { section: i18n.t('clients.detail.tabs.account') }),
    }),
  ).toBeVisible();
  expect(container.querySelector('.finance-summary')).toBeNull();
  await act(async () => reject({ code: 'OPERATION_FAILED' }));
  const alert = await screen.findByRole('alert');
  expect(container.querySelector('.finance-summary')).toBeNull();
  fireEvent.click(within(alert).getByRole('button', { name: i18n.t('app.retry') }));
  expect(await screen.findByText(/15,000.00/)).toBeVisible();
});
