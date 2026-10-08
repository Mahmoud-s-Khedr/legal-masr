import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, isCancelled } from '../../../bridge/errors';
import type { BackupSummary } from '../../../bridge/types';
import { ConfirmDialog } from '../../../components/forms/FormDialog';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Icon } from '../../../components/layout/Icon';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import { useSingleFlight } from '../../../lib/useSingleFlight';
import {
  useCreateBackup,
  useInspectBackupToRestore,
  useLatestSuccessfulBackup,
  useRestoreBackup,
  useRevealBackup,
  useSaveBackupCopy,
  useValidateBackup,
} from '../api/backupsApi';

/** A failure worth showing: closing a file dialog without choosing is not one. */
function FailureAlert({ error, fallback }: { error: unknown; fallback: string }) {
  if (!error || isCancelled(error)) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{errorMessage(error, fallback)}</AlertDescription>
    </Alert>
  );
}

export function BackupSettingsPanel() {
  const { t } = useTranslation();
  const format = useFormat();
  const createBackup = useCreateBackup();
  const saveCopy = useSaveBackupCopy();
  const reveal = useRevealBackup();
  const validateBackup = useValidateBackup();
  const inspectRestore = useInspectBackupToRestore();
  const restoreBackup = useRestoreBackup();
  const latestBackup = useLatestSuccessfulBackup();
  const [preview, setPreview] = useState<BackupSummary | null>(null);
  // Backup freshness is judged against when the panel was opened.
  const [openedAt] = useState(() => Date.now());

  // `isPending` lags a render behind a click, so a quick second click would start a
  // second backup, or worse a second restore. Each action may run once at a time.
  const once = useSingleFlight();
  // The guard is shared on purpose: a restore must never overlap a backup, a copy or a
  // check. So while any of them runs, none is offered; otherwise a click would be dropped.
  const busy =
    createBackup.isPending ||
    saveCopy.isPending ||
    reveal.isPending ||
    validateBackup.isPending ||
    inspectRestore.isPending ||
    restoreBackup.isPending;
  const documents = (summary: BackupSummary) =>
    t('backups.documentCount', { count: summary.documentCount });

  const createNow = () => {
    saveCopy.reset();
    once((settled) => createBackup.mutate(undefined, { onSettled: settled }));
  };
  const saveCopyNow = () => {
    reveal.reset();
    once((settled) => saveCopy.mutate(undefined, { onSettled: settled }));
  };
  const revealNow = () => {
    saveCopy.reset();
    once((settled) => reveal.mutate(undefined, { onSettled: settled }));
  };
  const validate = () =>
    once((settled) => validateBackup.mutate(undefined, { onSettled: settled }));
  const chooseToRestore = () => {
    restoreBackup.reset();
    once((settled) =>
      inspectRestore.mutate(undefined, { onSuccess: setPreview, onSettled: settled }),
    );
  };
  const restore = () => {
    const token = preview?.token;
    setPreview(null);
    if (!token) return;
    once((settled) => restoreBackup.mutate(token, { onSettled: settled }));
  };

  const latest = latestBackup.data;
  const ageDays = latest
    ? Math.floor((openedAt - new Date(latest.completedAt).getTime()) / 86_400_000)
    : null;
  const stale = ageDays === null || Number.isNaN(ageDays) || ageDays >= 7;

  return (
    <div className="backup-settings">
      <Card className={`panel backup-status${stale ? ' is-stale' : ''}`}>
        <span className="backup-status-icon" aria-hidden="true">
          <Icon name={stale ? 'clock' : 'check'} size={22} />
        </span>
        <div>
          <strong>{t('backups.latestTitle')}</strong>
          {latestBackup.isLoading ? (
            <Skeleton className="h-5 w-52" aria-label={t('backups.loadingLatest')} />
          ) : latest ? (
            <p className="muted">
              {t('backups.latestCompleted', { date: format.dateTime(latest.completedAt) })}
              {latest.archiveSizeBytes !== null && (
                <> · {t('backups.latestSize', { size: format.bytes(latest.archiveSizeBytes) })}</>
              )}
            </p>
          ) : (
            <p className="muted">{t('backups.none')}</p>
          )}
          {!latestBackup.isLoading && stale && (
            <p className="backup-advice">
              {latest
                ? t('backups.staleAdvice', { count: ageDays ?? 0 })
                : t('backups.firstAdvice')}
            </p>
          )}
        </div>
      </Card>

      <div className="backup-actions">
        <Card className="panel backup-action">
          <h3>{t('backups.createTitle')}</h3>
          <p className="muted">{t('backups.createHint')}</p>
          <div className="form-actions">
            <Button type="button" onClick={createNow} disabled={busy}>
              {createBackup.isPending ? t('backups.creating') : t('backups.createNow')}
            </Button>
          </div>
          {createBackup.isSuccess && (
            <p className="success" role="status">
              {t('backups.createSuccessNamed', { name: createBackup.data })}
            </p>
          )}
          <FailureAlert error={createBackup.error} fallback={t('app.defaultError')} />
        </Card>

        <Card className="panel backup-action">
          <h3>{t('backups.validateTitle')}</h3>
          <p className="muted">{t('backups.validateHint')}</p>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={validate} disabled={busy}>
              {validateBackup.isPending ? t('backups.validating') : t('backups.validate')}
            </Button>
          </div>
          {validateBackup.data && (
            <p className="success" role="status">
              {t('backups.validateSummary', {
                date: format.dateTime(validateBackup.data.createdAt),
                documents: documents(validateBackup.data),
              })}
            </p>
          )}
          <FailureAlert error={validateBackup.error} fallback={t('backups.validateFailed')} />
        </Card>

        <Card className="panel backup-action backup-danger">
          <h3>{t('backups.restoreTitle')}</h3>
          <p className="muted">{t('backups.restoreHint')}</p>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              className="danger-outline"
              onClick={chooseToRestore}
              disabled={busy}
            >
              {inspectRestore.isPending
                ? t('backups.inspecting')
                : restoreBackup.isPending
                  ? t('backups.restoring')
                  : t('backups.chooseToRestore')}
            </Button>
          </div>
          <FailureAlert error={inspectRestore.error} fallback={t('backups.validateFailed')} />
          <FailureAlert error={restoreBackup.error} fallback={t('app.defaultError')} />
        </Card>
      </div>

      <Card className="panel backup-offsite">
        <span className="backup-status-icon" aria-hidden="true">
          <Icon name="shield" size={22} />
        </span>
        <div>
          <h3>{t('backups.offsiteTitle')}</h3>
          <p className="muted">{t('backups.offsiteAdvice')}</p>
          {latest || createBackup.isSuccess ? (
            <div className="form-actions">
              <Button type="button" onClick={saveCopyNow} disabled={busy}>
                <Icon name="save" size={16} />
                {saveCopy.isPending ? t('backups.savingCopy') : t('backups.saveCopy')}
              </Button>
              <Button type="button" variant="outline" onClick={revealNow} disabled={busy}>
                {t('backups.reveal')}
              </Button>
            </div>
          ) : (
            !latestBackup.isLoading && <p className="muted">{t('backups.noBackupToCopy')}</p>
          )}
          {saveCopy.isSuccess && (
            <p className="success" role="status">
              {t('backups.saveCopySuccess', { name: saveCopy.data })}
            </p>
          )}
          <FailureAlert error={saveCopy.error} fallback={t('app.defaultError')} />
          <FailureAlert error={reveal.error} fallback={t('app.defaultError')} />
        </div>
      </Card>

      <ConfirmDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={t('backups.restorePreviewTitle')}
        description={
          preview
            ? t('backups.restorePreview', {
                name: preview.fileName,
                date: format.dateTime(preview.createdAt),
                documents: documents(preview),
              })
            : ''
        }
        confirmLabel={t('backups.restoreConfirm')}
        cancelLabel={t('backups.restoreCancel')}
        onConfirm={restore}
        pending={restoreBackup.isPending}
        destructive
      />
    </div>
  );
}

export function BackupsPage() {
  const { t } = useTranslation();
  return (
    <section className="work-page backup-page">
      <PageHeader
        kicker={t('backups.kicker')}
        title={t('backups.title')}
        description={t('backups.description')}
      />
      <BackupSettingsPanel />
    </section>
  );
}
