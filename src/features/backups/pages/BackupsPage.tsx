import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import { useChooseBackupDirectory, useSettings } from '../../settings/api/settingsApi';
import { useCreateBackup, useRestoreBackup, useValidateBackup } from '../api/backupsApi';

export function BackupSettingsPanel() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const chooseBackupDirectory = useChooseBackupDirectory();
  const createBackup = useCreateBackup();
  const validateBackup = useValidateBackup();
  const restoreBackup = useRestoreBackup();
  const [restoreArmed, setRestoreArmed] = useState(false);

  const changeFolder = async () => {
    await chooseBackupDirectory.mutateAsync();
  };

  const createNow = async () => {
    if (!settings?.backupDirectory) return;
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
        <label>{t('backups.folderLabel')}</label>
        <p className="muted" dir="ltr">
          {settings?.backupDirectory || t('backups.noFolder')}
        </p>
        <div className="form-actions">
          <button type="button" onClick={changeFolder} disabled={chooseBackupDirectory.isPending}>
            {t('backups.changeFolder')}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="form-actions">
          <button
            type="button"
            onClick={createNow}
            disabled={createBackup.isPending || !settings?.backupDirectory}
          >
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
