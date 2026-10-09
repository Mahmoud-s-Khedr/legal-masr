import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../bridge/commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('../bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(original.bridge).map((key) => [key, vi.fn()])) };
});
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(false),
}));

import { bridge } from '../bridge/commands';
import i18n from '../i18n';
import { queryClient } from '../lib/queryClient';
import { prepareWorkflowMocks, renderWorkflow } from '../test/workflow';
import { App } from './App';
import { AppRoutes, NAV_ITEMS } from './router';

beforeEach(() => {
  prepareWorkflowMocks();
  vi.mocked(bridge.profile).mockResolvedValue({
    fullName: 'Fictional lawyer',
    barNumber: null,
    phone: null,
    officeAddress: null,
    defaultCurrency: 'EGP',
  });
  vi.mocked(bridge.latestSuccessfulBackup).mockResolvedValue(null);
  queryClient.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  queryClient.clear();
  window.history.replaceState(null, '', '/');
});

function ready(language: 'ar' | 'en') {
  vi.mocked(bridge.status).mockResolvedValue({
    initialized: true,
    unlocked: true,
    vaultState: 'UNLOCKED',
  });
  vi.mocked(bridge.settings).mockResolvedValue({
    language,
    theme: 'light',
    dateFormat: 'yyyy-MM-dd',
    weekStartsOn: 6,
    defaultReminderMinutes: 60,
    autostartEnabled: false,
    usageCountersEnabled: false,
    lockTimeoutMinutes: 0,
  });
}

const unknownPaths = [
  '/unknown',
  '/clients/missing/extra',
  '/cases/new/extra',
  '/powers-of-attorney/missing/extra',
  '/settings/general',
  '/tasks/unknown',
  '/calendar/unknown',
  '/attachments/unknown',
  '/finances/unknown',
  '/backups/unknown',
  '/unknown?filter=fictional#section',
];

for (const language of ['ar', 'en'] as const) {
  describe(`${language} workspace routing`, () => {
    beforeEach(async () => {
      await i18n.changeLanguage(language);
      ready(language);
    });

    it.each(unknownPaths)('recovers from %s without redirecting', async (path) => {
      window.history.replaceState(null, '', path);
      render(<App />);
      expect(
        await screen.findByRole('heading', { name: i18n.t('app.notFound.title') }),
      ).toBeVisible();
      expect(screen.getByText(i18n.t('app.notFound.description'))).toBeVisible();
      expect(window.location.pathname + window.location.search + window.location.hash).toBe(path);
      expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      expect(document.querySelector('.topbar')).toBeVisible();
      for (const item of NAV_ITEMS) {
        expect(screen.getByRole('link', { name: i18n.t(item.key) })).toHaveAttribute(
          'href',
          item.to,
        );
      }
      const recovery = screen.getByRole('link', { name: i18n.t('app.notFound.returnToToday') });
      expect(recovery).toHaveAttribute('href', '/');
      fireEvent.click(recovery);
      await screen.findByRole('heading', { name: i18n.t('dashboard.today') });
      expect(window.location.pathname).toBe('/');
      expect(window.location.search + window.location.hash).toBe('');
    });

    it.each([
      ['/', 'dashboard.today'],
      ['/clients', 'clients.title'],
      ['/clients/new', 'clients.newTitle'],
      ['/cases', 'cases.title'],
      ['/cases/new', 'cases.newTitle'],
      ['/powers-of-attorney', 'poa.title'],
      ['/powers-of-attorney/new', 'poa.add'],
      ['/calendar', 'agenda.title'],
      ['/tasks', 'tasks.title'],
      ['/attachments', 'documents.pageAll'],
      ['/finances', 'finances.title'],
      ['/backups', 'backups.title'],
    ])('still resolves %s', async (path, title) => {
      renderWorkflow(<AppRoutes />, path);
      expect(await screen.findByRole('heading', { name: i18n.t(title) })).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: i18n.t('app.notFound.title') }),
      ).not.toBeInTheDocument();
    });

    it.each(['profile', 'general', 'security', 'backups', 'privacy', 'about'])(
      'preserves Settings deep link %s',
      async (tab) => {
        renderWorkflow(<AppRoutes />, `/settings?tab=${tab}`);
        await waitFor(() =>
          expect(document.querySelector(`[role="tab"][aria-selected="true"]`)).toHaveTextContent(
            i18n.t(`settings.tabs.${tab}`),
          ),
        );
        expect(
          screen.queryByRole('heading', { name: i18n.t('app.notFound.title') }),
        ).not.toBeInTheDocument();
      },
    );

    it.each([
      ['/clients/missing', 'clientGet', 'clients.detail.notFound'],
      ['/cases/missing', 'caseGet', 'cases.detail.notFound'],
      ['/powers-of-attorney/missing', 'powerOfAttorneyGet', 'poa.notFound'],
    ] as const)('keeps the missing-record message at %s', async (path, method, key) => {
      vi.mocked(bridge[method]).mockResolvedValue(null as never);
      renderWorkflow(<AppRoutes />, path);
      expect(await screen.findByText(i18n.t(key))).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: i18n.t('app.notFound.title') }),
      ).not.toBeInTheDocument();
    });

    it('keeps an unknown URL behind setup', async () => {
      vi.mocked(bridge.status).mockResolvedValue({
        initialized: false,
        unlocked: false,
        vaultState: 'EMPTY',
      });
      window.history.replaceState(null, '', '/unknown?filter=fictional#section');
      render(<App />);
      await screen.findByRole('heading', { name: i18n.t('gate.title.setup') });
      expect(
        screen.queryByRole('link', { name: i18n.t('app.notFound.returnToToday') }),
      ).not.toBeInTheDocument();
      expect(bridge.settings).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/unknown');
    });

    it('keeps an unknown URL locked until successful unlock', async () => {
      vi.mocked(bridge.status).mockResolvedValue({
        initialized: true,
        unlocked: false,
        vaultState: 'LOCKED',
      });
      vi.mocked(bridge.unlock).mockImplementation(async () => {
        ready(language);
      });
      window.history.replaceState(null, '', '/unknown?filter=fictional#section');
      render(<App />);
      await screen.findByRole('heading', { name: i18n.t('gate.title.unlock') });
      expect(
        screen.queryByRole('link', { name: i18n.t('app.notFound.returnToToday') }),
      ).not.toBeInTheDocument();
      expect(bridge.settings).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(i18n.t('gate.fields.password')), {
        target: { value: 'fictional secure password' },
      });
      fireEvent.submit(screen.getByLabelText(i18n.t('gate.fields.password')).closest('form')!);
      await screen.findByRole('heading', { name: i18n.t('app.notFound.title') });
      expect(window.location.pathname + window.location.search + window.location.hash).toBe(
        '/unknown?filter=fictional#section',
      );
    });
  });
}
