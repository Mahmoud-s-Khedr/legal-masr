import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    setUsageCounters: vi.fn(),
    latestSuccessfulBackup: vi.fn(),
    createBackup: vi.fn(),
    validateBackup: vi.fn(),
    restoreBackup: vi.fn(),
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

    it('toggles aggregate usage counters and reports a failure', async () => {
      vi.mocked(bridge.setUsageCounters).mockRejectedValueOnce(new Error('denied'));
      renderSettings('/settings?tab=security');

      const counters = await screen.findByRole('switch', { name: t('settings.security.counters') });
      fireEvent.click(counters);
      expect(await screen.findByText(t('settings.security.countersError'))).toBeVisible();
      expect(vi.mocked(bridge.setUsageCounters).mock.calls[0]?.[0]).toBe(true);

      vi.mocked(bridge.setUsageCounters).mockResolvedValueOnce({
        ...settings,
        usageCountersEnabled: true,
      });
      fireEvent.click(screen.getByRole('switch', { name: t('settings.security.counters') }));
      await waitFor(() =>
        expect(screen.getByRole('switch', { name: t('settings.security.counters') })).toBeChecked(),
      );
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
});
