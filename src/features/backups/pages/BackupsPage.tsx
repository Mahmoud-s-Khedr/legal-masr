import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Icon } from '../../../components/layout/Icon';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import {
  useCreateBackup,
  useLatestSuccessfulBackup,
  useRestoreBackup,
  useValidateBackup,
} from '../api/backupsApi';

export function BackupSettingsPanel() {
  const { t } = useTranslation();
  const format = useFormat();
  const createBackup = useCreateBackup();
  const validateBackup = useValidateBackup();
  const restoreBackup = useRestoreBackup();
  const latestBackup = useLatestSuccessfulBackup();
  const [restoreOpen, setRestoreOpen] = useState(false);
  // Backup freshness is judged against when the panel was opened.
  const [openedAt] = useState(() => Date.now());

  const createNow = () => {
    createBackup.mutate();
  };

  const validate = () => {
    validateBackup.mutate();
  };

  const restore = () => {
    setRestoreOpen(false);
    restoreBackup.mutate();
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
            <Button type="button" onClick={createNow} disabled={createBackup.isPending}>
              {createBackup.isPending ? t('backups.creating') : t('backups.createNow')}
            </Button>
          </div>
          {createBackup.isSuccess && (
            <p className="success" role="status">
              {t('backups.createSuccess')}
            </p>
          )}
          {createBackup.isError && (
            <p className="error" role="alert">
              {errorMessage(createBackup.error, t('app.defaultError'))}
            </p>
          )}
        </Card>

        <Card className="panel backup-action">
          <h3>{t('backups.validateTitle')}</h3>
          <p className="muted">{t('backups.validateHint')}</p>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              className="secondary-button"
              onClick={validate}
              disabled={validateBackup.isPending}
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
            <p className="error" role="alert">
              {t('backups.validateFailed')}
            </p>
          )}
        </Card>

        <Card className="panel backup-action backup-danger">
          <h3>{t('backups.restoreTitle')}</h3>
          <p className="muted">{t('backups.restoreHint')}</p>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              className="secondary-button danger-outline"
              onClick={() => setRestoreOpen(true)}
              disabled={restoreBackup.isPending}
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
            <p className="error" role="alert">
              {errorMessage(restoreBackup.error, t('app.defaultError'))}
            </p>
          )}
        </Card>
      </div>
      <p className="security-note backup-offsite">
        <Icon name="shield" size={20} />
        <span>{t('backups.offsiteAdvice')}</span>
      </p>
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
