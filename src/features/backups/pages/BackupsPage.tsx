import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { asAppError, actionableErrorMessage, errorMessage } from '../../../bridge/errors';
import { ConfirmDialog, FormDialog } from '../../../components/forms/FormDialog';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Icon } from '../../../components/layout/Icon';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import { useSingleFlight } from '../../../lib/useSingleFlight';
import {
  useCreateBackup,
  useLatestSuccessfulBackup,
  useRestoreBackup,
  useValidateBackup,
} from '../api/backupsApi';
import { RestoreFromBackup } from '../components/RestoreFromBackup';

export function BackupSettingsPanel() {
  const { t } = useTranslation();
  const format = useFormat();
  const createBackup = useCreateBackup();
  const validateBackup = useValidateBackup();
  const restoreBackup = useRestoreBackup();
  const latestBackup = useLatestSuccessfulBackup();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  // Backup freshness is judged against when the panel was opened.
  const [openedAt] = useState(() => Date.now());

  // `isPending` lags a render behind a click, so a quick second click would start a
  // second backup, or worse a second restore. Each action may run once at a time.
  const once = useSingleFlight();
  // The guard is shared on purpose: a restore must never overlap a backup or a check. So while
  // any of them runs, none of the three may be offered; otherwise a click would be dropped silently.
  const busy = createBackup.isPending || validateBackup.isPending || restoreBackup.isPending;
  const createNow = () => once((settled) => createBackup.mutate(undefined, { onSettled: settled }));

  const validate = () =>
    once((settled) => validateBackup.mutate(undefined, { onSettled: settled }));

  const restore = () => {
    setRestoreOpen(false);
    once((settled) => restoreBackup.mutate(undefined, { onSettled: settled }));
  };

  // A backup made by another installation cannot be opened with this vault's key, but its
  // own password or recovery key opens it.
  const foreignBackup =
    asAppError(restoreBackup.error)?.code === 'BACKUP_KEY_MISMATCH' ||
    asAppError(validateBackup.error)?.code === 'BACKUP_KEY_MISMATCH';

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
              {t('backups.createSuccess')}
            </p>
          )}
          {createBackup.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(createBackup.error, t('app.defaultError'))}
              </AlertDescription>
            </Alert>
          )}
        </Card>

        <Card className="panel backup-action">
          <h3>{t('backups.validateTitle')}</h3>
          <p className="muted">{t('backups.validateHint')}</p>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"

              onClick={validate}
              disabled={busy}
            >
              {validateBackup.isPending ? t('backups.validating') : t('backups.validate')}
            </Button>
          </div>
          {validateBackup.isSuccess && (
            <p className="success" role="status">
              {t('backups.validateSuccess')}
            </p>
          )}
          {validateBackup.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {actionableErrorMessage(validateBackup.error, t('backups.validateFailed'))}
              </AlertDescription>
            </Alert>
          )}
        </Card>

        <Card className="panel backup-action backup-danger">
          <h3>{t('backups.restoreTitle')}</h3>
          <p className="muted">{t('backups.restoreHint')}</p>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              className="danger-outline"
              onClick={() => setRestoreOpen(true)}
              disabled={busy}
            >
              {restoreBackup.isPending ? t('backups.restoring') : t('backups.restore')}
            </Button>
          </div>
          {restoreBackup.isSuccess && (
            <p className="success" role="status">
              {t('backups.restoreSuccess')}
            </p>
          )}
          {restoreBackup.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(restoreBackup.error, t('app.defaultError'))}
              </AlertDescription>
            </Alert>
          )}
          {foreignBackup && (
            <div className="backup-other-installation">
              <p className="muted">{t('backups.restoreOtherHint')}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOtherOpen(true)}
                disabled={busy}
              >
                {t('backups.restoreWithCredentials')}
              </Button>
            </div>
          )}
        </Card>
      </div>
      <p className="security-note backup-offsite">
        <Icon name="shield" size={20} />
        <span>{t('backups.offsiteAdvice')}</span>
      </p>
      <FormDialog
        open={otherOpen}
        onOpenChange={setOtherOpen}
        title={t('backups.restoreOtherTitle')}
      >
        {otherOpen && (
          <RestoreFromBackup
            replacesWorkspace
            onRestored={() => setOtherOpen(false)}
            onCancel={() => setOtherOpen(false)}
          />
        )}
      </FormDialog>
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={t('backups.restore')}
        description={t('backups.restoreWarning')}
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
