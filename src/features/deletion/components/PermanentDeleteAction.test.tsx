import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import type { DeletionInput, DeletionTarget } from '@/bridge/types';
import i18n from '@/i18n';
import { prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { PermanentDeleteAction, DeletionCleanupAction } from './PermanentDeleteAction';
const targets: DeletionTarget[] = [
  { kind: 'client', id: 'c1' },
  { kind: 'case', id: 'k1' },
  { kind: 'all' },
];
const success = {
  failedManagedFiles: 0,
  failedVaultEntries: 0,
  resetComplete: false,
  backupCreated: true,
};
beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
  vi.mocked(bridge.deletionPreview).mockResolvedValue({
    token: 'native-capability',
    counts: { clients: 1, cases: 2, attachments: 3 },
    managedFiles: 3,
    vaultFiles: 5,
    confirmationWord: 'حذف',
  });
  vi.mocked(bridge.deletionCommit).mockResolvedValue(success);
  vi.mocked(bridge.deletionRetryCleanup).mockResolvedValue(success);
  vi.mocked(bridge.status).mockResolvedValue({
    initialized: false,
    unlocked: false,
    vaultState: 'EMPTY',
  });
});
async function review(target: DeletionTarget) {
  fireEvent.click(screen.getByRole('button', { name: i18n.t(`deletion.title.${target.kind}`) }));
  const dialog = await screen.findByRole('alertdialog');
  await within(dialog).findByLabelText(i18n.t('deletion.confirmation'));
  return dialog;
}
it.each(targets)('previews $kind deletion and cancels without destructive IPC', async (target) => {
  renderWorkflow(<PermanentDeleteAction target={target} />, '/record', '/record');
  const dialog = await review(target);
  expect(bridge.deletionPreview).toHaveBeenCalledWith(target, 'ar');
  expect(within(dialog).getByText(i18n.t('deletion.managedFiles'))).toBeVisible();
  expect(within(dialog).getByText(i18n.t('deletion.warning'))).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('forms.cancel') }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(bridge.deletionCommit).not.toHaveBeenCalled();
});
it.each(targets)(
  'requires matching text for $kind, then navigates and refreshes all affected caches',
  async (target) => {
    let submitted: DeletionInput | undefined;
    vi.mocked(bridge.deletionCommit).mockImplementation(async (input) => {
      submitted = { ...input };
      return success;
    });
    const { queryClient, invalidate } = renderWorkflow(
      <PermanentDeleteAction target={target} />,
      '/record',
      '/record',
    );
    queryClient.setQueryData(['clients', 'list'], [{ id: 'old' }]);
    queryClient.setQueryData(['search', 'old'], [{ id: 'old' }]);
    const dialog = await review(target);
    const button = within(dialog).getByRole('button', { name: i18n.t('deletion.confirmDelete') });
    const confirmation = within(dialog).getByLabelText(i18n.t('deletion.confirmation'));
    expect(button).toBeDisabled();
    fireEvent.change(confirmation, { target: { value: 'wrong' } });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(bridge.deletionCommit).not.toHaveBeenCalled();
    fireEvent.change(confirmation, { target: { value: 'حذف' } });
    if (target.kind === 'all') {
      expect(button).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText(i18n.t('deletion.password')), {
        target: { value: 'a current password' },
      });
    }
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByText('تم الانتقال')).toBeVisible();
    expect(submitted).toEqual({
      target,
      token: 'native-capability',
      confirmation: 'حذف',
      password: target.kind === 'all' ? 'a current password' : '',
      backupFirst: true,
    });
    if (target.kind === 'all') {
      await waitFor(() => expect(queryClient.getQueryData(['clients', 'list'])).toBeUndefined());
      expect(queryClient.getQueryData(['search', 'old'])).toBeUndefined();
      expect(queryClient.getQueryData(['app-status'])).toEqual({
        initialized: false,
        unlocked: false,
        vaultState: 'EMPTY',
      });
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    } else {
      for (const key of [
        'clients',
        'cases',
        'powers-of-attorney',
        'hearings',
        'tasks',
        'payments',
        'expenses',
        'attachments',
        'search',
        'today',
        'agenda',
        'form-suggestions',
      ]) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
      }
    }
  },
);
it('does not offer confirmation when preview is refused and allows a new review', async () => {
  vi.mocked(bridge.deletionPreview).mockRejectedValueOnce({
    code: 'DELETION_SHARED_INTEGRITY',
    message: 'safe',
  });
  renderWorkflow(<PermanentDeleteAction target={targets[0]} />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.title.client') }));
  expect(await screen.findByText(i18n.t('errors.DELETION_SHARED_INTEGRITY'))).toBeVisible();
  expect(screen.queryByLabelText(i18n.t('deletion.confirmation'))).not.toBeInTheDocument();
  expect(bridge.deletionCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.reviewAgain') }));
  expect(await screen.findByLabelText(i18n.t('deletion.confirmation'))).toBeVisible();
});
it('clears the current password after authentication failure without retaining it in mutations', async () => {
  vi.mocked(bridge.deletionCommit).mockRejectedValueOnce({
    code: 'INVALID_PASSWORD',
    message: 'safe',
  });
  const { queryClient } = renderWorkflow(<PermanentDeleteAction target={{ kind: 'all' }} />);
  const dialog = await review({ kind: 'all' });
  fireEvent.change(within(dialog).getByLabelText(i18n.t('deletion.confirmation')), {
    target: { value: 'حذف' },
  });
  const password = within(dialog).getByLabelText(i18n.t('deletion.password'));
  fireEvent.change(password, { target: { value: 'wrong password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.confirmDelete') }));
  expect(await screen.findByText(i18n.t('errors.INVALID_PASSWORD'))).toBeVisible();
  expect(password).toHaveValue('');
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
});
it('reports committed deletion with failed file counts, then retries cleanup without deleting records twice', async () => {
  vi.mocked(bridge.deletionCommit).mockResolvedValueOnce({ ...success, failedManagedFiles: 2 });
  renderWorkflow(<PermanentDeleteAction target={targets[1]} />, '/record', '/record');
  const dialog = await review(targets[1]);
  fireEvent.change(within(dialog).getByLabelText(i18n.t('deletion.confirmation')), {
    target: { value: 'حذف' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.confirmDelete') }));
  expect(
    await within(dialog).findByText(i18n.t('deletion.fileFailure', { count: 2, entries: 0 })),
  ).toBeVisible();
  expect(screen.queryByText('تم الانتقال')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.retryFiles') }));
  expect(await screen.findByText('تم الانتقال')).toBeVisible();
  expect(bridge.deletionCommit).toHaveBeenCalledTimes(1);
  expect(bridge.deletionRetryCleanup).toHaveBeenCalledTimes(1);
});
it('uses the English confirmation word and submits the optional backup choice', async () => {
  await i18n.changeLanguage('en');
  vi.mocked(bridge.deletionPreview).mockResolvedValueOnce({
    token: 'english',
    counts: { cases: 1 },
    managedFiles: 0,
    vaultFiles: 0,
    confirmationWord: 'DELETE',
  });
  renderWorkflow(<PermanentDeleteAction target={targets[1]} />, '/record', '/record');
  const dialog = await review(targets[1]);
  expect(bridge.deletionPreview).toHaveBeenCalledWith(targets[1], 'en');
  fireEvent.change(within(dialog).getByLabelText('Deletion confirmation'), {
    target: { value: 'DELETE' },
  });
  fireEvent.click(
    within(dialog).getByRole('checkbox', { name: 'Create an encrypted backup first' }),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));
  await screen.findByText('تم الانتقال');
  expect(bridge.deletionCommit).toHaveBeenCalledWith(
    expect.objectContaining({ confirmation: 'DELETE', backupFirst: false }),
  );
});
it('keeps persistent pending-file cleanup available after reopening Settings', async () => {
  renderWorkflow(<DeletionCleanupAction />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.retryFiles') }));
  expect(await screen.findByText(i18n.t('deletion.cleanupComplete'))).toBeVisible();
  expect(bridge.deletionCommit).not.toHaveBeenCalled();
});

it('invalidates an expired preview and requires a new review before retrying', async () => {
  vi.mocked(bridge.deletionCommit).mockRejectedValueOnce({
    code: 'DELETION_PREVIEW_EXPIRED',
    message: 'safe',
  });
  renderWorkflow(<PermanentDeleteAction target={targets[0]} />);
  const dialog = await review(targets[0]);
  fireEvent.change(within(dialog).getByLabelText(i18n.t('deletion.confirmation')), {
    target: { value: 'حذف' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.confirmDelete') }));
  expect(await screen.findByText(i18n.t('errors.DELETION_PREVIEW_EXPIRED'))).toBeVisible();
  expect(
    screen.queryByRole('button', { name: i18n.t('deletion.confirmDelete') }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.reviewAgain') }));
  await within(dialog).findByLabelText(i18n.t('deletion.confirmation'));
  expect(bridge.deletionPreview).toHaveBeenCalledTimes(2);
});
it('keeps the reset preview after the backup picker is canceled and clears the password', async () => {
  vi.mocked(bridge.deletionCommit).mockRejectedValueOnce({
    code: 'OPERATION_CANCELLED',
    message: 'safe',
  });
  renderWorkflow(<PermanentDeleteAction target={{ kind: 'all' }} />, '/record', '/record');
  const dialog = await review({ kind: 'all' });
  fireEvent.change(within(dialog).getByLabelText(i18n.t('deletion.confirmation')), {
    target: { value: 'حذف' },
  });
  const password = within(dialog).getByLabelText(i18n.t('deletion.password'));
  fireEvent.change(password, { target: { value: 'correct password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.confirmDelete') }));
  await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'false'));
  expect(password).toHaveValue('');
  expect(screen.queryByText('تم الانتقال')).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
});
