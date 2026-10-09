import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    status: vi.fn(),
    settings: vi.fn(),
    profile: vi.fn(),
    updateProfile: vi.fn(),
    updateSettings: vi.fn(),
    changePassword: vi.fn(),
    setAutostart: vi.fn(),
    replaceRecoveryKey: vi.fn(),
    saveRecoveryKey: vi.fn(),
    print: vi.fn(),
    latestSuccessfulBackup: vi.fn(),
    createBackup: vi.fn(),
    selectBackupForRestore: vi.fn(),
    prepareBackupRestore: vi.fn(),
    commitBackupRestore: vi.fn(),
    cancelBackupRestore: vi.fn(),
  },
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
}));

import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { bridge } from '../../../bridge/commands';
import i18n from '../../../i18n';
import { SettingsPage } from './SettingsPage';

const t = (key: string) => i18n.t(key);

const settings = {
  language: 'ar' as const,
  theme: 'system' as const,
  dateFormat: 'dd/MM/yyyy' as const,
  weekStartsOn: 6,
  defaultReminderMinutes: 60,
  autostartEnabled: false,
  lockTimeoutMinutes: 15,
  usageCountersEnabled: false,
};

const profile = {
  fullName: 'أحمد علي',
  barNumber: null,
  phone: null,
  officeAddress: null,
  defaultCurrency: 'EGP' as const,
};

function renderSettings(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage workflows', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await i18n.changeLanguage('ar');
    vi.mocked(bridge.status).mockResolvedValue({
      initialized: true,
      unlocked: true,
      vaultState: 'UNLOCKED',
    });
    vi.mocked(bridge.settings).mockResolvedValue(settings);
    vi.mocked(bridge.profile).mockResolvedValue(profile);
    vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue(null);
  });

  describe('office profile', () => {
    it('saves the edited profile, sending empty optional fields as null', async () => {
      vi.mocked(bridge.updateProfile).mockImplementation(async (value) => value);
      renderSettings('/settings');

      const name = await screen.findByLabelText(t('settings.profile.fullName'));
      await waitFor(() => expect(name).toHaveValue('أحمد علي'));
      fireEvent.change(name, { target: { value: 'سلمى حسن' } });
      fireEvent.change(screen.getByLabelText(t('settings.profile.barNumber')), {
        target: { value: '12345' },
      });
      fireEvent.click(screen.getByRole('button', { name: t('settings.profile.save') }));

      expect(await screen.findByText(t('settings.profile.saved'))).toBeVisible();
      expect(bridge.updateProfile).toHaveBeenCalledWith({
        fullName: 'سلمى حسن',
        barNumber: '12345',
        phone: null,
        officeAddress: null,
        defaultCurrency: 'EGP',
      });
    });

    it('refuses an empty name and keeps the draft when saving fails', async () => {
      vi.mocked(bridge.updateProfile).mockRejectedValue(new Error('disk full'));
      renderSettings('/settings');

      const name = await screen.findByLabelText(t('settings.profile.fullName'));
      await waitFor(() => expect(name).toHaveValue('أحمد علي'));
      fireEvent.change(name, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: t('settings.profile.save') }));
      expect(await screen.findByText(t('forms.required'))).toBeVisible();
      expect(bridge.updateProfile).not.toHaveBeenCalled();

      fireEvent.change(name, { target: { value: 'سلمى حسن' } });
      fireEvent.click(screen.getByRole('button', { name: t('settings.profile.save') }));
      expect(await screen.findByText(t('settings.profile.saveError'))).toBeVisible();
      expect(screen.queryByText(t('settings.profile.saved'))).not.toBeInTheDocument();
      expect(screen.getByLabelText(t('settings.profile.fullName'))).toHaveValue('سلمى حسن');
    });
  });

  describe('display and calendar', () => {
    it('saves the loaded values and confirms', async () => {
      vi.mocked(bridge.updateSettings).mockResolvedValue(settings);
      renderSettings('/settings?tab=general');

      fireEvent.click(await screen.findByRole('button', { name: t('settings.save') }));

      expect(await screen.findByText(t('settings.saved'))).toBeVisible();
      expect(bridge.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'ar',
          theme: 'system',
          dateFormat: 'dd/MM/yyyy',
          weekStartsOn: 6,
          defaultReminderMinutes: 60,
          lockTimeoutMinutes: 15,
        }),
      );
    });

    it('shows an error and no confirmation when saving fails', async () => {
      vi.mocked(bridge.updateSettings).mockRejectedValue(new Error('locked'));
      renderSettings('/settings?tab=general');

      fireEvent.click(await screen.findByRole('button', { name: t('settings.save') }));

      expect(await screen.findByText(t('settings.saveError'))).toBeVisible();
      expect(screen.queryByText(t('settings.saved'))).not.toBeInTheDocument();
    });

    it('moves between sections with the tab list and clears the saved notice', async () => {
      vi.mocked(bridge.updateSettings).mockResolvedValue(settings);
      renderSettings('/settings?tab=general');

      fireEvent.click(await screen.findByRole('button', { name: t('settings.save') }));
      expect(await screen.findByText(t('settings.saved'))).toBeVisible();

      fireEvent.click(screen.getByRole('tab', { name: t('settings.tabs.privacy') }));
      expect(await screen.findByText(t('settings.privacy.title'))).toBeVisible();

      fireEvent.click(screen.getByRole('tab', { name: t('settings.tabs.general') }));
      expect(await screen.findByRole('button', { name: t('settings.save') })).toBeVisible();
      expect(screen.queryByText(t('settings.saved'))).not.toBeInTheDocument();
    });
  });

  describe('security', () => {
    it('saves the automatic lock timeout', async () => {
      vi.mocked(bridge.updateSettings).mockResolvedValue({ ...settings, lockTimeoutMinutes: 15 });
      renderSettings('/settings?tab=security');

      fireEvent.click(await screen.findByRole('button', { name: t('settings.security.lockSave') }));

      await waitFor(() =>
        expect(bridge.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({ lockTimeoutMinutes: 15 }),
        ),
      );
    });

    it('turns start-with-device on and reports a failure to change it', async () => {
      vi.mocked(bridge.setAutostart).mockResolvedValueOnce({ ...settings, autostartEnabled: true });
      renderSettings('/settings?tab=security');

      const autostart = await screen.findByRole('switch', {
        name: t('settings.security.autostart'),
      });
      expect(autostart).not.toBeChecked();
      fireEvent.click(autostart);
      await waitFor(() => expect(vi.mocked(bridge.setAutostart).mock.calls[0]?.[0]).toBe(true));
      await waitFor(() =>
        expect(
          screen.getByRole('switch', { name: t('settings.security.autostart') }),
        ).toBeChecked(),
      );

      vi.mocked(bridge.setAutostart).mockRejectedValueOnce(new Error('denied'));
      fireEvent.click(screen.getByRole('switch', { name: t('settings.security.autostart') }));
      expect(await screen.findByText(t('settings.security.autostartError'))).toBeVisible();
    });

    it('no longer offers the usage counters switch', async () => {
      renderSettings('/settings?tab=security');
      await screen.findByRole('switch', { name: t('settings.security.autostart') });
      expect(screen.queryByText(/إحصاءات/)).toBeNull();
    });

    it('issues a new recovery key only with the current password, and offers to keep it', async () => {
      const key = '0123456789abcdef'.repeat(4);
      vi.mocked(bridge.replaceRecoveryKey)
        .mockRejectedValueOnce({ code: 'INVALID_PASSWORD', message: 'safe', details: null })
        .mockResolvedValueOnce({ recoveryKey: key });
      vi.mocked(bridge.saveRecoveryKey).mockResolvedValue(undefined);
      vi.mocked(bridge.print).mockResolvedValue(undefined);
      renderSettings('/settings?tab=security');

      const create = await screen.findByRole('button', {
        name: t('settings.security.recoveryReplace'),
      });
      expect(create).toBeDisabled();
      const password = screen.getByLabelText(t('settings.security.recoveryPassword'));
      fireEvent.change(password, { target: { value: 'the current password' } });
      fireEvent.click(create);
      expect(await screen.findByText(t('errors.INVALID_PASSWORD'))).toBeVisible();

      fireEvent.click(create);
      expect(
        await screen.findByText(
          '01234567 89abcdef 01234567 89abcdef 01234567 89abcdef 01234567 89abcdef',
        ),
      ).toBeVisible();
      expect(vi.mocked(bridge.replaceRecoveryKey).mock.calls[1]?.[0]).toBe('the current password');
      expect(screen.getByText(t('settings.security.recoveryNewWarning'))).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: t('gate.recoveryKeySave') }));
      expect(await screen.findByText(t('gate.recoveryKeySaved'))).toBeVisible();
      expect(vi.mocked(bridge.saveRecoveryKey).mock.calls[0]?.[0]).toBe(key);
      fireEvent.click(screen.getByRole('button', { name: t('gate.recoveryKeyPrint') }));
      await waitFor(() => expect(bridge.print).toHaveBeenCalledOnce());

      fireEvent.click(screen.getByRole('button', { name: t('settings.security.recoveryDone') }));
      expect(screen.queryByText(/01234567 89abcdef/)).toBeNull();
    });

    it('does not ask again once notification permission is already granted', async () => {
      vi.mocked(isPermissionGranted).mockResolvedValue(true);
      renderSettings('/settings?tab=security');

      fireEvent.click(
        await screen.findByRole('button', { name: t('settings.security.notificationsAllow') }),
      );

      expect(
        await screen.findByRole('button', { name: t('settings.security.notificationsGranted') }),
      ).toBeVisible();
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('requests notification permission and explains a refusal', async () => {
      vi.mocked(isPermissionGranted).mockResolvedValue(false);
      vi.mocked(requestPermission).mockResolvedValue('denied');
      renderSettings('/settings?tab=security');

      fireEvent.click(
        await screen.findByRole('button', { name: t('settings.security.notificationsAllow') }),
      );

      expect(await screen.findByText(t('settings.security.notificationsDenied'))).toBeVisible();
      expect(requestPermission).toHaveBeenCalledTimes(1);
    });

    it('requests notification permission and shows it granted', async () => {
      vi.mocked(isPermissionGranted).mockResolvedValue(false);
      vi.mocked(requestPermission).mockResolvedValue('granted');
      renderSettings('/settings?tab=security');

      fireEvent.click(
        await screen.findByRole('button', { name: t('settings.security.notificationsAllow') }),
      );

      expect(
        await screen.findByRole('button', { name: t('settings.security.notificationsGranted') }),
      ).toBeVisible();
      expect(
        screen.queryByText(t('settings.security.notificationsDenied')),
      ).not.toBeInTheDocument();
    });
  });

  describe('password change', () => {
    async function fillPasswords(current: string, next: string, confirm: string) {
      fireEvent.change(await screen.findByLabelText(t('settings.security.currentPassword')), {
        target: { value: current },
      });
      fireEvent.change(screen.getByLabelText(t('gate.fields.newPassword')), {
        target: { value: next },
      });
      fireEvent.change(screen.getByLabelText(t('gate.fields.confirmPassword')), {
        target: { value: confirm },
      });
      fireEvent.click(screen.getByRole('button', { name: t('settings.security.passwordTitle') }));
    }

    it('rejects a new password shorter than twelve characters without calling the vault', async () => {
      renderSettings('/settings?tab=security');

      await fillPasswords('old-password-1', 'short', 'short');

      expect(await screen.findByText(i18n.t('gate.passwordTooShort', { count: 12 }))).toBeVisible();
      expect(bridge.changePassword).not.toHaveBeenCalled();
    });

    it('asks for the current password before changing it', async () => {
      renderSettings('/settings?tab=security');

      await fillPasswords('', 'a-long-new-password', 'a-long-new-password');

      expect(await screen.findByText(t('forms.required'))).toBeVisible();
      expect(bridge.changePassword).not.toHaveBeenCalled();
    });

    it('rejects a confirmation that does not match', async () => {
      renderSettings('/settings?tab=security');

      await fillPasswords('old-password-1', 'a-long-new-password', 'a-different-password');

      expect(await screen.findByText(t('gate.passwordMismatch'))).toBeVisible();
      expect(bridge.changePassword).not.toHaveBeenCalled();
    });

    it('changes the password, confirms, and clears the fields', async () => {
      vi.mocked(bridge.changePassword).mockResolvedValue(undefined);
      renderSettings('/settings?tab=security');

      await fillPasswords('old-password-1', 'a-long-new-password', 'a-long-new-password');

      expect(await screen.findByText(t('settings.security.passwordChanged'))).toBeVisible();
      expect(bridge.changePassword).toHaveBeenCalledWith('old-password-1', 'a-long-new-password');
      await waitFor(() =>
        expect(screen.getByLabelText(t('gate.fields.newPassword'))).toHaveValue(''),
      );
      expect(screen.getByLabelText(t('settings.security.currentPassword'))).toHaveValue('');
    });

    it('shows a failure message and keeps the typed passwords when the vault refuses', async () => {
      vi.mocked(bridge.changePassword).mockRejectedValue(new Error('wrong password'));
      renderSettings('/settings?tab=security');

      await fillPasswords('old-password-1', 'a-long-new-password', 'a-long-new-password');

      expect(await screen.findByText(t('settings.security.passwordError'))).toBeVisible();
      expect(screen.queryByText(t('settings.security.passwordChanged'))).not.toBeInTheDocument();
      expect(screen.getByLabelText(t('gate.fields.newPassword'))).toHaveValue(
        'a-long-new-password',
      );
    });
  });

  describe('static sections', () => {
    it('lists what stays on the device and links to backups', async () => {
      renderSettings('/settings?tab=privacy');

      expect(await screen.findByText(t('settings.privacy.networkValue'))).toBeVisible();
      expect(
        screen.getByRole('link', { name: t('settings.privacy.manageBackups') }),
      ).toHaveAttribute('href', '/backups');
    });

    it('shows the backup panel and the restore warning', async () => {
      renderSettings('/settings?tab=backups');

      expect(await screen.findByText(t('settings.backups.restoreTitle'))).toBeVisible();
      await waitFor(() => expect(bridge.latestSuccessfulBackup).toHaveBeenCalled());
    });

    it('falls back to the profile section for an unknown tab name', async () => {
      renderSettings('/settings?tab=nonsense');

      expect(await screen.findByRole('button', { name: t('settings.profile.save') })).toBeVisible();
    });
  });
  describe('display tab entry routes', () => {
    // Non-default values make a blank or defaulted label distinguishable from a loaded one.
    const stored = {
      ...settings,
      theme: 'dark' as const,
      dateFormat: 'yyyy-MM-dd' as const,
      weekStartsOn: 0,
    };

    describe.each(['ar', 'en'] as const)('in %s', (language) => {
      const expectLoadedLabels = () => {
        const form = screen.getByRole('button', { name: t('settings.save') }).closest('form')!;
        for (const label of [
          language === 'ar' ? t('gate.fields.languageAr') : t('gate.fields.languageEn'),
          t('settings.themes.dark'),
          t('settings.display.yearFirst'),
          t('settings.display.sunday'),
        ])
          expect(within(form).getByText(label)).toBeVisible();
      };

      beforeEach(async () => {
        await i18n.changeLanguage(language);
        vi.mocked(bridge.settings).mockResolvedValue({ ...stored, language });
      });

      it('shows the stored labels when mounted directly on the tab (deep link)', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderSettings('/settings?tab=general');

        await screen.findByRole('button', { name: t('settings.save') });
        expectLoadedLabels();
        expect(errors.mock.calls.flat().join(' ')).not.toMatch(/uncontrolled|controlled/i);
        errors.mockRestore();
      });

      it('shows the stored labels after clicking the tab', async () => {
        renderSettings('/settings');

        fireEvent.click(await screen.findByRole('tab', { name: t('settings.tabs.general') }));
        await screen.findByRole('button', { name: t('settings.save') });
        expectLoadedLabels();
      });

      it('saves exactly the stored values when nothing was touched', async () => {
        vi.mocked(bridge.updateSettings).mockResolvedValue({ ...stored, language });
        renderSettings('/settings?tab=general');

        fireEvent.click(await screen.findByRole('button', { name: t('settings.save') }));

        expect(await screen.findByText(t('settings.saved'))).toBeVisible();
        expect(bridge.updateSettings).toHaveBeenCalledTimes(1);
        expect(bridge.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            language,
            theme: 'dark',
            dateFormat: 'yyyy-MM-dd',
            weekStartsOn: 0,
            defaultReminderMinutes: 60,
            lockTimeoutMinutes: 15,
          }),
        );
      });
    });

    it('does not mount the display form while settings are still loading or failed', async () => {
      vi.mocked(bridge.settings).mockRejectedValue(new Error('locked'));
      renderSettings('/settings?tab=general');

      expect(await screen.findByText(t('settings.loadError'))).toBeVisible();
      expect(screen.queryByRole('button', { name: t('settings.save') })).not.toBeInTheDocument();
    });
  });
});
