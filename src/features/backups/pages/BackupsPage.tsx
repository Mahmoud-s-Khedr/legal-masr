import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, isCancelled } from '../../../bridge/errors';
import { FormDialog } from '../../../components/forms/FormDialog';
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
  useSaveBackupCopy,
  useRevealBackup,
} from '../api/backupsApi';
import { RestoreFromBackup } from '../components/RestoreFromBackup';

export function BackupSettingsPanel() {
  const { t } = useTranslation();
  const format = useFormat();
  const createBackup = useCreateBackup();
  const saveCopy = useSaveBackupCopy();
  const reveal = useRevealBackup();
  const latestBackup = useLatestSuccessfulBackup();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  // Backup freshness is judged against when the panel was opened.
  const [openedAt] = useState(() => Date.now());

  // `isPending` lags a render behind a click, so a quick second click would start a
  // second backup, or worse a second restore. Each action may run once at a time.
  const once = useSingleFlight();
  // The guard is shared on purpose: a restore must never overlap a backup or a check. So while
  // any of them runs, none of the three may be offered; otherwise a click would be dropped silently.
  const busy =
    createBackup.isPending || saveCopy.isPending || reveal.isPending || restoreOpen || validateOpen;
  const createNow = () => once((settled) => createBackup.mutate(undefined, { onSettled: settled }));
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

              onClick={() => setValidateOpen(true)}
              disabled={busy}
            >
              {t('backups.validate')}
            </Button>
          </div>
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
              {t('backups.restore')}
            </Button>
          </div>
        </Card>
      </div>
      <p className="security-note backup-offsite">
        <Icon name="shield" size={20} />
        <span>{t('backups.offsiteAdvice')}</span>
      </p>
      {(latest || createBackup.isSuccess) && (
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => once((done) => saveCopy.mutate(undefined, { onSettled: done }))}
          >
            {t('backups.saveCopy')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => once((done) => reveal.mutate(undefined, { onSettled: done }))}
          >
            {t('backups.reveal')}
          </Button>
        </div>
      )}
      {createBackup.data && (
        <p className="success">
          <bdi>{createBackup.data}</bdi>
        </p>
      )}
      {saveCopy.isSuccess && (
        <p role="status">{t('backups.saveCopySuccess', { name: saveCopy.data })}</p>
      )}
      {[saveCopy.error, reveal.error]
        .filter((error) => error && !isCancelled(error))
        .map((error, index) => (
          <Alert key={index} variant="destructive">
            <AlertDescription>{errorMessage(error, t('app.defaultError'))}</AlertDescription>
          </Alert>
        ))}
      <FormDialog
        open={restoreOpen || validateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreOpen(false);
            setValidateOpen(false);
          }
        }}
        title={t(validateOpen ? 'backups.validateTitle' : 'backups.restoreTitle')}
      >
        {(restoreOpen || validateOpen) && (
          <RestoreFromBackup
            replacesWorkspace
            useActiveKey
            validateOnly={validateOpen}
            onRestored={() => setRestoreOpen(false)}
            onCancel={() => {
              setRestoreOpen(false);
              setValidateOpen(false);
            }}
          />
        )}
      </FormDialog>
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
