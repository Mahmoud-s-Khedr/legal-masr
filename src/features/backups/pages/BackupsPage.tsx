import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
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
  const [restoreArmed, setRestoreArmed] = useState(false);

  const createNow = async () => {
    await createBackup.mutateAsync();
  };

  const validate = async () => {
    validateBackup.mutate();
  };

  const restore = async () => {
    if (!restoreArmed) {
      setRestoreArmed(true);
      return;
    }
    setRestoreArmed(false);
    await restoreBackup.mutateAsync();
  };

  return (
    <div className="backup-settings">
      <div className="panel">
        <strong>آخر نسخة احتياطية ناجحة</strong>
        {latestBackup.isLoading ? (
          <p className="muted">جارٍ تحميل السجل المحلي…</p>
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
      </div>
      <div className="panel">
        <div className="form-actions">
          <button type="button" onClick={createNow} disabled={createBackup.isPending}>
            {createBackup.isPending ? t('backups.creating') : t('backups.createNow')}
          </button>
        </div>
        {createBackup.isSuccess && <p className="success">{t('backups.createSuccess')}</p>}
        {createBackup.isError && (
          <p className="error">{errorMessage(createBackup.error, t('app.defaultError'))}</p>
        )}
      </div>

      <div className="panel">
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={validate}
            disabled={validateBackup.isPending}
          >
            {validateBackup.isPending ? t('backups.validating') : t('backups.validate')}
          </button>
        </div>
        {validateBackup.isSuccess && <p className="success">{t('backups.validateSuccess')}</p>}
        {validateBackup.isError && <p className="error">{t('backups.validateFailed')}</p>}
      </div>

      <div className="panel">
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={restore}
            disabled={restoreBackup.isPending}
          >
            {restoreBackup.isPending
              ? t('backups.restoring')
              : restoreArmed
                ? t('backups.restoreConfirm')
                : t('backups.restore')}
          </button>
          {restoreArmed && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRestoreArmed(false)}
            >
              {t('backups.restoreCancel')}
            </button>
          )}
        </div>
        {restoreArmed && <p className="warning">{t('backups.restoreWarning')}</p>}
        {restoreBackup.isSuccess && <p className="success">{t('backups.restoreSuccess')}</p>}
        {restoreBackup.isError && (
          <p className="error">{errorMessage(restoreBackup.error, t('app.defaultError'))}</p>
        )}
      </div>
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
