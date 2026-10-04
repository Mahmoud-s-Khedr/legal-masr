import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  useCreateBackup,
  useLatestSuccessfulBackup,
  useRestoreBackup,
  useValidateBackup,
} from '../api/backupsApi';

export function BackupSettingsPanel() {
  const { t } = useTranslation();
  const createBackup = useCreateBackup();
  const validateBackup = useValidateBackup();
  const restoreBackup = useRestoreBackup();
  const latestBackup = useLatestSuccessfulBackup();
  const [restoreOpen, setRestoreOpen] = useState(false);

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

  return (
    <div className="backup-settings">
      <Card className="panel">
        <strong>آخر نسخة احتياطية ناجحة</strong>
        {latestBackup.isLoading ? (
          <Skeleton className="h-5 w-52" aria-label="جارٍ تحميل السجل المحلي…" />
        ) : latestBackup.data ? (
          <p className="muted">
            اكتملت في <bdi>{latestBackup.data.completedAt}</bdi>
            {latestBackup.data.archiveSizeBytes !== null && (
              <>
                {' '}
                · الحجم <bdi>{latestBackup.data.archiveSizeBytes}</bdi> بايت
              </>
            )}
          </p>
        ) : (
          <p className="muted">لا توجد نسخة احتياطية ناجحة بعد.</p>
        )}
      </Card>
      <Card className="panel">
        <div className="form-actions">
          <Button type="button" onClick={createNow} disabled={createBackup.isPending}>
            {createBackup.isPending ? t('backups.creating') : t('backups.createNow')}
          </Button>
        </div>
        {createBackup.isSuccess && <p className="success">{t('backups.createSuccess')}</p>}
        {createBackup.isError && (
          <p className="error">{errorMessage(createBackup.error, t('app.defaultError'))}</p>
        )}
      </Card>

      <Card className="panel">
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
        {validateBackup.isSuccess && <p className="success">{t('backups.validateSuccess')}</p>}
        {validateBackup.isError && <p className="error">{t('backups.validateFailed')}</p>}
      </Card>

      <Card className="panel">
        <div className="form-actions">
          <Button
            type="button"
            variant="destructive"
            className="secondary-button"
            onClick={() => setRestoreOpen(true)}
            disabled={restoreBackup.isPending}
          >
            {restoreBackup.isPending ? t('backups.restoring') : t('backups.restore')}
          </Button>
        </div>
        {restoreBackup.isSuccess && <p className="success">{t('backups.restoreSuccess')}</p>}
        {restoreBackup.isError && (
          <p className="error">{errorMessage(restoreBackup.error, t('app.defaultError'))}</p>
        )}
      </Card>
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={t('backups.restore')}
        description={t('backups.restoreWarning')}
        confirmLabel={t('backups.restoreConfirm')}
        cancelLabel={t('backups.restoreCancel')}
        onConfirm={restore}
        destructive
      />
    </div>
  );
}

export function BackupsPage() {
  const { t } = useTranslation();
  return (
    <section className="work-page backup-page">
      <header className="page-heading">
        <div>
          <p className="kicker">{t('backups.kicker')}</p>
          <h2>{t('backups.title')}</h2>
          <p>{t('backups.description')}</p>
        </div>
      </header>
      <BackupSettingsPanel />
    </section>
  );
}
