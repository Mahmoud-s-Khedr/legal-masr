import { Alert, AlertDescription } from '@/components/ui/alert';
import { DraftForm } from '@/components/forms/DraftForm';
import { Field } from '@/components/forms/FormField';
import { FieldGroup } from '@/components/ui/field';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bridge } from '../../../bridge/commands';
import { errorMessage } from '../../../bridge/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { RecoveryKeyCard } from '../../onboarding/components/RecoveryKeyCard';

/** Replaces a lost or exposed recovery key once the current password is confirmed. */
export function RecoveryKeySection() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [newKey, setNewKey] = useState('');
  const replace = useMutation({
    gcTime: 0,
    mutationFn: (currentPassword: string) => bridge.replaceRecoveryKey(currentPassword),
    onSuccess: ({ recoveryKey }) => {
      setPassword('');
      setNewKey(recoveryKey);
    },
  });

  return (
    <section className="settings-section">
      <div className="card-title">
        <div>
          <h3>{t('settings.security.recoveryTitle')}</h3>
          <p>{t('settings.security.recoveryHint')}</p>
        </div>
      </div>
      {newKey ? (
        <div className="recovery-key-step">
          <p className="warning">{t('settings.security.recoveryNewWarning')}</p>
          <RecoveryKeyCard recoveryKey={newKey} />
          <div className="form-actions">
            <Button
              type="button"
              onClick={() => {
                setNewKey('');
                replace.reset();
              }}
            >
              {t('settings.security.recoveryDone')}
            </Button>
          </div>
        </div>
      ) : (
        <DraftForm
          onSubmit={(event) => {
            event.preventDefault();
            if (password) replace.mutate(password);
          }}
        >
          <FieldGroup>
            <Field label={t('settings.security.recoveryPassword')} required>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {replace.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {errorMessage(replace.error, t('settings.security.recoveryError'))}
                </AlertDescription>
              </Alert>
            )}
            <div className="form-actions">
              <Button type="submit" variant="secondary" disabled={!password || replace.isPending}>
                {replace.isPending
                  ? t('settings.security.recoveryReplacing')
                  : t('settings.security.recoveryReplace')}
              </Button>
            </div>
          </FieldGroup>
        </DraftForm>
      )}
    </section>
  );
}
