import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { asAppError, errorMessage } from '../../../bridge/errors';
import type { BackupSelection, RestoreCredential } from '../../../bridge/types';
import { Field } from '../../../components/forms/FormField';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useRestoreSelectedBackup, useSelectBackupForRestore } from '../api/backupsApi';

type Kind = RestoreCredential['kind'];

/**
 * Restores a backup with its own password or recovery key. It works on a fresh
 * installation, on an incomplete one, and on an unlocked vault, because the
 * backup carries what is needed to open it. The chosen file's path stays in the
 * native layer; this component only holds the one-time token.
 */
export function RestoreFromBackup({
  replacesWorkspace = false,
  onRestored,
  onCancel,
}: {
  /** True when a workspace exists and will be replaced (a copy is kept). */
  replacesWorkspace?: boolean;
  onRestored: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const select = useSelectBackupForRestore();
  const restore = useRestoreSelectedBackup();
  const [selection, setSelection] = useState<BackupSelection | null>(null);
  const [kind, setKind] = useState<Kind>('password');
  const [secret, setSecret] = useState('');
  const [missingSecret, setMissingSecret] = useState(false);
  // The native layer drops the selection after any outcome except a mistyped
  // secret, so the file has to be chosen again after those.
  const [lostSelection, setLostSelection] = useState<unknown>(null);

  const choose = () => {
    setLostSelection(null);
    restore.reset();
    select.mutate(undefined, {
      onSuccess: (chosen) => {
        setSelection(chosen);
        setSecret('');
      },
    });
  };

  const submit = () => {
    if (!selection) return;
    if (!secret.trim()) {
      setMissingSecret(true);
      return;
    }
    setMissingSecret(false);
    restore.mutate(
      { token: selection.token, credential: { kind, secret } },
      {
        onSuccess: () => {
          setSecret('');
          onRestored();
        },
        onError: (error) => {
          const code = asAppError(error)?.code;
          if (code !== 'INVALID_PASSWORD' && code !== 'RECOVERY_KEY_INVALID') {
            setSelection(null);
            setSecret('');
            setLostSelection(error);
          }
        },
      },
    );
  };

  const cancelled = asAppError(select.error)?.code === 'OPERATION_CANCELLED';
  const failure = lostSelection ?? restore.error ?? (cancelled ? null : select.error);
  const olderFormat = selection?.formatVersion === 1;

  return (
    <div className="restore-from-backup">
      {replacesWorkspace && <p className="warning">{t('restoreFrom.replaceWarning')}</p>}
      {!selection || olderFormat ? (
        <>
          {olderFormat && (
            <Alert variant="destructive">
              <AlertDescription>{t('restoreFrom.olderFormat')}</AlertDescription>
            </Alert>
          )}
          <Button type="button" onClick={choose} disabled={select.isPending}>
            {select.isPending
              ? t('restoreFrom.choosing')
              : olderFormat
                ? t('restoreFrom.chooseAnother')
                : t('restoreFrom.chooseFile')}
          </Button>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="success" role="status">
            {t('restoreFrom.chosen')}
          </p>
          <fieldset className="restore-credential-kind">
            <legend>{t('restoreFrom.openWith')}</legend>
            {(['password', 'recoveryKey'] as const).map((option) => (
              <label key={option} className="checkbox-field">
                <input
                  type="radio"
                  name="restore-credential-kind"
                  checked={kind === option}
                  onChange={() => {
                    setKind(option);
                    setSecret('');
                    setMissingSecret(false);
                    restore.reset();
                  }}
                />
                {t(
                  option === 'password'
                    ? 'restoreFrom.optionPassword'
                    : 'restoreFrom.optionRecoveryKey',
                )}
              </label>
            ))}
          </fieldset>
          <Field
            label={t(kind === 'password' ? 'restoreFrom.password' : 'restoreFrom.recoveryKey')}
            hint={t(kind === 'password' ? 'restoreFrom.passwordHint' : 'restoreFrom.recoveryHint')}
            error={missingSecret ? t('restoreFrom.secretRequired') : undefined}
            required
          >
            <Input
              key={kind}
              type={kind === 'password' ? 'password' : 'text'}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </Field>
          <p className="muted">{t('restoreFrom.afterwards')}</p>
          <div className="form-actions">
            <Button type="submit" disabled={restore.isPending}>
              {restore.isPending ? t('restoreFrom.restoring') : t('restoreFrom.submit')}
            </Button>
            <Button type="button" variant="ghost" onClick={choose} disabled={restore.isPending}>
              {t('restoreFrom.chooseAnother')}
            </Button>
          </div>
        </form>
      )}
      {failure != null && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(failure, t('app.defaultError'))}</AlertDescription>
        </Alert>
      )}
      {onCancel && (
        <Button type="button" variant="ghost" className="gate-link" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      )}
    </div>
  );
}
