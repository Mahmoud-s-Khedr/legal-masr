import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    inspectBackupToRestore: vi.fn(),
    restoreBackup: vi.fn(),
    status: vi.fn(),
    validateBackup: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import '../../../i18n';
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
const restoreButton = () => screen.getByRole('button', { name: 'اختيار نسخة للاستعادة…' });

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
    vi.mocked(bridge.validateBackup).mockResolvedValue({ ...summary, token: null });
    vi.mocked(bridge.inspectBackupToRestore).mockResolvedValue(summary);
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

  it('explains when no successful backup exists, and offers no copy of nothing', async () => {
    renderPanel();

    expect(await screen.findByText('لا توجد نسخة احتياطية ناجحة بعد.')).toBeInTheDocument();
    expect(screen.getByText('لم تُنشئ أي نسخة احتياطية بعد. أنشئ أول نسخة الآن.')).toBeVisible();
    expect(screen.getByText(/فلاشة أو قرص خارجي/)).toBeVisible();
    expect(screen.getByText(/أنشئ نسخة احتياطية أولًا/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'حفظ نسخة في مكان آخر…' })).toBeNull();
  });

  it('names the new backup after the local time and says where to take it next', async () => {
    renderPanel();

    fireEvent.click(createButton());
    expect(
      await screen.findByText(/«LegalMasr-backup-2026-10-08-1052\.lmsbackup».*فلاشة/),
    ).toBeInTheDocument();
    expect(vi.mocked(bridge.createBackup).mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}$/);
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

  it('describes a checked backup by its date and contents', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف للفحص' }));
    const status = await screen.findByText(/الملف سليم ويمكن الاستعادة منه/);
    expect(status).toHaveTextContent('4 أكتوبر 2026');
    expect(status).toHaveTextContent('3 مستندات');
  });

  it('stays quiet when the check is cancelled, and names damage only for a damaged file', async () => {
    vi.mocked(bridge.validateBackup)
      .mockRejectedValueOnce(cancelled)
      .mockRejectedValueOnce({ code: 'BACKUP_CORRUPTED', message: 'safe', details: null })
      .mockRejectedValueOnce({ code: 'BACKUP_FROM_OTHER_VAULT', message: 'safe', details: null });
    renderPanel();
    const check = screen.getByRole('button', { name: 'اختيار ملف للفحص' });

    fireEvent.click(check);
    await waitFor(() => expect(bridge.validateBackup).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(check).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/تالف/)).toBeNull();

    fireEvent.click(check);
    expect(await screen.findByRole('alert')).toHaveTextContent('تالف');

    fireEvent.click(check);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('من جهاز أو تثبيت آخر'),
    );
  });

  it('shows what a backup holds before restoring it, and cancelling changes nothing', async () => {
    renderPanel();

    fireEvent.click(restoreButton());
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('LegalMasr-backup-2026-10-04-0930.lmsbackup');
    expect(dialog).toHaveTextContent('4 أكتوبر 2026');
    expect(dialog).toHaveTextContent('3 مستندات');
    expect(dialog).toHaveTextContent('لن يظهر بعد الاستعادة');
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(bridge.restoreBackup).not.toHaveBeenCalled();
  });

  it('closing the restore picker shows nothing at all', async () => {
    vi.mocked(bridge.inspectBackupToRestore).mockRejectedValueOnce(cancelled);
    renderPanel();

    fireEvent.click(restoreButton());
    await waitFor(() => expect(bridge.inspectBackupToRestore).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(restoreButton()).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('restores the previewed backup, clears cached vault data and leaves a notice for the lock screen', async () => {
    const { queryClient } = renderPanel();
    queryClient.setQueryData(queryKeys.clients.list({}), [{ id: 'stale-client' }]);

    fireEvent.click(restoreButton());
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد الاستعادة' }));

    await waitFor(() => expect(bridge.restoreBackup).toHaveBeenCalledWith('restore-token'));
    await waitFor(() => expect(bridge.status).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(queryKeys.clients.list({}))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.appStatus)).toEqual({
      initialized: true,
      unlocked: false,
      vaultState: 'LOCKED',
    });
    expect(restoreNoticePending()).toBe(true);
  });

  it('keeps an understandable error visible when restore fails', async () => {
    vi.mocked(bridge.restoreBackup).mockRejectedValueOnce({
      code: 'BACKUP_CORRUPTED',
      message: 'ملف النسخة الاحتياطية تالف.',
      details: null,
    });
    renderPanel();

    fireEvent.click(restoreButton());
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد الاستعادة' }));

    expect(await screen.findByText(/ملف النسخة الاحتياطية تالف/)).toBeInTheDocument();
    expect(bridge.status).not.toHaveBeenCalled();
    expect(restoreNoticePending()).toBe(false);
  });

  it('creates one backup for a double click, and allows another once it has finished', async () => {
    let finish!: () => void;
    vi.mocked(bridge.createBackup).mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve('LegalMasr-backup.lmsbackup'))),
    );
    renderPanel();
    const create = createButton();

    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => expect(bridge.createBackup).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bridge.createBackup).toHaveBeenCalledTimes(1);

    finish();
    await screen.findByText(/تم إنشاء النسخة الاحتياطية/);
    fireEvent.click(createButton());
    await waitFor(() => expect(bridge.createBackup).toHaveBeenCalledTimes(2));
  });

  it('offers none of the actions while one of them is running, then all again', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(bridge.createBackup).mockImplementation(
      () => new Promise<string>((resolve) => (finish = () => resolve('LegalMasr.lmsbackup'))),
    );
    renderPanel();

    fireEvent.click(createButton());

    expect(await screen.findByRole('button', { name: 'جارٍ إنشاء النسخة…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'اختيار ملف للفحص' })).toBeDisabled();
    expect(restoreButton()).toBeDisabled();
    expect(bridge.validateBackup).not.toHaveBeenCalled();
    expect(bridge.inspectBackupToRestore).not.toHaveBeenCalled();

    finish();
    expect(await screen.findByRole('button', { name: 'إنشاء نسخة احتياطية الآن' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'اختيار ملف للفحص' })).toBeEnabled();
    expect(restoreButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'حفظ نسخة في مكان آخر…' })).toBeEnabled();
  });

  it('restores once when the confirmation is clicked twice', async () => {
    let finish!: () => void;
    vi.mocked(bridge.restoreBackup).mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve(undefined))),
    );
    renderPanel();
    fireEvent.click(restoreButton());
    const confirm = await screen.findByRole('button', { name: 'تأكيد الاستعادة' });

    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(bridge.restoreBackup).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bridge.restoreBackup).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(bridge.status).toHaveBeenCalled());
  });
});
