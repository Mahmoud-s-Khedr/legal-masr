import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isPermissionGranted } from '@tauri-apps/plugin-notification';
import { errorMessage } from '../bridge/errors';
import { bridge } from '../bridge/commands';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { Shell } from '../components/layout/Shell';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { OnboardingPage, OnboardingSubGate } from '../features/onboarding/pages/OnboardingPage';
import { useAppStatus, useLockVault } from '../features/onboarding/api/onboardingApi';
import { useSettings } from '../features/settings/api/settingsApi';
import { demoSeedEnabled, seedDemoDataOnce } from '../dev/seedDemoData';
import { captureModeEnabled } from '../dev/captureBridge';
import { queryKeys } from '../lib/queryKeys';
import { Providers } from './providers';

type Gate = 'loading' | OnboardingSubGate | 'ready';

function ThemeSync() {
  const { data: settings } = useSettings();
  const theme = settings?.theme ?? 'system';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}

function LocaleSync() {
  const { data: settings } = useSettings();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (settings && i18n.language !== settings.language)
      void i18n.changeLanguage(settings.language);
  }, [i18n, settings]);
  return null;
}

function ReminderSync() {
  useEffect(() => {
    const refresh = async () => {
      try {
        if (!(await isPermissionGranted())) return;
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        await bridge.refreshReminders(today, nowTime);
      } catch {
        // Notification availability is best-effort and must never block the local workspace.
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  return null;
}

function DemoDataSeeder() {
  const { data: status } = useAppStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!demoSeedEnabled() || !status?.unlocked) return;
    void seedDemoDataOnce()
      .then(async (result) => {
        if (result !== 'seeded') return;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.powersOfAttorney.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.hearings.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agenda }),
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        ]);
      })
      .catch(() => {
        // Seeding is explicitly opt-in developer support and must not block the workspace.
      });
  }, [queryClient, status?.unlocked]);

  return null;
}

function AppContent() {
  const { t } = useTranslation();
  const { data: status, isLoading, isError, error, refetch } = useAppStatus();
  const lockVault = useLockVault();
  const [manualGate, setManualGate] = useState<Gate | null>(null);
  const [recoveryKey, setRecoveryKey] = useState('');

  const computedGate: Gate =
    isLoading || !status
      ? 'loading'
      : !status.initialized
        ? 'setup'
        : !status.unlocked
          ? 'unlock'
          : 'ready';
  // The capture runner can include onboarding without changing the fixture
  // vault state. This branch is unreachable from production bundles.
  const gate =
    captureModeEnabled() && new URLSearchParams(window.location.search).has('captureOnboarding')
      ? 'setup'
      : (manualGate ?? computedGate);

  if (gate === 'ready') {
    return (
      <>
        <ThemeSync />
        <LocaleSync />
        <ReminderSync />
        <DemoDataSeeder />
        {lockVault.isError && (
          <Alert variant="destructive">
            <AlertDescription>{t('app.defaultError')}</AlertDescription>
          </Alert>
        )}
        <Shell
          onLock={async () => {
            try {
              await lockVault.mutateAsync();
              setManualGate(null);
            } catch {
              // Keep the current gate and cache when the native lock is refused.
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <LanguageSwitcher className="language-switcher-fixed" />
      {isError || status?.vaultState === 'INCOMPLETE' || status?.vaultState === 'INTERRUPTED' ? (
        <main className="gate loading" role="alert">
          <div>
            <p>
              {status?.vaultState === 'INTERRUPTED'
                ? t('errors.VAULT_INTERRUPTED')
                : status?.vaultState === 'INCOMPLETE'
                  ? t('errors.VAULT_INCOMPLETE')
                  : errorMessage(error, t('app.startupError'))}
            </p>
            <Button type="button" onClick={() => void refetch()}>
              {t('app.retry')}
            </Button>
          </div>
        </main>
      ) : gate === 'loading' ? (
        <main className="gate loading">
          <Skeleton className="h-10 w-40" aria-label={t('app.loading')} />
        </main>
      ) : (
        <OnboardingPage
          key={gate}
          subGate={gate}
          recoveryKey={recoveryKey}
          onSwitchToRecovery={() => setManualGate('recovery')}
          onBackToUnlock={() => setManualGate(null)}
          onSetupSucceeded={(newRecoveryKey) => {
            setRecoveryKey(newRecoveryKey);
            setManualGate('recovery-key');
          }}
          onUnlocked={() => setManualGate(null)}
          onRecovered={() => setManualGate(null)}
          onRecoveryKeySaved={() => {
            setRecoveryKey('');
            setManualGate(null);
          }}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
