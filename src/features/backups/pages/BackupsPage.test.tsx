import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../lib/queryKeys';
import { clearRestoreNotice, restoreNoticePending } from '../../../lib/restoreNotice';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    createBackup: vi.fn(),
    latestSuccessfulBackup: vi.fn(),
    saveBackupCopy: vi.fn(),
    revealBackup: vi.fn(),
    prepareBackupRestore: vi.fn(),
    commitBackupRestore: vi.fn(),
    cancelBackupRestore: vi.fn(),
    selectBackupForRestore: vi.fn(),
    status: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import i18n from '../../../i18n';
import { BackupSettingsPanel } from './BackupsPage';

const cancelled = { code: 'OPERATION_CANCELLED', message: 'cancelled', details: null };
const summary = {
  token: 'restore-token',
  fileName: 'LegalMasr-backup-2026-10-04-0930.lmsbackup',
  createdAt: '2026-10-04T09:30:00',
  documentCount: 3,
};

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

const createButton = () => screen.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن' });
const restoreButton = () => screen.getByRole('button', { name: i18n.t('backups.restore') });

describe('BackupSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRestoreNotice();
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue(null);
    vi.mocked(bridge.createBackup).mockResolvedValue('LegalMasr-backup-2026-10-08-1052.lmsbackup');
    vi.mocked(bridge.saveBackupCopy).mockResolvedValue(
      'LegalMasr-backup-2026-10-08-1052.lmsbackup',
    );
    vi.mocked(bridge.revealBackup).mockResolvedValue(undefined);
    vi.mocked(bridge.selectBackupForRestore).mockResolvedValue({
      token: 'choice',
      fileName: summary.fileName,
    });
    vi.mocked(bridge.prepareBackupRestore).mockResolvedValue({
      ...summary,
      passwordSource: 'currentPassword',
    });
    vi.mocked(bridge.commitBackupRestore).mockResolvedValue(undefined);
    vi.mocked(bridge.cancelBackupRestore).mockResolvedValue(undefined);
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

  it('explains when no successful backup exists, and offers no copy of nothing', async () => {
    renderPanel();

    expect(await screen.findByText('لا توجد نسخة احتياطية ناجحة بعد.')).toBeInTheDocument();
    expect(screen.getByText('لم تُنشئ أي نسخة احتياطية بعد. أنشئ أول نسخة الآن.')).toBeVisible();
    expect(screen.getByText(/فلاشة أو قرص خارجي/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'حفظ نسخة في مكان آخر…' })).toBeNull();
  });

  it('names the new backup after the local time and says where to take it next', async () => {
    renderPanel();

    fireEvent.click(createButton());
    expect(
      await screen.findByText('LegalMasr-backup-2026-10-08-1052.lmsbackup'),
    ).toBeInTheDocument();
    expect(vi.mocked(bridge.createBackup).mock.calls[0]?.[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/,
    );
    // Once a backup exists it can be copied off the computer straight away.
    expect(screen.getByRole('button', { name: 'حفظ نسخة في مكان آخر…' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'إظهار في المجلد' })).toBeEnabled();
  });

  it('reports a failed backup and allows a retry', async () => {
    vi.mocked(bridge.createBackup).mockRejectedValueOnce('تعذر إنشاء النسخة الاحتياطية.');
    renderPanel();

    fireEvent.click(createButton());
    expect(await screen.findByText('تعذر إنشاء النسخة الاحتياطية.')).toBeInTheDocument();

    fireEvent.click(createButton());
    await waitFor(() => expect(bridge.createBackup).toHaveBeenCalledTimes(2));
  });

  it('saves a copy elsewhere, shows the folder, and stays quiet when the dialog is closed', async () => {
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue({
      completedAt: '2026-10-04 09:30',
      archiveSizeBytes: 12_345,
    });
    vi.mocked(bridge.saveBackupCopy).mockRejectedValueOnce(cancelled);
    renderPanel();

    const save = await screen.findByRole('button', { name: 'حفظ نسخة في مكان آخر…' });
    fireEvent.click(save);
    await waitFor(() => expect(bridge.saveBackupCopy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(save);
    expect(await screen.findByText(/تم حفظ نسخة باسم/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'إظهار في المجلد' }));
    await waitFor(() => expect(bridge.revealBackup).toHaveBeenCalledTimes(1));
  });

  it('suggests saving a copy when the folder cannot be shown on this computer', async () => {
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue({
      completedAt: '2026-10-04 09:30',
      archiveSizeBytes: null,
    });
    vi.mocked(bridge.revealBackup).mockRejectedValueOnce({
      code: 'OPERATION_FAILED',
      message: 'safe',
      details: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'إظهار في المجلد' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.OPERATION_FAILED'));
  });

  it('says plainly when there is no backup file to copy', async () => {
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue({
      completedAt: '2026-10-04 09:30',
      archiveSizeBytes: null,
    });
    vi.mocked(bridge.saveBackupCopy).mockRejectedValueOnce({
      code: 'BACKUP_MISSING',
      message: 'safe',
      details: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'حفظ نسخة في مكان آخر…' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('لا توجد نسخة احتياطية بعد');
  });

  it.each(['restore', 'validate'] as const)(
    'uses the same preparation flow for %s',
    async (action) => {
      renderPanel();
      fireEvent.click(
        action === 'restore'
          ? restoreButton()
          : screen.getByRole('button', { name: i18n.t('backups.validate') }),
      );
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }),
      );
      expect(await within(dialog).findByRole('status')).toHaveTextContent('3');
      expect(bridge.prepareBackupRestore).toHaveBeenCalledWith('choice');
      if (action === 'validate')
        expect(
          within(dialog).queryByRole('button', { name: i18n.t('backups.restoreConfirm') }),
        ).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('common.cancel') }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
    },
  );
  it('restores the prepared token and clears vault caches', async () => {
    const { queryClient } = renderPanel();
    queryClient.setQueryData(queryKeys.clients.list({}), ['fictional']);
    fireEvent.click(restoreButton());
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('restoreFrom.chooseFile') }));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('backups.restoreConfirm') }));
    await waitFor(() => expect(bridge.commitBackupRestore).toHaveBeenCalledWith('restore-token'));
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.clients.list({}))).toBeUndefined(),
    );
    expect(restoreNoticePending()).toBe(true);
  });
  it('creates once on a double click and re-enables actions after completion', async () => {
    let finish!: () => void;
    vi.mocked(bridge.createBackup).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve('new.lmsbackup');
        }),
    );
    renderPanel();
    fireEvent.click(createButton());
    fireEvent.click(createButton());
    await waitFor(() => expect(bridge.createBackup).toHaveBeenCalledOnce());
    expect(restoreButton()).toBeDisabled();
    finish();
    expect(await screen.findByText('new.lmsbackup')).toBeVisible();
    fireEvent.click(createButton());
    await waitFor(() => expect(bridge.createBackup).toHaveBeenCalledTimes(2));
  });
});
