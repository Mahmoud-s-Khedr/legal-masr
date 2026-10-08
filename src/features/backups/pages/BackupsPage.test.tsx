import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../lib/queryKeys';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    createBackup: vi.fn(),
    latestSuccessfulBackup: vi.fn(),
    restoreBackup: vi.fn(),
    status: vi.fn(),
    validateBackup: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import '../../../i18n';
import { BackupSettingsPanel } from './BackupsPage';

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <BackupSettingsPanel />
    </QueryClientProvider>,
  );

  return { queryClient, ...view };
}

describe('BackupSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue(null);
    vi.mocked(bridge.createBackup).mockResolvedValue('backup-token');
    vi.mocked(bridge.validateBackup).mockResolvedValue(undefined);
    vi.mocked(bridge.restoreBackup).mockResolvedValue(undefined);
    vi.mocked(bridge.status).mockResolvedValue({
      initialized: true,
      unlocked: false,
      vaultState: 'LOCKED',
    });
  });

  it('shows a loading state while the latest backup record is requested', () => {
    vi.mocked(bridge.latestSuccessfulBackup).mockImplementation(() => new Promise(() => undefined));

    renderPanel();

    expect(screen.getByLabelText('جارٍ تحميل آخر نسخة…')).toBeInTheDocument();
  });

  it('shows the latest successful backup metadata', async () => {
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue({
      completedAt: '2026-10-04 09:30',
      archiveSizeBytes: 12_345,
    });

    renderPanel();

    expect(await screen.findByText(/4 أكتوبر 2026/)).toBeInTheDocument();
    expect(screen.getByText(/12 ك\.ب/)).toBeInTheDocument();
  });

  it('explains when no successful backup exists', async () => {
    renderPanel();

    expect(await screen.findByText('لا توجد نسخة احتياطية ناجحة بعد.')).toBeInTheDocument();
    expect(screen.getByText('لم تُنشئ أي نسخة احتياطية بعد. أنشئ أول نسخة الآن.')).toBeVisible();
    expect(screen.getByText(/فلاشة أو قرص خارجي/)).toBeVisible();
  });

  it('reports successful and failed backup creation', async () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن' }));
    expect(await screen.findByText('تم إنشاء النسخة الاحتياطية بنجاح.')).toBeInTheDocument();

    vi.mocked(bridge.createBackup).mockRejectedValueOnce('تعذر إنشاء النسخة الاحتياطية.');
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <BackupSettingsPanel />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن' }));

    expect(await screen.findByText('تعذر إنشاء النسخة الاحتياطية.')).toBeInTheDocument();
  });

  it('reports successful and failed backup validation', async () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف للفحص' }));
    expect(await screen.findByText('الملف سليم ويمكن الاستعادة منه.')).toBeInTheDocument();

    vi.mocked(bridge.validateBackup).mockRejectedValueOnce(new Error('corrupted'));
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <BackupSettingsPanel />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف للفحص' }));

    expect(
      await screen.findByText('الملف تالف، أو ليس نسخة احتياطية من ليجال مصر.'),
    ).toBeInTheDocument();
  });

  it('does not restore when the confirmation dialog is cancelled', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'استعادة من نسخة احتياطية' }));
    expect(await screen.findByText(/تستبدل الاستعادة بياناتك الحالية/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));

    expect(bridge.restoreBackup).not.toHaveBeenCalled();
  });

  it('clears cached vault data and refetches status after a confirmed restore', async () => {
    const { queryClient } = renderPanel();
    queryClient.setQueryData(queryKeys.clients.list({}), [{ id: 'stale-client' }]);

    fireEvent.click(screen.getByRole('button', { name: 'استعادة من نسخة احتياطية' }));
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد الاستعادة' }));

    await waitFor(() => expect(bridge.restoreBackup).toHaveBeenCalledOnce());
    await waitFor(() => expect(bridge.status).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(queryKeys.clients.list({}))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.appStatus)).toEqual({
      initialized: true,
      unlocked: false,
      vaultState: 'LOCKED',
    });
  });

  it('keeps an understandable error visible when restore fails', async () => {
    vi.mocked(bridge.restoreBackup).mockRejectedValueOnce({
      code: 'BACKUP_CORRUPTED',
      message: 'ملف النسخة الاحتياطية تالف.',
      details: null,
    });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'استعادة من نسخة احتياطية' }));
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد الاستعادة' }));

    expect(await screen.findByText(/ملف النسخة الاحتياطية تالف/)).toBeInTheDocument();
    expect(bridge.status).not.toHaveBeenCalled();
  });
});
