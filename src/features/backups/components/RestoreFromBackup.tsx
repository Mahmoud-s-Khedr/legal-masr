import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { bridge } from '../../../bridge/commands';
import { asAppError, errorMessage, isCancelled } from '../../../bridge/errors';
import type { BackupSelection, PreparedBackup, RestoreCredential } from '../../../bridge/types';
import { Field } from '../../../components/forms/FormField';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useFormat } from '../../../i18n/LocalePresentation';
import { clearVaultCache } from '../../../lib/vaultCache';
import { markRestored } from '../../../lib/restoreNotice';

/** One restore contract for setup, incomplete installations and Settings. Credentials
 * are submitted directly, so mutation caches never retain them. Paths and keys stay native. */
export function RestoreFromBackup({
  replacesWorkspace = false,
  useActiveKey = false,
  validateOnly = false,
  onRestored,
  onCancel,
}: {
  replacesWorkspace?: boolean;
  useActiveKey?: boolean;
  validateOnly?: boolean;
  onRestored: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const client = useQueryClient();
  const [selection, setSelection] = useState<BackupSelection | null>(null);
  const [preview, setPreview] = useState<PreparedBackup | null>(null);
  const [kind, setKind] = useState<RestoreCredential['kind']>('password');
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const flight = useRef(false);
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current += 1;
    return () => {
      epoch.current += 1;
      void bridge.cancelBackupRestore().catch(() => {});
    };
  }, []);
  const clearSecrets = () => {
    setSecret('');
    setPassword('');
    setConfirmation('');
  };
  const run = async (work: (active: () => boolean) => Promise<void>) => {
    if (flight.current) return;
    const current = epoch.current;
    const active = () => epoch.current === current;
    flight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await work(active);
    } catch (error) {
      if (active() && !isCancelled(error)) setFailure(error);
    } finally {
      flight.current = false;
      if (active()) setBusy(false);
    }
  };
  const choose = () =>
    run(async (active) => {
      clearSecrets();
      setPreview(null);
      setSelection(null);
      const selected = await bridge.selectBackupForRestore();
      if (!active()) return;
      setSelection(selected);
      if (useActiveKey) {
        const prepared = await bridge.prepareBackupRestore(selected.token);
        if (active()) setPreview(prepared);
      }
    });
  const prepare = () =>
    run(async (active) => {
      if (!selection) return;
      if (!secret.trim()) {
        setFailure(t('restoreFrom.secretRequired'));
        return;
      }
      if (kind === 'recoveryKey' && (password.length < 12 || password !== confirmation)) {
        setFailure(t('restoreFrom.passwordMismatch'));
        return;
      }
      const credential: RestoreCredential = {
        kind,
        secret,
        ...(kind === 'recoveryKey' ? { newPassword: password, confirmPassword: confirmation } : {}),
      };
      clearSecrets();
      const prepared = await bridge.prepareBackupRestore(selection.token, credential);
      if (active()) setPreview(prepared);
    });
  const commit = () =>
    run(async (active) => {
      if (!preview) return;
      const passwordSource = preview.passwordSource;
      try {
        await bridge.commitBackupRestore(preview.token);
      } catch (error) {
        if (asAppError(error)?.code === 'VAULT_INTERRUPTED' && active())
          await clearVaultCache(client);
        throw error;
      }
      if (!active()) return;
      clearSecrets();
      setPreview(null);
      setSelection(null);
      markRestored(passwordSource);
      await clearVaultCache(client);
      onRestored();
    });
  const cancel = () =>
    run(async (active) => {
      await bridge.cancelBackupRestore();
      if (!active()) return;
      clearSecrets();
      setPreview(null);
      setSelection(null);
      setFailure(null);
      onCancel?.();
    });
  return (
    <div className="restore-from-backup" aria-busy={busy}>
      {replacesWorkspace && !validateOnly && (
        <p className="warning">{t('restoreFrom.replaceWarning')}</p>
      )}
      {!selection && (
        <Button type="button" onClick={choose} disabled={busy}>
          {t(busy ? 'restoreFrom.choosing' : 'restoreFrom.chooseFile')}
        </Button>
      )}
      {selection && (
        <p>
          <bdi>{selection.fileName}</bdi>
        </p>
      )}
      {selection && !preview && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <fieldset disabled={busy} className="restore-credential-kind">
            <legend>{t('restoreFrom.openWith')}</legend>
            {(['password', 'recoveryKey'] as const).map((option) => (
              <label key={option} className="checkbox-field">
                <input
                  type="radio"
                  name="restore-method"
                  checked={kind === option}
                  onChange={() => {
                    setKind(option);
                    clearSecrets();
                    setFailure(null);
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
            required
            hint={t(kind === 'password' ? 'restoreFrom.passwordHint' : 'restoreFrom.recoveryHint')}
          >
            <Input
              type="password"
              dir="ltr"
              autoComplete="off"
              value={secret}
              disabled={busy}
              onChange={(event) => setSecret(event.target.value)}
            />
          </Field>
          {kind === 'recoveryKey' && (
            <>
              <Field label={t('restoreFrom.newPassword')} required>
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field label={t('restoreFrom.confirmPassword')} required>
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
            </>
          )}
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              {t('restoreFrom.prepare')}
            </Button>
          </div>
        </form>
      )}
      {preview && (
        <section aria-label={t('restoreFrom.prepare')}>
          <p role="status">
            {t('restoreFrom.preview', {
              date: format.dateTime(preview.createdAt),
              count: preview.documentCount,
            })}
          </p>
          {!validateOnly && (
            <>
              <p>
                {t(
                  `restoreFrom.${preview.passwordSource === 'newPassword' ? 'newPasswordNotice' : preview.passwordSource}`,
                )}
              </p>
              <Button type="button" variant="destructive" disabled={busy} onClick={commit}>
                {t('backups.restoreConfirm')}
              </Button>
            </>
          )}
        </section>
      )}
      {failure != null && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(failure, t('app.defaultError'))}</AlertDescription>
        </Alert>
      )}
      {selection && (
        <Button type="button" variant="ghost" disabled={busy} onClick={choose}>
          {t('restoreFrom.chooseAnother')}
        </Button>
      )}
      <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
        {t('common.cancel')}
      </Button>
    </div>
  );
}
