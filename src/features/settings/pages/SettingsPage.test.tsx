import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    status: vi.fn(),
    settings: vi.fn(),
    profile: vi.fn(),
  },
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
}));

import { bridge } from '../../../bridge/commands';
import '../../../i18n';
import { SettingsPage } from './SettingsPage';

const settings = {
  language: 'ar' as const,
  theme: 'system' as const,
  dateFormat: 'dd/MM/yyyy' as const,
  weekStartsOn: 6,
  defaultReminderMinutes: 60,
  autostartEnabled: false,
  lockTimeoutMinutes: 15,
  managedDocumentsDirectory: null,
  backupDirectory: null,
};

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: true });
    vi.mocked(bridge.profile).mockResolvedValue({
      fullName: 'أحمد علي',
      barNumber: null,
      phone: null,
      email: null,
      officeAddress: null,
      defaultCurrency: 'EGP',
    });
  });

  it('shows the settings workspace after local settings load', async () => {
    vi.mocked(bridge.settings).mockResolvedValue(settings);

    renderSettingsPage();

    expect(await screen.findByRole('heading', { name: 'بيانات المحامي' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a retry action when loading settings fails and recovers after retry', async () => {
    vi.mocked(bridge.settings)
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(settings);

    renderSettingsPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل الإعدادات المحلية');
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));

    expect(await screen.findByRole('heading', { name: 'بيانات المحامي' })).toBeInTheDocument();
    expect(bridge.settings).toHaveBeenCalledTimes(2);
  });
});
