import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import type { DeletionTarget } from '@/bridge/types';
import i18n from '@/i18n';
import { prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { PermanentDeleteAction, DeletionCleanupAction } from './PermanentDeleteAction';
const targets: DeletionTarget[] = [
  { kind: 'client', id: 'c1' },
  { kind: 'case', id: 'k1' },
  { kind: 'all' },
];
const preview = {
  token: 'native-capability',
  counts: { clients: 1, cases: 2, attachments: 3 },
  managedFiles: 3,
  vaultFiles: 5,
};
const success = {
  failedManagedFiles: 0,
  failedVaultEntries: 0,
  resetComplete: false,
  backupCreated: false,
};
beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
  vi.mocked(bridge.deletionPreview).mockResolvedValue(preview);
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
  await waitFor(() => expect(deleteButton(dialog)).toBeEnabled());
  return dialog;
}
function deleteButton(dialog: HTMLElement) {
  return within(dialog).getByRole('button', { name: i18n.t('deletion.confirmDelete') });
}
it.each(targets)('previews $kind deletion and Cancel calls no destructive IPC', async (target) => {
  renderWorkflow(<PermanentDeleteAction target={target} />, '/record', '/record');
  const dialog = await review(target);
  expect(bridge.deletionPreview).toHaveBeenCalledWith(target);
  expect(within(dialog).getAllByRole('button')).toHaveLength(2);
  expect(dialog.querySelector('input[type="password"]')).toBeNull();
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  if (target.kind === 'all') {
    expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
  } else {
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
  }
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('forms.cancel') }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(bridge.deletionCommit).not.toHaveBeenCalled();
});
it.each(targets)(
  'one click on Delete commits $kind exactly once, navigates and refreshes affected caches',
  async (target) => {
    const { queryClient, invalidate } = renderWorkflow(
      <PermanentDeleteAction target={target} />,
      '/record',
      '/record',
    );
    queryClient.setQueryData(['clients', 'list'], [{ id: 'old' }]);
    queryClient.setQueryData(['search', 'old'], [{ id: 'old' }]);
    const dialog = await review(target);
    fireEvent.click(deleteButton(dialog));
    expect(await screen.findByText('تم الانتقال')).toBeVisible();
    expect(bridge.deletionCommit).toHaveBeenCalledTimes(1);
    expect(bridge.deletionCommit).toHaveBeenCalledWith({
      target,
      token: 'native-capability',
      backupFirst: false,
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
it.each(['ar', 'en'] as const)(
  'shows a compact count summary for each target in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    for (const target of targets) {
      const view = renderWorkflow(<PermanentDeleteAction target={target} />);
      const dialog = await review(target);
      const description = dialog.querySelector('[data-slot="alert-dialog-description"]');
      const numbers = new Intl.NumberFormat(
        language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn',
      );
      expect(description).toHaveTextContent(numbers.format(3));
      if (target.kind !== 'case') expect(description).toHaveTextContent(numbers.format(2));
      expect(description).toHaveTextContent(
        language === 'en' ? 'This cannot be undone.' : 'لا يمكن التراجع عن الحذف.',
      );
      if (target.kind === 'all') {
        expect(description).toHaveTextContent(numbers.format(1));
        expect(description).toHaveTextContent(
          language === 'en' ? 'entire workspace' : 'مساحة العمل بالكامل',
        );
        expect(description).toHaveTextContent(
          language === 'en'
            ? 'local backups and restore snapshots'
            : 'النسخ الاحتياطية المحلية ولقطات الاستعادة',
        );
      }
      view.unmount();
    }
  },
);
it('opens one dialog immediately and prevents commit while silently loading the native preview', async () => {
  let resolve!: (value: typeof preview) => void;
  vi.mocked(bridge.deletionPreview).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  renderWorkflow(<PermanentDeleteAction target={targets[0]} />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.title.client') }));
  const dialog = screen.getByRole('alertdialog');
  expect(deleteButton(dialog)).toBeDisabled();
  expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(deleteButton(dialog));
  expect(bridge.deletionCommit).not.toHaveBeenCalled();
  resolve(preview);
  await waitFor(() => expect(deleteButton(dialog)).toBeEnabled());
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
});
it.each(['DELETION_SHARED_INTEGRITY', 'DELETION_NOT_ARCHIVED', 'OPERATION_BUSY'])(
  'shows the existing localized %s preview refusal without offering deletion',
  async (code) => {
    vi.mocked(bridge.deletionPreview).mockRejectedValueOnce({ code, message: 'safe' });
    renderWorkflow(<PermanentDeleteAction target={targets[0]} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.title.client') }));
    expect(await screen.findByText(i18n.t(`errors.${code}`))).toBeVisible();
    expect(
      screen.queryByRole('button', { name: i18n.t('deletion.confirmDelete') }),
    ).not.toBeInTheDocument();
    expect(bridge.deletionCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.reviewAgain') }));
    await waitFor(() => expect(deleteButton(screen.getByRole('alertdialog'))).toBeEnabled());
  },
);
it('refuses duplicate clicks while commit is pending and displays a busy-operation error', async () => {
  let reject!: (error: unknown) => void;
  vi.mocked(bridge.deletionCommit).mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  renderWorkflow(<PermanentDeleteAction target={targets[0]} />);
  const dialog = await review(targets[0]);
  const button = deleteButton(dialog);
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(bridge.deletionCommit).toHaveBeenCalledTimes(1);
  reject({ code: 'OPERATION_BUSY', message: 'safe' });
  expect(await screen.findByText(i18n.t('errors.OPERATION_BUSY'))).toBeVisible();
  expect(button).toBeEnabled();
});
it('reports committed deletion with failed file counts, then retries cleanup without deleting records twice', async () => {
  vi.mocked(bridge.deletionCommit).mockResolvedValueOnce({ ...success, failedManagedFiles: 2 });
  renderWorkflow(<PermanentDeleteAction target={targets[1]} />, '/record', '/record');
  const dialog = await review(targets[1]);
  fireEvent.click(deleteButton(dialog));
  expect(
    await within(dialog).findByText(i18n.t('deletion.fileFailure', { count: 2, entries: 0 })),
  ).toBeVisible();
  expect(screen.queryByText('تم الانتقال')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.retryFiles') }));
  expect(await screen.findByText('تم الانتقال')).toBeVisible();
  expect(bridge.deletionCommit).toHaveBeenCalledTimes(1);
  expect(bridge.deletionRetryCleanup).toHaveBeenCalledTimes(1);
});
it('submits an explicitly selected workspace backup and resets the choice on reopening', async () => {
  renderWorkflow(<PermanentDeleteAction target={targets[2]} />, '/record', '/record');
  let dialog = await review(targets[2]);
  fireEvent.click(within(dialog).getByRole('checkbox'));
  expect(within(dialog).getByRole('checkbox')).toBeChecked();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('forms.cancel') }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  dialog = await review(targets[2]);
  expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(deleteButton(dialog));
  await screen.findByText('تم الانتقال');
  expect(bridge.deletionCommit).toHaveBeenCalledWith({
    target: targets[2],
    token: preview.token,
    backupFirst: true,
  });
});
it('keeps persistent pending-file cleanup available after reopening Settings', async () => {
  renderWorkflow(<DeletionCleanupAction />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('deletion.retryFiles') }));
  expect(await screen.findByText(i18n.t('deletion.cleanupComplete'))).toBeVisible();
  expect(bridge.deletionCommit).not.toHaveBeenCalled();
});
it('invalidates an expired preview and requires a new preview before retrying', async () => {
  vi.mocked(bridge.deletionCommit).mockRejectedValueOnce({
    code: 'DELETION_PREVIEW_EXPIRED',
    message: 'safe',
  });
  renderWorkflow(<PermanentDeleteAction target={targets[0]} />);
  const dialog = await review(targets[0]);
  fireEvent.click(deleteButton(dialog));
  expect(await screen.findByText(i18n.t('errors.DELETION_PREVIEW_EXPIRED'))).toBeVisible();
  expect(
    screen.queryByRole('button', { name: i18n.t('deletion.confirmDelete') }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('deletion.reviewAgain') }));
  await waitFor(() => expect(deleteButton(dialog)).toBeEnabled());
  expect(bridge.deletionPreview).toHaveBeenCalledTimes(2);
  expect(bridge.deletionCommit).toHaveBeenCalledTimes(1);
});
it.each(['OPERATION_CANCELLED', 'OPERATION_FAILED'])(
  'keeps the workspace preview and records on backup cancellation/failure (%s)',
  async (code) => {
    vi.mocked(bridge.deletionCommit).mockRejectedValueOnce({ code, message: 'safe' });
    renderWorkflow(<PermanentDeleteAction target={targets[2]} />, '/record', '/record');
    const dialog = await review(targets[2]);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(deleteButton(dialog));
    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'false'));
    expect(deleteButton(dialog)).toBeEnabled();
    expect(screen.queryByText('تم الانتقال')).not.toBeInTheDocument();
    if (code === 'OPERATION_CANCELLED') {
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    } else {
      expect(within(dialog).getByText(i18n.t('errors.OPERATION_FAILED'))).toBeVisible();
    }
  },
);
