import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, type InputHTMLAttributes, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import { Icon } from '../../../components/layout/Icon';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/input';
import { useInitializeVault, useRecoverAccess, useUnlockVault } from '../api/onboardingApi';
import {
  PASSWORD_MIN_LENGTH,
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
  onBackToUnlock,
  onSetupSucceeded,
  onUnlocked,
  onRecovered,
  onRecoveryKeySaved,
}: {
  subGate: OnboardingSubGate;
  recoveryKey: string;
  onSwitchToRecovery: () => void;
  onBackToUnlock?: () => void;
  onSetupSucceeded: (recoveryKey: string) => void;
  onUnlocked: () => void;
  onRecovered: () => void;
  onRecoveryKeySaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const initializeVault = useInitializeVault();
  const unlockVault = useUnlockVault();
  const recoverAccess = useRecoverAccess();
  const [keySaved, setKeySaved] = useState(false);
  const resetInitialize = initializeVault.reset;
  const resetUnlock = unlockVault.reset;
  const resetRecovery = recoverAccess.reset;
  useEffect(() => {
    resetInitialize();
    resetUnlock();
    resetRecovery();
  }, [subGate, resetInitialize, resetUnlock, resetRecovery]);

  const busy = initializeVault.isPending || unlockVault.isPending || recoverAccess.isPending;
  const error =
    subGate === 'setup'
      ? initializeVault.error
      : subGate === 'unlock'
        ? unlockVault.error
        : subGate === 'recovery'
          ? recoverAccess.error
          : null;
  const copyKey = subGate === 'recovery-key' ? 'recoveryKey' : subGate;

  return (
    <main className="gate">
      <aside className="gate-brand">
        <img src="/logo.png" alt={t('app.brandLogoAlt')} />
        <strong className="gate-brand-name">{t('app.brandName')}</strong>
        <p>{t('app.brandTagline')}</p>
        <ul className="gate-points">
          <li>
            <Icon name="shield" size={18} />
            {t('gate.points.encrypted')}
          </li>
          <li>
            <Icon name="lock" size={18} />
            {t('gate.points.local')}
          </li>
          <li>
            <Icon name="backup" size={18} />
            {t('gate.points.backup')}
          </li>
        </ul>
      </aside>
      <Card className="gate-card">
        <p className="kicker">{t(`gate.kicker.${copyKey}`)}</p>
        <h1>{t(`gate.title.${copyKey}`)}</h1>
        <p className="gate-intro">{t(`gate.intro.${copyKey}`)}</p>
        {subGate === 'recovery-key' ? (
          <div className="recovery-key-step">
            <p className="warning">{t('gate.recoveryKeyWarning')}</p>
            <code className="recovery-key" aria-label={t('gate.fields.recoveryKey')}>
              {recoveryKey}
            </code>
            <ul className="gate-tips">
              <li>{t('gate.recoveryTips.paper')}</li>
              <li>{t('gate.recoveryTips.separate')}</li>
              <li>{t('gate.recoveryTips.difference')}</li>
            </ul>
            <label className="checkbox-field gate-confirm">
              <Checkbox checked={keySaved} onCheckedChange={setKeySaved} />
              {t('gate.recoveryKeyConfirm')}
            </label>
            <Button disabled={!keySaved} onClick={onRecoveryKeySaved}>
              {t('gate.recoveryKeySavedButton')}
            </Button>
          </div>
        ) : subGate === 'setup' ? (
          <SetupForm
            busy={busy}
            onSubmit={async ({ fullName, password }) => {
              const result = await initializeVault.mutateAsync({
                fullName,
                password,
                language: i18n.language === 'en' ? 'en' : 'ar',
              });
              onSetupSucceeded(result.recoveryKey);
              initializeVault.reset();
            }}
          />
        ) : subGate === 'unlock' ? (
          <UnlockForm
            busy={busy}
            onSubmit={async (values) => {
              await unlockVault.mutateAsync(values.password);
              unlockVault.reset();
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
              recoverAccess.reset();
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
          <Button variant="ghost" className="text-button gate-link" onClick={onSwitchToRecovery}>
            {t('gate.haveRecoveryKey')}
          </Button>
        )}
        {subGate === 'recovery' && onBackToUnlock && (
          <Button variant="ghost" className="text-button gate-link" onClick={onBackToUnlock}>
            {t('gate.backToUnlock')}
          </Button>
        )}
      </Card>
    </main>
  );
}

/** Password input with a deliberate show/hide control beside it. */
const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput(props, ref) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    return (
      <span className="password-input">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="password-toggle"
          aria-pressed={visible}
          aria-label={visible ? t('gate.hidePassword') : t('gate.showPassword')}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? t('gate.hide') : t('gate.show')}
        </button>
      </span>
    );
  },
);

function NewPasswordFields({
  register,
  errors,
  labelKey,
}: {
  register: ReturnType<typeof useForm<SetupFormValues>>['register'];
  errors: { password?: unknown; confirmPassword?: unknown };
  labelKey: 'password' | 'newPassword';
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field
        label={t(`gate.fields.${labelKey}`)}
        hint={t('gate.passwordHint', { count: PASSWORD_MIN_LENGTH })}
        error={
          errors.password ? t('gate.passwordTooShort', { count: PASSWORD_MIN_LENGTH }) : undefined
        }
        required
      >
        <PasswordInput {...register('password')} />
      </Field>
      <Field
        label={t('gate.fields.confirmPassword')}
        error={errors.confirmPassword ? t('gate.passwordMismatch') : undefined}
        required
      >
        <PasswordInput {...register('confirmPassword')} />
      </Field>
    </>
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
    defaultValues: { fullName: '', password: '', confirmPassword: '' },
  });
  return (
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <Field
        label={t('gate.fields.fullName')}
        hint={t('gate.fullNameHint')}
        error={formState.errors.fullName ? t('forms.required') : undefined}
        required
      >
        <Input {...register('fullName')} autoFocus />
      </Field>
      <NewPasswordFields register={register} errors={formState.errors} labelKey="password" />
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
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <Field
        label={t('gate.fields.password')}
        error={formState.errors.password ? t('forms.required') : undefined}
      >
        <PasswordInput {...register('password')} autoFocus />
      </Field>
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
    defaultValues: { recoveryKey: '', password: '', confirmPassword: '' },
  });
  return (
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <Field
        label={t('gate.fields.recoveryKey')}
        hint={t('gate.recoveryKeyHint')}
        error={formState.errors.recoveryKey ? t('forms.required') : undefined}
        required
      >
        <Input dir="ltr" {...register('recoveryKey')} autoFocus spellCheck={false} />
      </Field>
      <NewPasswordFields
        register={register as unknown as ReturnType<typeof useForm<SetupFormValues>>['register']}
        errors={formState.errors}
        labelKey="newPassword"
      />
      <Button disabled={busy || formState.isSubmitting}>
        {busy ? t('gate.submit.busy') : t('gate.submit.recovery')}
      </Button>
    </form>
  );
}
