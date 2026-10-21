import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { asAppError, errorMessage, isCancelled } from '@/bridge/errors';
import type { DeletionPreview, DeletionResult, DeletionTarget } from '@/bridge/types';
import { Field } from '@/components/forms/FormField';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useFormat } from '@/i18n/LocalePresentation';
import { queryInvalidation } from '@/lib/queryInvalidation';
import { clearVaultCache } from '@/lib/vaultCache';
import { deletionApi } from '../api/deletionApi';

export function PermanentDeleteAction({ target }: { target: DeletionTarget }) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [backupFirst, setBackupFirst] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [result, setResult] = useState<DeletionResult | null>(null);
  const flight = useRef(false);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current += 1;
    },
    [],
  );
  const all = target.kind === 'all';
  const title = t(`deletion.title.${target.kind}`);
  const close = () => {
    if (flight.current) return;
    epoch.current += 1;
    setOpen(false);
    setPassword('');
    setConfirmation('');
    setPreview(null);
    setFailure(null);
  };
  const run = async (work: (active: () => boolean) => Promise<void>) => {
    if (flight.current) return;
    flight.current = true;
    const current = epoch.current;
    const active = () => epoch.current === current;
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
  const review = () =>
    run(async (active) => {
      setOpen(true);
      setResult(null);
      setPreview(null);
      setConfirmation('');
      setPassword('');
      const value = await deletionApi.preview(target, i18n.language === 'en' ? 'en' : 'ar');
      if (active()) setPreview(value);
    });
  const finish = async () => {
    setOpen(false);
    if (all) {
      navigate('/', { replace: true });
      await clearVaultCache(client);
    } else {
      navigate(target.kind === 'client' ? '/clients' : '/cases', { replace: true });
      await queryInvalidation.permanentDeletion(client);
    }
  };
  const receive = async (value: DeletionResult) => {
    setResult(value);
    setPreview(null);
    if (value.failedManagedFiles === 0 && value.failedVaultEntries === 0) await finish();
  };
  const commit = () =>
    run(async (active) => {
      if (!preview || confirmation.trim() !== preview.confirmationWord || (all && !password))
        return;
      const input = { target, token: preview.token, confirmation, password, backupFirst };
      setPassword('');
      try {
        const value = await deletionApi.commit(input);
        if (active()) await receive(value);
      } catch (error) {
        if (asAppError(error)?.code === 'DELETION_PREVIEW_EXPIRED') setPreview(null);
        throw error;
      } finally {
        input.password = '';
      }
    });
  return (
    <>
      <Button type="button" variant="destructive" onClick={() => void review()}>
        {title}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy && !result) close();
        }}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" aria-busy={busy}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{t('deletion.warning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <p>{t(`deletion.policy.${target.kind}`)}</p>
          {busy && <p role="status">{t('deletion.working')}</p>}
          {failure != null && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(failure, t('deletion.error'))}</AlertDescription>
            </Alert>
          )}
          {preview && (
            <>
              <p>{t('deletion.impact')}</p>
              <dl className="privacy-list">
                {Object.entries(preview.counts).map(([kind, count]) => (
                  <div key={kind}>
                    <dt>{t(`deletion.records.${kind}`)}</dt>
                    <dd>
                      <bdi>{format.number(count)}</bdi>
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>{t('deletion.managedFiles')}</dt>
                  <dd>
                    <bdi>{format.number(preview.managedFiles)}</bdi>
                  </dd>
                </div>
                {all && (
                  <div>
                    <dt>{t('deletion.vaultFiles')}</dt>
                    <dd>
                      <bdi>{format.number(preview.vaultFiles)}</bdi>
                    </dd>
                  </div>
                )}
              </dl>
              <FieldGroup>
                <Field
                  label={t('deletion.backupFirst')}
                  hint={t(all ? 'deletion.backupOutside' : 'deletion.backupLocal')}
                >
                  <Checkbox
                    checked={backupFirst}
                    onCheckedChange={setBackupFirst}
                    disabled={busy}
                  />
                </Field>
                <Field
                  label={t('deletion.confirmation')}
                  hint={t('deletion.typeWord', { word: preview.confirmationWord })}
                >
                  <Input
                    value={confirmation}
                    autoComplete="off"
                    disabled={busy}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </Field>
                {all && (
                  <Field label={t('deletion.password')}>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      disabled={busy}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                )}
              </FieldGroup>
            </>
          )}
          {result && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('deletion.fileFailure', {
                  count: result.failedManagedFiles,
                  entries: result.failedVaultEntries,
                })}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter className="sm:justify-start">
            {preview && (
              <Button
                type="button"
                variant="destructive"
                disabled={
                  busy || confirmation.trim() !== preview.confirmationWord || (all && !password)
                }
                onClick={() => void commit()}
              >
                {t('deletion.confirmDelete')}
              </Button>
            )}
            {!preview && !result && !busy && (
              <Button type="button" onClick={() => void review()}>
                {t('deletion.reviewAgain')}
              </Button>
            )}
            {result ? (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async (active) => {
                      const value = await deletionApi.retryCleanup();
                      if (active()) await receive(value);
                    })
                  }
                >
                  {t('deletion.retryFiles')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  {t('deletion.done')}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" disabled={busy} onClick={close}>
                {t('forms.cancel')}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The outbox survives a restart so failed file removals remain actionable. */
export function DeletionCleanupAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await deletionApi.retryCleanup();
      setFailed(result.failedManagedFiles > 0 || result.failedVaultEntries > 0);
      setMessage(
        result.failedManagedFiles > 0 || result.failedVaultEntries > 0
          ? t('deletion.fileFailure', {
              count: result.failedManagedFiles,
              entries: result.failedVaultEntries,
            })
          : t('deletion.cleanupComplete'),
      );
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error, t('deletion.error')));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p>{t('deletion.pendingHint')}</p>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void retry()}>
        {t('deletion.retryFiles')}
      </Button>
      {message && (
        <Alert variant={failed ? 'destructive' : 'default'}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
