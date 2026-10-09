import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    selectBackupForRestore: vi.fn(),
    restoreSelectedBackup: vi.fn(),
    status: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import i18n from '../../../i18n';
import { RestoreFromBackup } from './RestoreFromBackup';

const failure = (code: string) => ({ code, message: 'safe', details: null });

function renderRestore(props: Partial<React.ComponentProps<typeof RestoreFromBackup>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onRestored = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RestoreFromBackup onRestored={onRestored} {...props} />
    </QueryClientProvider>,
  );
  return { onRestored, queryClient, ...view };
}

async function chooseFile() {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }));
  return screen.findByRole('button', { name: i18n.t('restoreFrom.submit') });
}

describe.each(['en', 'ar'] as const)(
  'restoring a backup with its own credentials (%s)',
  (language) => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await i18n.changeLanguage(language);
      vi.mocked(bridge.selectBackupForRestore).mockResolvedValue({
        token: 'one-time',
        formatVersion: 2,
      });
      vi.mocked(bridge.restoreSelectedBackup).mockResolvedValue(undefined);
      vi.mocked(bridge.status).mockResolvedValue({
        initialized: true,
        unlocked: false,
        vaultState: 'LOCKED',
      });
    });

    it('restores with the backup password and never shows the file path', async () => {
      const { onRestored } = renderRestore();
      await chooseFile();
      fireEvent.change(screen.getByLabelText(i18n.t('restoreFrom.password')), {
        target: { value: 'a secure local password' },
      });
      fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.submit') }));

      await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
      expect(bridge.selectBackupForRestore).toHaveBeenCalledOnce();
      expect(bridge.restoreSelectedBackup).toHaveBeenCalledWith('one-time', {
        kind: 'password',
        secret: 'a secure local password',
      });
      // The vault is locked afterwards, so cached records are dropped and status is read again.
      expect(bridge.status).toHaveBeenCalled();
    });

    it('restores with the recovery key when that is chosen', async () => {
      const { onRestored } = renderRestore();
      await chooseFile();
      fireEvent.click(screen.getByLabelText(i18n.t('restoreFrom.optionRecoveryKey')));
      fireEvent.change(
        screen.getByLabelText(i18n.t('restoreFrom.recoveryKey'), {
          selector: 'input[type="text"]',
        }),
        {
          target: { value: 'ABCD-EF01' },
        },
      );
      fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.submit') }));

      await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
      expect(bridge.restoreSelectedBackup).toHaveBeenCalledWith('one-time', {
        kind: 'recoveryKey',
        secret: 'ABCD-EF01',
      });
    });

    it('asks for a value without calling the native layer when the secret is empty', async () => {
      const { onRestored } = renderRestore();
      await chooseFile();
      fireEvent.change(screen.getByLabelText(i18n.t('restoreFrom.password')), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.submit') }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        i18n.t('restoreFrom.secretRequired'),
      );
      expect(bridge.restoreSelectedBackup).not.toHaveBeenCalled();
      expect(onRestored).not.toHaveBeenCalled();
    });

    it.each([
      ['INVALID_PASSWORD', 'password'],
      ['RECOVERY_KEY_INVALID', 'recoveryKey'],
    ] as const)(
      'keeps the chosen file after %s so the secret can be retyped',
      async (code, kind) => {
        vi.mocked(bridge.restoreSelectedBackup)
          .mockRejectedValueOnce(failure(code))
          .mockResolvedValueOnce(undefined);
        const { onRestored } = renderRestore();
        await chooseFile();
        if (kind === 'recoveryKey')
          fireEvent.click(screen.getByLabelText(i18n.t('restoreFrom.optionRecoveryKey')));
        const input = screen.getByLabelText(i18n.t(`restoreFrom.${kind}`), {
          selector: kind === 'password' ? 'input[type="password"]' : 'input[type="text"]',
        });
        fireEvent.change(input, { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.submit') }));

        expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t(`errors.${code}`));
        expect(onRestored).not.toHaveBeenCalled();
        // No second file dialog: the same token is used for the retry.
        fireEvent.change(input, { target: { value: 'right' } });
        fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.submit') }));
        await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
        expect(bridge.selectBackupForRestore).toHaveBeenCalledOnce();
        expect(bridge.restoreSelectedBackup).toHaveBeenLastCalledWith('one-time', {
          kind,
          secret: 'right',
        });
      },
    );

    it.each([
      'BACKUP_CORRUPTED',
      'BACKUP_NEWER_VERSION',
      'BACKUP_KEY_MISMATCH',
      'VAULT_INTERRUPTED',
    ])(
      'explains %s, forgets the file and the secret, and asks for the file again',
      async (code) => {
        vi.mocked(bridge.restoreSelectedBackup).mockRejectedValueOnce(failure(code));
        const { onRestored } = renderRestore();
        await chooseFile();
        fireEvent.change(screen.getByLabelText(i18n.t('restoreFrom.password')), {
          target: { value: 'a secure local password' },
        });
        fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.submit') }));

        expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t(`errors.${code}`));
        expect(onRestored).not.toHaveBeenCalled();
        expect(screen.queryByLabelText(i18n.t('restoreFrom.password'))).not.toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }),
        ).toBeEnabled();
        expect(document.body.textContent).not.toContain('a secure local password');
      },
    );

    it('offers no credential form for a backup made by an older version', async () => {
      vi.mocked(bridge.selectBackupForRestore).mockResolvedValue({
        token: 'old',
        formatVersion: 1,
      });
      renderRestore();
      fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }));

      expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('restoreFrom.olderFormat'));
      expect(screen.queryByLabelText(i18n.t('restoreFrom.password'))).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: i18n.t('restoreFrom.chooseAnother') }),
      ).toBeEnabled();
    });

    it('stays quiet when the file dialog is cancelled and shows other picker failures', async () => {
      vi.mocked(bridge.selectBackupForRestore)
        .mockRejectedValueOnce(failure('OPERATION_CANCELLED'))
        .mockRejectedValueOnce(failure('BACKUP_CORRUPTED'));
      renderRestore();
      fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }));
      await waitFor(() => expect(bridge.selectBackupForRestore).toHaveBeenCalledOnce());
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }),
        ).toBeEnabled(),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: i18n.t('restoreFrom.chooseFile') }));
      expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.BACKUP_CORRUPTED'));
    });

    it('warns that the workspace is replaced only when one exists, and can be cancelled', () => {
      const onCancel = vi.fn();
      const { unmount } = renderRestore({ replacesWorkspace: true, onCancel });
      expect(screen.getByText(i18n.t('restoreFrom.replaceWarning'))).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
      expect(onCancel).toHaveBeenCalledOnce();
      unmount();
      renderRestore();
      expect(screen.queryByText(i18n.t('restoreFrom.replaceWarning'))).not.toBeInTheDocument();
    });
  },
);
