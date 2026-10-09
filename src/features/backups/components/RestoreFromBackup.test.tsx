import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../bridge/commands', () => ({
  bridge: {
    selectBackupForRestore: vi.fn(),
    prepareBackupRestore: vi.fn(),
    commitBackupRestore: vi.fn(),
    cancelBackupRestore: vi.fn(),
    status: vi.fn(),
  },
}));
import { bridge } from '../../../bridge/commands';
import i18n from '../../../i18n';
import { queryKeys } from '../../../lib/queryKeys';
import {
  clearRestoreNotice,
  restoredPasswordSource,
  restoreNoticePending,
} from '../../../lib/restoreNotice';
import { RestoreFromBackup } from './RestoreFromBackup';
const preview = {
  token: 'prepared',
  createdAt: '2026-10-10T10:00:00Z',
  documentCount: 3,
  passwordSource: 'backupPassword' as const,
};
const failure = (code: string) => ({ code, message: 'safe', details: null });
function mount(
  props: Partial<React.ComponentProps<typeof RestoreFromBackup>> = {},
  strict = false,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onRestored = vi.fn();
  const component = (
    <QueryClientProvider client={client}>
      <RestoreFromBackup onRestored={onRestored} {...props} />
    </QueryClientProvider>
  );
  return {
    client,
    onRestored,
    ...render(strict ? <StrictMode>{component}</StrictMode> : component),
  };
}
const click = (key: string) => fireEvent.click(screen.getByRole('button', { name: i18n.t(key) }));
const type = (key: string, value: string) =>
  fireEvent.change(screen.getByLabelText(i18n.t(key)), { target: { value } });
async function choose() {
  click('restoreFrom.chooseFile');
  await screen.findByText('office.lmsbackup');
}
async function prepare() {
  type('restoreFrom.password', 'a secure backup password');
  click('restoreFrom.prepare');
  await screen.findByRole('status');
}

describe.each(['ar', 'en'] as const)('canonical restore (%s)', (language) => {
  beforeEach(async () => {
    vi.resetAllMocks();
    clearRestoreNotice();
    await i18n.changeLanguage(language);
    vi.mocked(bridge.selectBackupForRestore).mockResolvedValue({
      token: 'selection',
      fileName: 'office.lmsbackup',
    });
    vi.mocked(bridge.prepareBackupRestore).mockResolvedValue(preview);
    vi.mocked(bridge.commitBackupRestore).mockResolvedValue(undefined);
    vi.mocked(bridge.cancelBackupRestore).mockResolvedValue(undefined);
    vi.mocked(bridge.status).mockResolvedValue({
      initialized: true,
      unlocked: false,
      vaultState: 'LOCKED',
    });
  });
  it('authenticates and previews without changing live data until confirmation', async () => {
    const { client, onRestored } = mount();
    client.setQueryData(queryKeys.clients.list({}), ['fictional']);
    await choose();
    await prepare();
    expect(bridge.prepareBackupRestore).toHaveBeenCalledWith('selection', {
      kind: 'password',
      secret: 'a secure backup password',
    });
    expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
    expect(client.getQueryData(queryKeys.clients.list({}))).toEqual(['fictional']);
    expect(screen.queryByLabelText(i18n.t('restoreFrom.password'))).toBeNull();
    click('backups.restoreConfirm');
    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    expect(bridge.commitBackupRestore).toHaveBeenCalledWith('prepared');
    expect(client.getQueryData(queryKeys.clients.list({}))).toBeUndefined();
    expect(restoreNoticePending()).toBe(true);
    expect(restoredPasswordSource()).toBe('backupPassword');
  });
  it('requires matching new passwords with recovery-key authentication', async () => {
    mount();
    await choose();
    fireEvent.click(screen.getByLabelText(i18n.t('restoreFrom.optionRecoveryKey')));
    type('restoreFrom.recoveryKey', 'ABCD-EF01');
    type('restoreFrom.newPassword', 'short');
    type('restoreFrom.confirmPassword', 'short');
    click('restoreFrom.prepare');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n.t('restoreFrom.passwordMismatch'),
    );
    expect(bridge.prepareBackupRestore).not.toHaveBeenCalled();
    type('restoreFrom.newPassword', 'a new recovery password');
    type('restoreFrom.confirmPassword', 'a new recovery password');
    click('restoreFrom.prepare');
    await screen.findByRole('status');
    expect(bridge.prepareBackupRestore).toHaveBeenCalledWith('selection', {
      kind: 'recoveryKey',
      secret: 'ABCD-EF01',
      newPassword: 'a new recovery password',
      confirmPassword: 'a new recovery password',
    });
    expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
  });
  it('validates an empty secret locally', async () => {
    mount();
    await choose();
    type('restoreFrom.password', '   ');
    click('restoreFrom.prepare');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n.t('restoreFrom.secretRequired'),
    );
    expect(bridge.prepareBackupRestore).not.toHaveBeenCalled();
  });
  it('retains selection after wrong authentication and clears credentials before retry', async () => {
    vi.mocked(bridge.prepareBackupRestore).mockRejectedValueOnce(failure('INVALID_PASSWORD'));
    mount();
    await choose();
    type('restoreFrom.password', 'wrong');
    click('restoreFrom.prepare');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.INVALID_PASSWORD'));
    expect(screen.getByLabelText(i18n.t('restoreFrom.password'))).toHaveValue('');
    await prepare();
    expect(bridge.selectBackupForRestore).toHaveBeenCalledOnce();
  });
  it.each([
    'BACKUP_CORRUPTED',
    'BACKUP_NEWER_VERSION',
    'RECOVERY_KEY_INVALID',
    'VALIDATION_FAILED',
    'OPERATION_BUSY',
  ])('explains %s while keeping replacement uncommitted', async (code) => {
    vi.mocked(bridge.prepareBackupRestore).mockRejectedValueOnce(failure(code));
    mount();
    await choose();
    type('restoreFrom.password', 'secret');
    click('restoreFrom.prepare');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t(`errors.${code}`));
    expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
  });
  it('stays quiet on native cancellation and rejects unsupported backups', async () => {
    vi.mocked(bridge.selectBackupForRestore)
      .mockRejectedValueOnce(failure('OPERATION_CANCELLED'))
      .mockRejectedValueOnce(failure('BACKUP_CORRUPTED'));
    mount();
    click('restoreFrom.chooseFile');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') })).toBeEnabled(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    click('restoreFrom.chooseFile');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.BACKUP_CORRUPTED'));
  });
  it('uses the active key for validation without offering commit', async () => {
    mount({ useActiveKey: true, validateOnly: true });
    await choose();
    await screen.findByRole('status');
    expect(bridge.prepareBackupRestore).toHaveBeenCalledWith('selection');
    expect(screen.queryByRole('button', { name: i18n.t('backups.restoreConfirm') })).toBeNull();
    click('common.cancel');
    await waitFor(() => expect(bridge.cancelBackupRestore).toHaveBeenCalled());
    expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
  });
  it('offers credential authentication when the active key cannot open a foreign backup', async () => {
    vi.mocked(bridge.prepareBackupRestore).mockRejectedValueOnce(failure('BACKUP_KEY_MISMATCH'));
    mount({ useActiveKey: true });
    await choose();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n.t('errors.BACKUP_KEY_MISMATCH'),
    );
    await prepare();
    expect(bridge.prepareBackupRestore).toHaveBeenCalledTimes(2);
  });
  it('cancels prepared state and never commits it', async () => {
    const onCancel = vi.fn();
    mount({ onCancel });
    await choose();
    await prepare();
    click('common.cancel');
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    expect(bridge.cancelBackupRestore).toHaveBeenCalled();
    expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
  });
  it('clears cached legal data when the replacement journal is interrupted', async () => {
    vi.mocked(bridge.commitBackupRestore).mockRejectedValueOnce(failure('VAULT_INTERRUPTED'));
    vi.mocked(bridge.status).mockResolvedValue({
      initialized: true,
      unlocked: false,
      vaultState: 'INTERRUPTED',
    });
    const { client } = mount();
    client.setQueryData(queryKeys.clients.list({}), ['fictional']);
    await choose();
    await prepare();
    click('backups.restoreConfirm');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.VAULT_INTERRUPTED'));
    expect(client.getQueryData(queryKeys.clients.list({}))).toBeUndefined();
  });
  it('retains ordinary commit failure for retry', async () => {
    vi.mocked(bridge.commitBackupRestore).mockRejectedValueOnce(failure('OPERATION_FAILED'));
    const { onRestored } = mount();
    await choose();
    await prepare();
    click('backups.restoreConfirm');
    await screen.findByRole('alert');
    expect(onRestored).not.toHaveBeenCalled();
    expect(bridge.status).not.toHaveBeenCalled();
  });
  it('commits once for a double click', async () => {
    let finish!: () => void;
    vi.mocked(bridge.commitBackupRestore).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve();
        }),
    );
    const { onRestored } = mount();
    await choose();
    await prepare();
    click('backups.restoreConfirm');
    click('backups.restoreConfirm');
    expect(bridge.commitBackupRestore).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
  });
  it('rejects late preparation after unmount under StrictMode', async () => {
    let finish!: (value: typeof preview) => void;
    vi.mocked(bridge.prepareBackupRestore).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount, onRestored } = mount({}, true);
    await choose();
    type('restoreFrom.password', 'secret');
    click('restoreFrom.prepare');
    unmount();
    finish(preview);
    await waitFor(() => expect(bridge.cancelBackupRestore).toHaveBeenCalled());
    expect(onRestored).not.toHaveBeenCalled();
    expect(bridge.commitBackupRestore).not.toHaveBeenCalled();
  });
});
