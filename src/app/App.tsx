import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
