import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../bridge/commands', () => ({
  bridge: {
    status: vi.fn(),
    initialize: vi.fn(),
    unlock: vi.fn(),
    recover: vi.fn(),
    lock: vi.fn(),
    createBackup: vi.fn(),
    validateBackup: vi.fn(),
    restoreBackup: vi.fn(),
    settings: vi.fn(),
    updateSettings: vi.fn(),
    clientList: vi.fn(),
    caseList: vi.fn(),
    dashboardSummary: vi.fn(),
    refreshReminders: vi.fn(),
  },
}));
import { bridge } from '../bridge/commands';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { App } from './App';
import i18n, { applyDocumentDirection } from '../i18n';

describe('application gate', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ar');
    vi.clearAllMocks();
    // The QueryClient is a module-level singleton shared by every render in
    // this file; without clearing it, cached data from one test (e.g. an
    // "unlocked" app-status) leaks into the next test's fresh render.
    queryClient.clear();
    vi.mocked(bridge.status).mockResolvedValue({ initialized: false, unlocked: false });
    vi.mocked(bridge.settings).mockRejectedValue({
      code: 'APP_LOCKED',
      message: 'التطبيق مقفل.',
      details: null,
    });
    vi.mocked(bridge.clientList).mockResolvedValue([]);
    vi.mocked(bridge.caseList).mockResolvedValue([]);
    vi.mocked(bridge.dashboardSummary).mockResolvedValue({
      todayHearings: [],
      todayTasks: [],
      overdueTasks: [],
      upcomingHearings: [],
    });
  });

  it('starts with the Arabic secure onboarding form', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'جهّز مكتبك' })).toBeInTheDocument();
    expect(screen.getByLabelText('اسم المحامي')).toBeRequired();
  });

  it('shows a recoverable startup error when the native status command is unavailable', async () => {
    vi.mocked(bridge.status).mockRejectedValueOnce(new Error('IPC unavailable'));
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر بدء ليجال مصر');
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    await screen.findByRole('heading', { name: 'جهّز مكتبك' });
    expect(bridge.status).toHaveBeenCalledTimes(2);
  });

  it('displays the recovery key returned by vault initialization', async () => {
    vi.mocked(bridge.initialize).mockResolvedValue({ recoveryKey: 'test-recovery-key' });
    render(<App />);

    fireEvent.change(await screen.findByLabelText('اسم المحامي'), {
      target: { value: 'محامٍ تجريبي' },
    });
    fireEvent.change(screen.getByLabelText('كلمة المرور'), {
      target: { value: 'a secure local password' },
    });
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), {
      target: { value: 'a secure local password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'بدء الاستخدام' }).closest('form')!);

    expect(await screen.findByText('test-recovery-key')).toBeInTheDocument();
  });

  it('shows the lock form for an initialized vault', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: false });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'افتح ليجال مصر' })).toBeInTheDocument();
  });

  it('goes straight to the dashboard once unlocked, with no backup gate', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
    vi.mocked(bridge.settings).mockResolvedValue({
      language: 'ar',
      theme: 'system',
      dateFormat: 'dd/MM/yyyy',
      weekStartsOn: 6,
      defaultReminderMinutes: 60,
      autostartEnabled: false,
      lockTimeoutMinutes: 15,
      usageCountersEnabled: false,
    });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'اليوم' })).toBeInTheDocument();
    expect(screen.getByText('ليجال مصر')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'اليوم' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'المستندات' })).toHaveAttribute('href', '/attachments');
    expect(screen.getByRole('link', { name: 'النسخ الاحتياطي' })).toHaveAttribute(
      'href',
      '/backups',
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'system');
  });

  it('removes cached legal records from the renderer when the vault locks', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
    vi.mocked(bridge.settings).mockResolvedValue({
      language: 'ar',
      theme: 'system',
      dateFormat: 'dd/MM/yyyy',
      weekStartsOn: 6,
      defaultReminderMinutes: 60,
      autostartEnabled: false,
      lockTimeoutMinutes: 15,
      usageCountersEnabled: false,
    });
    vi.mocked(bridge.clientList).mockResolvedValue([
      {
        id: 'client-1',
        internalNumber: 'C-1',
        fullName: 'أحمد',
        primaryPhone: '01000000000',
        archivedAt: null,
      },
    ]);
    vi.mocked(bridge.lock).mockImplementation(async () => {
      vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: false });
    });

    render(<App />);
    await screen.findByRole('link', { name: 'أحمد' });
    expect(
      queryClient.getQueryCache().findAll({ queryKey: queryKeys.clients.all }),
    ).not.toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'قفل التطبيق' })[0]);

    expect(await screen.findByRole('heading', { name: 'افتح ليجال مصر' })).toBeInTheDocument();
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.clients.all })).toHaveLength(
      0,
    );
  });

  it('renders compact local record tables when summaries are available', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
    vi.mocked(bridge.settings).mockResolvedValue({
      language: 'ar',
      theme: 'system',
      dateFormat: 'dd/MM/yyyy',
      weekStartsOn: 6,
      defaultReminderMinutes: 60,
      autostartEnabled: false,
      lockTimeoutMinutes: 15,
      usageCountersEnabled: false,
    });
    vi.mocked(bridge.clientList).mockResolvedValue([
      {
        id: 'client-1',
        internalNumber: 'C-1',
        fullName: 'أحمد',
        primaryPhone: '01000000000',
        archivedAt: null,
      },
    ]);
    vi.mocked(bridge.caseList).mockResolvedValue([
      {
        id: 'case-1',
        internalNumber: '123',
        officialNumber: null,
        officialYear: 2026,
        status: 'ACTIVE',
        clientNames: ['أحمد'],
        archivedAt: null,
      },
    ]);

    render(<App />);

    await screen.findByRole('link', { name: 'أحمد' });
    expect(screen.getByRole('link', { name: 'أحمد' })).toHaveAttribute('href', '/clients/client-1');
    expect(screen.getByRole('link', { name: '123' })).toHaveAttribute('href', '/cases/case-1');
  });

  it('keeps dashboard empty states compact when local record lists are empty', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
    vi.mocked(bridge.settings).mockResolvedValue({
      language: 'ar',
      theme: 'system',
      dateFormat: 'dd/MM/yyyy',
      weekStartsOn: 6,
      defaultReminderMinutes: 60,
      autostartEnabled: false,
      lockTimeoutMinutes: 15,
      usageCountersEnabled: false,
    });

    render(<App />);

    expect((await screen.findAllByText('الموكلون')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('القضايا').length).toBeGreaterThan(0);
  });

  it('mirrors the document direction with the selected interface language', () => {
    applyDocumentDirection('en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    applyDocumentDirection('ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
  });

  it('restores the saved interface language after the vault is unlocked', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
    vi.mocked(bridge.settings).mockResolvedValue({
      language: 'en',
      theme: 'system',
      dateFormat: 'dd/MM/yyyy',
      weekStartsOn: 6,
      defaultReminderMinutes: 60,
      autostartEnabled: false,
      lockTimeoutMinutes: 15,
      usageCountersEnabled: false,
    });
    render(<App />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'en'));
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    await i18n.changeLanguage('ar');
  });

  it('never calls settings_get while the vault is locked', async () => {
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: false });
    render(<App />);
    // settings_get requires an unlocked vault; calling it while locked used to
    // permanently poison the query cache (retry is disabled) with no later
    // trigger to retry after unlocking, which left destinations like the
    // backup directory stuck undefined forever.
    await screen.findByRole('heading', { name: 'افتح ليجال مصر' });
    expect(bridge.settings).not.toHaveBeenCalled();
  });
});

it('keeps the unlocked gate and records when the native lock fails', async () => {
  vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
  vi.mocked(bridge.settings).mockResolvedValue({
    language: 'ar',
    theme: 'light',
    dateFormat: 'yyyy-MM-dd',
    weekStartsOn: 6,
    defaultReminderMinutes: 60,
    autostartEnabled: false,
    lockTimeoutMinutes: 15,
    usageCountersEnabled: false,
  });
  vi.mocked(bridge.lock).mockRejectedValueOnce({
    code: 'OPERATION_FAILED',
    message: 'تعذر إتمام العملية.',
    details: null,
  });
  queryClient.clear();
  render(<App />);
  await screen.findByRole('heading', { name: 'اليوم' });
  queryClient.setQueryData(queryKeys.clients.list({}), [
    { id: 'fictional-client', fullName: 'موكل خيالي' },
  ]);
  fireEvent.click(screen.getAllByRole('button', { name: 'قفل التطبيق' })[0]);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'اليوم' })).toBeVisible();
  expect(queryClient.getQueryData(queryKeys.clients.list({}))).toBeDefined();
});
