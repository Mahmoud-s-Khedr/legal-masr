import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/ui/Dialog';
import { updateController, type UpdateMode } from './updateController';

const useUpdates = () =>
  useSyncExternalStore(updateController.subscribe, updateController.getSnapshot);

export function UpdateSync() {
  const { mode } = useUpdates();
  useEffect(() => {
    void updateController.check(true);
    const timer = window.setInterval(() => void updateController.check(true), 6 * 60 * 60 * 1000);
    const online = () => void updateController.check(true);
    window.addEventListener('online', online);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', online);
    };
  }, [mode]);
  return null;
}

export function UpdateNotice() {
  const { t } = useTranslation();
  const { update, phase } = useUpdates();
  if (!update) return null;
  return (
    <p role="status" className="security-note no-print">
      <Link to="/settings?tab=about">
        {t(
          phase === 'downloading'
            ? 'updates.downloading'
            : update.downloaded
              ? 'updates.ready'
              : 'updates.available',
          { version: update.version },
        )}
      </Link>
    </p>
  );
}

export function UpdateInstallDialog() {
  const { t } = useTranslation();
  const { phase } = useUpdates();
  return (
    <Dialog open={phase === 'installing'} onOpenChange={() => {}} title={t('updates.title')}>
      <p role="status" tabIndex={0}>
        {t('updates.installing')}
      </p>
    </Dialog>
  );
}

export function UpdateSettings() {
  const { t } = useTranslation();
  const { status, update, mode, phase, message } = useUpdates();
  const [savedWork, setSavedWork] = useState(false);
  useEffect(() => {
    void updateController.initialize();
  }, []);
  const busy = phase !== 'idle';
  return (
    <section className="settings-section settings-stack" aria-busy={busy}>
      <div className="card-title">
        <div>
          <h3>{t('updates.title')}</h3>
          <p>{t('settings.about.version', { version: status.currentVersion })}</p>
        </div>
      </div>
      <p>{t('updates.privacy')}</p>
      {!status.available ? (
        <p role="status">
          {t(
            status.reason === 'manual-install' ? 'updates.manualInstall' : 'updates.notConfigured',
          )}
        </p>
      ) : (
        <>
          <label>
            {t('updates.preference')}
            <Select
              value={mode}
              disabled={phase === 'installing'}
              onValueChange={(value) => updateController.setMode(value as UpdateMode)}
              items={[
                { value: 'manual', label: t('updates.modes.manual') },
                { value: 'notify', label: t('updates.modes.notify') },
                { value: 'download', label: t('updates.modes.download') },
              ]}
            />
          </label>
          <div className="form-actions">
            <Button type="button" disabled={busy} onClick={() => void updateController.check()}>
              {t('updates.check')}
            </Button>
          </div>
          {update && (
            <div className="settings-stack">
              <h4>{t('updates.available', { version: update.version })}</h4>
              {update.notes && (
                <p className="whitespace-pre-wrap max-h-64 overflow-auto">{update.notes}</p>
              )}
              {!update.downloaded ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateController.download()}
                >
                  {t('updates.download')}
                </Button>
              ) : (
                <>
                  <p>{t('updates.backupHint')}</p>
                  <label className="checkbox-field">
                    <Checkbox checked={savedWork} disabled={busy} onCheckedChange={setSavedWork} />
                    <span className="whitespace-normal">{t('updates.savedWork')}</span>
                  </label>
                  <div className="form-actions">
                    <Button
                      type="button"
                      disabled={busy || !savedWork}
                      onClick={() => {
                        setSavedWork(false);
                        void updateController.install();
                      }}
                    >
                      {t('updates.install')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
      {busy && <p role="status">{t(`updates.${phase}`)}</p>}
      {message && (
        <p role={message.endsWith('Failed') ? 'alert' : 'status'}>{t(`updates.${message}`)}</p>
      )}
    </section>
  );
}
