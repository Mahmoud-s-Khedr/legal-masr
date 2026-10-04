import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { useInitializeVault, useRecoverAccess, useUnlockVault } from '../api/onboardingApi';
import {
  RecoveryFormValues,
  recoverySchema,
  SetupFormValues,
  setupSchema,
  UnlockFormValues,
  unlockSchema,
} from '../schemas/onboarding.schema';

export type OnboardingSubGate = 'setup' | 'unlock' | 'recovery' | 'recovery-key';

export function OnboardingPage({
  subGate,
  recoveryKey,
  onSwitchToRecovery,
  onSetupSucceeded,
  onUnlocked,
  onRecovered,
  onRecoveryKeySaved,
}: {
  subGate: OnboardingSubGate;
  recoveryKey: string;
  onSwitchToRecovery: () => void;
  onSetupSucceeded: (recoveryKey: string) => void;
  onUnlocked: () => void;
  onRecovered: () => void;
  onRecoveryKeySaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const initializeVault = useInitializeVault();
  const unlockVault = useUnlockVault();
  const recoverAccess = useRecoverAccess();

  const busy = initializeVault.isPending || unlockVault.isPending || recoverAccess.isPending;
  const error = initializeVault.error ?? unlockVault.error ?? recoverAccess.error;

  return (
    <main className="gate">
      <aside className="gate-brand">
        <img src="/logo.png" alt={t('app.brandLogoAlt')} />
        <p>{t('app.brandTagline')}</p>
      </aside>
      <Card className="gate-card">
        <p className="kicker">
          {t(`gate.kicker.${subGate === 'recovery-key' ? 'recoveryKey' : subGate}`)}
        </p>
        <h1>{t(`gate.title.${subGate === 'recovery-key' ? 'recoveryKey' : subGate}`)}</h1>
        {subGate === 'recovery-key' ? (
          <>
            <p>{t('gate.recoveryKeyWarning')}</p>
            <code>{recoveryKey}</code>
            <Button onClick={onRecoveryKeySaved}>{t('gate.recoveryKeySavedButton')}</Button>
          </>
        ) : subGate === 'setup' ? (
          <SetupForm
            busy={busy}
            onSubmit={async (values) => {
              const result = await initializeVault.mutateAsync({
                ...values,
                language: i18n.language === 'en' ? 'en' : 'ar',
              });
              onSetupSucceeded(result.recoveryKey);
            }}
          />
        ) : subGate === 'unlock' ? (
          <UnlockForm
            busy={busy}
            onSubmit={async (values) => {
              await unlockVault.mutateAsync(values.password);
              onUnlocked();
            }}
          />
        ) : (
          <RecoveryForm
            busy={busy}
            onSubmit={async (values) => {
              await recoverAccess.mutateAsync({
                recoveryKey: values.recoveryKey,
                newPassword: values.password,
              });
              onRecovered();
            }}
          />
        )}
        {error && (
          <p className="error" role="alert">
            {errorMessage(error, t('app.defaultError'))}
          </p>
        )}
        {subGate === 'unlock' && (
          <Button variant="ghost" className="text-button" onClick={onSwitchToRecovery}>
            {t('gate.haveRecoveryKey')}
          </Button>
        )}
      </Card>
    </main>
  );
}

function SetupForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (values: SetupFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { fullName: '', password: '' },
  });
  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <label>
        {t('gate.fields.fullName')}
        <Input {...register('fullName')} required autoFocus />
      </label>
      <label>
        {t('gate.fields.password')}
        <Input type="password" {...register('password')} minLength={12} required />
      </label>
      <Button disabled={busy || formState.isSubmitting}>
        {busy ? t('gate.submit.busy') : t('gate.submit.setup')}
      </Button>
    </form>
  );
}

function UnlockForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (values: UnlockFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<UnlockFormValues>({
    resolver: zodResolver(unlockSchema),
    defaultValues: { password: '' },
  });
  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <label>
        {t('gate.fields.password')}
        <Input type="password" {...register('password')} minLength={12} required autoFocus />
      </label>
      <Button disabled={busy || formState.isSubmitting}>
        {busy ? t('gate.submit.busy') : t('gate.submit.unlock')}
      </Button>
    </form>
  );
}

function RecoveryForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (values: RecoveryFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { recoveryKey: '', password: '' },
  });
  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <label>
        {t('gate.fields.recoveryKey')}
        <Input dir="ltr" {...register('recoveryKey')} required autoFocus />
      </label>
      <label>
        {t('gate.fields.newPassword')}
        <Input type="password" {...register('password')} minLength={12} required />
      </label>
      <Button disabled={busy || formState.isSubmitting}>
        {busy ? t('gate.submit.busy') : t('gate.submit.recovery')}
      </Button>
    </form>
  );
}
