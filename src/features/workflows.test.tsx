import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../bridge/commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('../bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(original.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '../bridge/commands';
import i18n from '../i18n';
import { fixtures, fictionalFailure, prepareWorkflowMocks, renderWorkflow } from '../test/workflow';
import { ClientListPage } from './clients/pages/ClientListPage';
import { ClientDetailPage } from './clients/pages/ClientDetailPage';
import { NewClientPage } from './clients/pages/NewClientPage';
import { CaseListPage } from './cases/pages/CaseListPage';
import { NewCasePage } from './cases/pages/NewCasePage';
import { CaseDetailPage } from './cases/pages/CaseDetailPage';
import { PowersOfAttorneyPage } from './powersOfAttorney/pages/PowersOfAttorneyPage';
import { PowerOfAttorneyDetailPage } from './powersOfAttorney/pages/PowerOfAttorneyDetailPage';
import { DashboardPage } from './dashboard/pages/DashboardPage';
import { AgendaPage } from './hearings/pages/AgendaPage';
import { TasksPage } from './tasks/pages/TasksPage';
import { CasePartiesPanel } from './cases/components/CasePartiesPanel';
import { AttachmentsPage } from './documents/pages/DocumentsPage';

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});
const lists = [
  {
    name: 'clients',
    Page: ClientListPage,
    method: 'clientList',
    text: fixtures.client.fullName,
    href: `/clients/${fixtures.client.id}`,
    loading: 'جارٍ تحميل الموكلين…',
    empty: 'لا يوجد موكلون بعد',
    filter: 'ابحث بالاسم أو الهاتف',
  },
  {
    name: 'cases',
    Page: CaseListPage,
    method: 'caseList',
    text: fixtures.caseItem.internalNumber,
    href: `/cases/${fixtures.caseItem.id}`,
    loading: 'جارٍ تحميل القضايا…',
    empty: 'لا توجد قضايا بعد',
    filter: 'ابحث برقم القضية أو المحكمة أو الموكل',
  },
  {
    name: 'powers',
    Page: PowersOfAttorneyPage,
    method: 'powerOfAttorneyList',
    text: fixtures.poa.internalSequence,
    href: `/powers-of-attorney/${fixtures.poa.id}`,
    loading: 'جارٍ تحميل التوكيلات…',
    empty: 'لا توجد توكيلات بعد',
    filter: 'ابحث برقم التوكيل أو الموكل أو مكتب التوثيق',
  },
] as const;
for (const row of lists)
  describe(`${row.name} list workflow`, () => {
    it('shows records, opens details and sends search/archive filters to the bridge', async () => {
      renderWorkflow(<row.Page />);
      const link = await screen.findByRole('link', { name: row.text });
      expect(link).toHaveAttribute('href', row.href);
      fireEvent.change(screen.getByPlaceholderText(row.filter), { target: { value: 'fictional' } });
      await waitFor(() =>
        expect(vi.mocked(bridge[row.method]).mock.calls.at(-1)?.[0]).toMatchObject({
          query: 'fictional',
        }),
      );
      fireEvent.click(screen.getByRole('checkbox'));
      await waitFor(() =>
        expect(vi.mocked(bridge[row.method]).mock.calls.at(-1)?.[0]).toMatchObject({
          includeArchived: true,
        }),
      );
    });
    it('shows loading rather than empty while the read is pending', () => {
      vi.mocked(bridge[row.method]).mockReturnValue(new Promise<never>(() => undefined));
      renderWorkflow(<row.Page />);
      expect(screen.getByLabelText(row.loading)).toBeVisible();
    });
    it('shows empty results', async () => {
      vi.mocked(bridge[row.method]).mockResolvedValue([]);
      renderWorkflow(<row.Page />);
      expect(await screen.findByText(row.empty)).toBeVisible();
    });
    it('reports a rejected read', async () => {
      vi.mocked(bridge[row.method]).mockRejectedValue(fictionalFailure);
      renderWorkflow(<row.Page />);
      expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل');
    });
  });
it('creates a client and invalidates the list', async () => {
  vi.mocked(bridge.clientCreate).mockResolvedValue(fixtures.client);
  const { invalidate } = renderWorkflow(<NewClientPage />, '/clients/new', '/clients/new');
  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'FICTIONAL-2' } });
  fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'موكل خيالي' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الموكل' }));
  expect(await screen.findByText('تم الانتقال')).toBeVisible();
  expect(invalidate).toHaveBeenCalled();
  expect(vi.mocked(bridge.clientCreate).mock.calls[0][0]).toMatchObject({
    internalNumber: 'FICTIONAL-2',
    fullName: 'موكل خيالي',
    confirmDuplicate: false,
  });
});
it('preserves a rejected client draft and explicitly confirms probable duplicates', async () => {
  vi.mocked(bridge.clientCreate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockRejectedValueOnce({
      code: 'CLIENT_PROBABLE_DUPLICATE',
      message: 'duplicate',
      details: [{ id: fixtures.client.id, fullName: fixtures.client.fullName, primaryPhone: null }],
    })
    .mockResolvedValue(fixtures.client);
  const { invalidate } = renderWorkflow(<NewClientPage />, '/clients/new', '/clients/new');
  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'FICTIONAL-3' } });
  fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'موكل خيالي' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الموكل' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('الاسم الكامل')).toHaveValue('موكل خيالي');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الموكل' }));
  fireEvent.click(await screen.findByRole('button', { name: 'إضافة الموكل رغم التشابه' }));
  await screen.findByText('تم الانتقال');
  expect(vi.mocked(bridge.clientCreate).mock.calls.at(-1)?.[0]).toMatchObject({
    confirmDuplicate: true,
    internalNumber: 'FICTIONAL-3',
  });
});
it('creates a case with its client relationship and retains a rejected draft', async () => {
  vi.mocked(bridge.caseCreate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.caseItem);
  const { invalidate } = renderWorkflow(<NewCasePage />, '/cases/new', '/cases/new');
  fireEvent.change(screen.getByLabelText('رقم الملف الداخلي'), {
    target: { value: 'FICTIONAL-CASE' },
  });
  fireEvent.click(await screen.findByRole('checkbox', { name: fixtures.client.fullName }));
  fireEvent.click(screen.getByRole('button', { name: 'حفظ القضية' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('رقم الملف الداخلي')).toHaveValue('FICTIONAL-CASE');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ القضية' }));
  await screen.findByText('تم الانتقال');
  expect(vi.mocked(bridge.caseCreate).mock.calls.at(-1)?.[0]).toMatchObject({
    clients: [{ clientId: fixtures.client.id }],
  });
  expect(invalidate).toHaveBeenCalled();
});
const details = [
  {
    Page: ClientDetailPage,
    path: `/clients/${fixtures.client.id}`,
    route: '/clients/:id',
    method: 'clientGet',
    archive: 'clientArchive',
    restore: 'clientRestore',
    item: fixtures.client,
    label: fixtures.client.fullName,
    confirm: 'أرشفة الموكل',
  },
  {
    Page: CaseDetailPage,
    path: `/cases/${fixtures.caseItem.id}`,
    route: '/cases/:id',
    method: 'caseGet',
    archive: 'caseArchive',
    restore: 'caseRestore',
    item: fixtures.caseItem,
    label: fixtures.caseItem.internalNumber,
    confirm: null,
  },
  {
    Page: PowerOfAttorneyDetailPage,
    path: `/powers-of-attorney/${fixtures.poa.id}`,
    route: '/powers-of-attorney/:id',
    method: 'powerOfAttorneyGet',
    archive: 'powerOfAttorneyArchive',
    restore: 'powerOfAttorneyRestore',
    item: fixtures.poa,
    label: fixtures.poa.internalSequence,
    confirm: 'أرشفة التوكيل',
  },
] as const;
for (const row of details)
  describe(`${row.method} detail`, () => {
    it('reads details and archives with query refresh', async () => {
      vi.mocked(bridge[row.archive]).mockResolvedValue(row.item as never);
      const { invalidate } = renderWorkflow(<row.Page />, row.path, row.route);
      await screen.findByRole('heading', { name: row.label });
      fireEvent.click(screen.getByRole('button', { name: 'أرشفة' }));
      if (row.confirm)
        fireEvent.click(
          within(await screen.findByRole('dialog')).getByRole('button', { name: row.confirm }),
        );
      await waitFor(() => expect(bridge[row.archive]).toHaveBeenCalled());
      expect(vi.mocked(bridge[row.archive]).mock.calls[0][0]).toBe(row.item.id);
      await waitFor(() => expect(invalidate).toHaveBeenCalled());
    });
    it('restores archived records and reports refusal without success invalidation', async () => {
      vi.mocked(bridge[row.method]).mockResolvedValue({
        ...row.item,
        archivedAt: '2026-10-03T09:00:00Z',
      } as never);
      vi.mocked(bridge[row.restore])
        .mockRejectedValueOnce(fictionalFailure)
        .mockResolvedValue(row.item as never);
      const { invalidate } = renderWorkflow(<row.Page />, row.path, row.route);
      fireEvent.click(await screen.findByRole('button', { name: 'استعادة' }));
      await screen.findByRole('alert');
      expect(invalidate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'استعادة' }));
      await waitFor(() => expect(invalidate).toHaveBeenCalled());
    });
    it('handles failed detail reads', async () => {
      vi.mocked(bridge[row.method]).mockRejectedValue(fictionalFailure);
      renderWorkflow(<row.Page />, row.path, row.route);
      expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل');
    });
  });
it('edits a client without losing rejected changes', async () => {
  vi.mocked(bridge.clientUpdate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.client);
  const { invalidate } = renderWorkflow(
    <ClientDetailPage />,
    `/clients/${fixtures.client.id}`,
    '/clients/:id',
  );
  fireEvent.click(await screen.findByRole('button', { name: 'تعديل' }));
  fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'تعديل خيالي' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByLabelText('الاسم الكامل')).toHaveValue('تعديل خيالي');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(invalidate).toHaveBeenCalled();
});
it('adds, edits and confirms removal of opponents and retains failed changes', async () => {
  vi.mocked(bridge.caseAddOpponent)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.caseItem.opponents[0]);
  vi.mocked(bridge.caseUpdateOpponent).mockResolvedValue(fixtures.caseItem.opponents[0]);
  vi.mocked(bridge.caseRemoveOpponent).mockResolvedValue(undefined);
  const { invalidate } = renderWorkflow(<CasePartiesPanel caseDto={fixtures.caseItem} />);
  fireEvent.click(screen.getByRole('button', { name: 'إضافة خصم' }));
  fireEvent.change(screen.getByLabelText('اسم الخصم'), { target: { value: 'خصم خيالي' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الخصم' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('اسم الخصم')).toHaveValue('خصم خيالي');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الخصم' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
  fireEvent.change(screen.getByLabelText('اسم الخصم'), { target: { value: 'خصم معدل' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الخصم' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(vi.mocked(bridge.caseUpdateOpponent).mock.calls[0][0]).toMatchObject({
    fullName: 'خصم معدل',
  });
  fireEvent.click(screen.getByRole('button', { name: 'إزالة' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'إلغاء' }));
  expect(bridge.caseRemoveOpponent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'إزالة' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'إزالة الخصم' }));
  await waitFor(() => expect(bridge.caseRemoveOpponent).toHaveBeenCalled());
});
describe('dashboard and agenda', () => {
  it('renders today/upcoming/overdue with record navigation', async () => {
    vi.mocked(bridge.dashboardSummary).mockResolvedValue({
      todayHearings: [fixtures.hearing],
      todayTasks: [fixtures.task],
      overdueTasks: [
        { ...fixtures.task, id: 'overdue', title: 'مهمة متأخرة خيالية', dueDate: '2026-10-01' },
      ],
      upcomingHearings: [{ ...fixtures.hearing, id: 'upcoming', hearingDate: '2026-10-10' }],
    });
    renderWorkflow(<DashboardPage />);
    expect(await screen.findByText('مهمة متأخرة خيالية')).toBeVisible();
    expect(screen.getByRole('link', { name: 'إضافة جلسة' })).toHaveAttribute(
      'href',
      '/calendar?create=hearing&date=2026-10-05',
    );
    expect(screen.getByRole('link', { name: 'إضافة مهمة' })).toHaveAttribute(
      'href',
      '/tasks?create=task&date=2026-10-05',
    );
    expect(screen.getByRole('link', { name: 'مهمة متأخرة خيالية' })).toHaveAttribute(
      'href',
      '/tasks?task=overdue',
    );
    const upcomingDate = document.querySelector('time[datetime="2026-10-10"]');
    expect(upcomingDate).toHaveTextContent('أكتوبر');
    expect(within(upcomingDate!.closest('li')!).getByRole('link')).toHaveAttribute(
      'href',
      '/calendar?hearing=upcoming',
    );
    expect(screen.getByText('متأخرة 4 أيام')).toBeVisible();
    expect(screen.getByRole('link', { name: fixtures.client.fullName })).toHaveAttribute(
      'href',
      `/clients/${fixtures.client.id}`,
    );
  });
  it('completes a task from Today and reports a rejected completion', async () => {
    vi.mocked(bridge.taskComplete)
      .mockRejectedValueOnce(fictionalFailure)
      .mockResolvedValue({ ...fixtures.task, completed: true });
    renderWorkflow(<DashboardPage />);
    const checkbox = await screen.findByRole('checkbox', {
      name: `إتمام ${fixtures.task.title}`,
    });
    fireEvent.click(checkbox);
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تغيير حالة المهمة');
    fireEvent.click(checkbox);
    await waitFor(() => expect(bridge.taskComplete).toHaveBeenCalledTimes(2));
    expect(vi.mocked(bridge.taskComplete).mock.calls[1][0]).toBe(fixtures.task.id);
  });
  it('shows loading and rejected reads', async () => {
    let reject!: (error: unknown) => void;
    vi.mocked(bridge.dashboardSummary).mockReturnValue(
      new Promise((_r, j) => {
        reject = j;
      }),
    );
    renderWorkflow(<DashboardPage />);
    expect(screen.getByRole('status')).toBeVisible();
    reject(fictionalFailure);
    expect(await screen.findByRole('alert')).toBeVisible();
  });
  it('renders an empty dashboard', async () => {
    vi.mocked(bridge.dashboardSummary).mockResolvedValue({
      todayHearings: [],
      todayTasks: [],
      overdueTasks: [],
      upcomingHearings: [],
    });
    renderWorkflow(<DashboardPage />);
    expect(await screen.findByText('لا توجد جلسات قادمة.')).toBeVisible();
  });
  it('filters the agenda by selected date', async () => {
    renderWorkflow(<AgendaPage />, '/calendar?date=2026-10-03');
    expect(await screen.findByRole('button', { name: 'تسجيل القرار' })).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'السبت، 3 أكتوبر 2026 — الجلسات: 1، المهام المفتوحة: 1، المكتملة: 0',
      }),
    ).toBeVisible();
  });
  it('opens the exact hearing requested by a deep link', async () => {
    renderWorkflow(<AgendaPage />, `/calendar?hearing=${fixtures.hearing.id}`);
    expect(await screen.findByRole('dialog', { name: 'تعديل الجلسة' })).toBeVisible();
  });
  it('reports an unavailable hearing deep link without opening another record', async () => {
    renderWorkflow(<AgendaPage />, '/calendar?hearing=deleted-hearing');
    expect(await screen.findByRole('alert')).toHaveTextContent('هذه الجلسة لم تعد موجودة');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('handles rejected agenda reads', async () => {
    vi.mocked(bridge.hearingList).mockRejectedValue(fictionalFailure);
    renderWorkflow(<AgendaPage />);
    expect(await screen.findByRole('alert')).toBeVisible();
  });
});
it('global documents disallow additions; case scope passes only the owner ID', async () => {
  renderWorkflow(<AttachmentsPage />, '/attachments?case=demo-case-14');
  await screen.findByText('لا توجد مستندات بعد.');
  expect(vi.mocked(bridge.attachmentList).mock.calls[0][0]).toEqual({
    caseId: 'demo-case-14',
    clientId: undefined,
    powerOfAttorneyId: undefined,
  });
});

it('creates a POA with multiple clients/lawyers and retains a rejected draft', async () => {
  vi.mocked(bridge.clientList).mockResolvedValue([
    fixtures.clientSummary,
    {
      ...fixtures.clientSummary,
      id: 'second-client',
      fullName: 'موكل خيالي ثانٍ',
      internalNumber: 'CL-SECOND',
    },
  ]);
  vi.mocked(bridge.powerOfAttorneyCreate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.poa);
  const { invalidate } = renderWorkflow(
    <PowersOfAttorneyPage />,
    '/powers-of-attorney',
    '/powers-of-attorney',
  );
  fireEvent.click(screen.getByRole('button', { name: 'إضافة توكيل' }));
  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'FICTIONAL-POA' } });
  for (const name of [fixtures.client.fullName, 'موكل خيالي ثانٍ'])
    fireEvent.click(await screen.findByRole('checkbox', { name }));
  for (const name of ['محامٍ خيالي أول', 'محامٍ خيالي ثانٍ']) {
    fireEvent.change(screen.getByLabelText('اسم المحامي'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: 'إضافة محامٍ' }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('الرقم الداخلي')).toHaveValue('FICTIONAL-POA');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));
  await screen.findByText('تم الانتقال');
  expect(vi.mocked(bridge.powerOfAttorneyCreate).mock.calls.at(-1)?.[0]).toMatchObject({
    clientIds: [fixtures.client.id, 'second-client'],
    lawyers: [{ fullName: 'محامٍ خيالي أول' }, { fullName: 'محامٍ خيالي ثانٍ' }],
  });
  expect(invalidate).toHaveBeenCalled();
});
it('edits a POA and displays client/lawyer relationships', async () => {
  vi.mocked(bridge.powerOfAttorneyUpdate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.poa);
  renderWorkflow(
    <PowerOfAttorneyDetailPage />,
    `/powers-of-attorney/${fixtures.poa.id}`,
    '/powers-of-attorney/:id',
  );
  fireEvent.click(await screen.findByRole('tab', { name: 'الموكلون' }));
  expect(screen.getByRole('link', { name: fixtures.client.fullName })).toHaveAttribute(
    'href',
    `/clients/${fixtures.client.id}`,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'المحامون' }));
  expect(screen.getByText(fixtures.poa.lawyers[0].fullName)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'POA-EDITED' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));
  await screen.findByText(/تعذر حفظ التوكيل/);
  expect(screen.getByLabelText('الرقم الداخلي')).toHaveValue('POA-EDITED');
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('edits a case while preserving its client and POA relationships', async () => {
  vi.mocked(bridge.caseUpdate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.caseItem);
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');
  fireEvent.click(await screen.findByRole('button', { name: 'تعديل' }));
  fireEvent.change(screen.getByLabelText('رقم الملف الداخلي'), {
    target: { value: 'CASE-EDITED' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('رقم الملف الداخلي')).toHaveValue('CASE-EDITED');
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(vi.mocked(bridge.caseUpdate).mock.calls.at(-1)?.[0]).toMatchObject({
    internalNumber: 'CASE-EDITED',
    clients: [
      { clientId: fixtures.client.id, powerOfAttorneyId: fixtures.poa.id, legalCapacity: 'أصيل' },
    ],
  });
});
it('creates/edits hearings and records a decision with a next hearing', async () => {
  vi.mocked(bridge.hearingCreate)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(fixtures.hearing);
  vi.mocked(bridge.hearingUpdate).mockResolvedValue(fixtures.hearing);
  vi.mocked(bridge.hearingRecordDecision).mockResolvedValue({
    hearing: fixtures.hearing,
    nextHearing: { ...fixtures.hearing, id: 'next', previousHearingId: fixtures.hearing.id },
  });
  const { invalidate } = renderWorkflow(
    <AgendaPage />,
    `/calendar?create=hearing&case=${fixtures.caseItem.id}&date=2026-10-03`,
  );
  fireEvent.change(await screen.findByLabelText('نوع الجلسة'), {
    target: { value: 'جلسة خيالية' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الجلسة' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('تعذر حفظ الجلسة.');
  expect(screen.getByLabelText('نوع الجلسة')).toHaveValue('جلسة خيالية');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الجلسة' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'تعديل الجلسة' }));
  fireEvent.change(screen.getByLabelText('نوع الجلسة'), { target: { value: 'جلسة معدلة' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الجلسة' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'تسجيل القرار' }));
  fireEvent.change(screen.getByLabelText('قرار الجلسة'), { target: { value: 'قرار خيالي' } });
  fireEvent.change(screen.getByLabelText('تاريخ الجلسة القادمة (إن أُجلت)'), {
    target: { value: '2026-10-10' },
  });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'تسجيل القرار' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(vi.mocked(bridge.hearingRecordDecision).mock.calls[0][0]).toMatchObject({
    id: fixtures.hearing.id,
    decisionText: 'قرار خيالي',
    nextHearing: { caseId: fixtures.caseItem.id, hearingDate: '2026-10-10' },
  });
});
it('opens an exact task from a deep link and accepts create context', async () => {
  renderWorkflow(
    <TasksPage />,
    `/tasks?task=${fixtures.task.id}&case=${fixtures.caseItem.id}&client=${fixtures.client.id}`,
  );
  expect(await screen.findByRole('dialog', { name: 'تفاصيل المهمة' })).toBeVisible();
});
it('reports an unavailable task deep link without opening another task', async () => {
  renderWorkflow(<TasksPage />, '/tasks?task=deleted-task');
  expect(await screen.findByRole('alert')).toHaveTextContent('هذه المهمة لم تعد موجودة');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('confirms hearing deletion, preserves refusals and refreshes after success', async () => {
  vi.mocked(bridge.hearingDelete)
    .mockRejectedValueOnce(fictionalFailure)
    .mockResolvedValue(undefined);
  const { invalidate } = renderWorkflow(<AgendaPage />, '/calendar?date=2026-10-03');
  fireEvent.click(await screen.findByRole('button', { name: 'حذف الجلسة' }));
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
  expect(bridge.hearingDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حذف الجلسة' }));
  fireEvent.click(screen.getByRole('button', { name: 'حذف الجلسة' }));
  await screen.findByRole('alert');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'حذف الجلسة' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(invalidate).toHaveBeenCalled();
});
it('does not submit a case when client choices fail to load', async () => {
  vi.mocked(bridge.clientList).mockRejectedValue(fictionalFailure);
  renderWorkflow(<NewCasePage />);
  fireEvent.change(screen.getByLabelText('رقم الملف الداخلي'), {
    target: { value: 'PRESERVED-CASE' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل الموكلين');
  expect(screen.getByLabelText('رقم الملف الداخلي')).toHaveValue('PRESERVED-CASE');
  expect(screen.getByRole('button', { name: 'حفظ القضية' })).toBeDisabled();
  expect(bridge.caseCreate).not.toHaveBeenCalled();
});
