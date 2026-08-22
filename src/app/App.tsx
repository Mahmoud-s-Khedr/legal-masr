import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPermissionGranted } from '@tauri-apps/plugin-notification';
import { bridge } from '../bridge/commands';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { Shell } from '../components/layout/Shell';
import { OnboardingPage, OnboardingSubGate } from '../features/onboarding/pages/OnboardingPage';
import { useAppStatus, useLockVault } from '../features/onboarding/api/onboardingApi';
import { useSettings } from '../features/settings/api/settingsApi';
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

function AppContent() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useAppStatus();
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
  const gate = manualGate ?? computedGate;

  if (gate === 'ready') {
    return (
      <>
        <ThemeSync />
        <ReminderSync />
        <Shell
          onLock={async () => {
            await lockVault.mutateAsync();
            setManualGate(null);
          }}
        />
      </>
    );
  }

  return (
    <>
      <LanguageSwitcher className="language-switcher-fixed" />
      {gate === 'loading' ? (
        <main className="gate loading">{t('app.loading')}</main>
      ) : (
        <OnboardingPage
          subGate={gate}
          recoveryKey={recoveryKey}
          onSwitchToRecovery={() => setManualGate('recovery')}
          onSetupSucceeded={(newRecoveryKey) => {
            setRecoveryKey(newRecoveryKey);
            setManualGate('recovery-key');
          }}
          onUnlocked={() => setManualGate(null)}
          onRecovered={() => setManualGate(null)}
          onRecoveryKeySaved={() => setManualGate(null)}
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
