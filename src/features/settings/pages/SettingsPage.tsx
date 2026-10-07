import { UpdateSettings } from '../../updates/UpdateSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { DeveloperContacts } from '../../../components/layout/DeveloperContacts';
import { Icon } from '../../../components/layout/Icon';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/Switch';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { BackupSettingsPanel } from '../../backups/pages/BackupsPage';
import { developerDiagnostic } from '../../../bridge/devDiagnostics';
import {
  useChangePassword,
  useProfile,
  useSetAutostart,
  useSetUsageCounters,
  useSettings,
  useUpdateProfile,
  useUpdateSettings,
} from '../api/settingsApi';
import { SettingsFormValues, settingsSchema } from '../schemas/settings.schema';

type Tab = 'profile' | 'general' | 'security' | 'backups' | 'privacy' | 'about';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: settings,
    isError: settingsLoadFailed,
    isPending: settingsLoading,
    error: settingsError,
    refetch,
  } = useSettings();
  const { data: profile } = useProfile();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const setAutostart = useSetAutostart();
  const setUsageCounters = useSetUsageCounters();
  const [notificationStatus, setNotificationStatus] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown',
  );
  const [saved, setSaved] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settings)
      reset({
        language: settings.language,
        theme: settings.theme,
        dateFormat: settings.dateFormat,
        weekStartsOn: settings.weekStartsOn,
        defaultReminderMinutes: settings.defaultReminderMinutes,
        lockTimeoutMinutes: settings.lockTimeoutMinutes,
      });
  }, [settings, reset]);
  if (settingsLoading) {
    return (
      <section className="settings settings-workspace">
        <p className="loading" role="status">
          {t('settings.loading')}
        </p>
      </section>
    );
  }

  if (settingsLoadFailed || !settings) {
    const diagnostic = developerDiagnostic('settings_get', settingsError);
    return (
      <section className="settings settings-workspace">
        <div className="settings-section">
          <p className="error" role="alert">
            {t('settings.loadError')}
          </p>
          {diagnostic && (
            <pre className="developer-diagnostic" aria-label={t('settings.developerDiagnostic')}>
              {diagnostic}
            </pre>
          )}
          <div className="form-actions">
            <Button type="button" onClick={() => void refetch()}>
              {t('settings.retry')}
            </Button>
          </div>
        </div>
      </section>
    );
  }
  const requested = searchParams.get('tab');
  const selectedTab: Tab =
    requested &&
    ['profile', 'general', 'security', 'backups', 'privacy', 'about'].includes(requested)
      ? (requested as Tab)
      : 'profile';
  const chooseTab = (tab: Tab) => {
    setSearchParams(tab === 'profile' ? {} : { tab });
    setSaved(false);
  };
  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < 12)
      return setPasswordError(t('gate.passwordTooShort', { count: 12 }));
    if (passwords.next !== passwords.confirm) return setPasswordError(t('gate.passwordMismatch'));
    setPasswordError('');
    await changePassword.mutateAsync({
      currentPassword: passwords.current,
      newPassword: passwords.next,
    });
    setPasswords({ current: '', next: '', confirm: '' });
  };
  const enableNotifications = async () => {
    const granted = await isPermissionGranted();
    if (granted) return setNotificationStatus('granted');
    const permission = await requestPermission();
    setNotificationStatus(permission === 'granted' ? 'granted' : 'denied');
  };

  return (
    <section className="settings settings-workspace">
      <PageHeader
        kicker={t('settings.kicker')}
        title={t('settings.title')}
        description={t('settings.description')}
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.sectionsLabel')}>
          {(
            [
              ['profile', 'clients'],
              ['general', 'settings'],
              ['security', 'shield'],
              ['backups', 'backup'],
              ['privacy', 'lock'],
              ['about', 'documents'],
            ] as const
          ).map(([value, icon]) => (
            <Button
              type="button"
              key={value}
              className={selectedTab === value ? 'active' : ''}
              onClick={() => chooseTab(value)}
            >
              <Icon name={icon} size={19} />
              {t(`settings.tabs.${value}`)}
            </Button>
          ))}
        </nav>

        <div className="settings-content">
          {selectedTab === 'profile' && (
            <section className="settings-section">
              <div className="card-title">
                <div>
                  <h3>{t('settings.profile.title')}</h3>
                  <p>{t('settings.profile.hint')}</p>
                </div>
              </div>
              <form
                key={profile?.fullName ?? 'profile-loading'}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  const text = (name: string) => String(values.get(name) ?? '').trim();
                  if (!text('fullName')) return;
                  await updateProfile.mutateAsync({
                    fullName: text('fullName'),
                    barNumber: text('barNumber') || null,
                    phone: text('phone') || null,
                    officeAddress: text('officeAddress') || null,
                    defaultCurrency: 'EGP',
                  });
                  setSaved(true);
                }}
              >
                <label>
                  {t('settings.profile.fullName')}
                  <Input required name="fullName" defaultValue={profile?.fullName ?? ''} />
                </label>
                <div className="settings-two-columns">
                  <label>
                    {t('settings.profile.barNumber')}
                    <Input name="barNumber" defaultValue={profile?.barNumber ?? ''} />
                  </label>
                  <label>
                    {t('settings.profile.phone')}
                    <Input dir="ltr" name="phone" defaultValue={profile?.phone ?? ''} />
                  </label>
                </div>
                <label>
                  {t('settings.profile.officeAddress')}
                  <Textarea name="officeAddress" defaultValue={profile?.officeAddress ?? ''} />
                </label>
                <div className="form-actions">
                  <Button disabled={!profile || updateProfile.isPending}>
                    {t('settings.profile.save')}
                  </Button>
                </div>
                {updateProfile.isError && (
                  <p className="error" role="alert">
                    {t('settings.profile.saveError')}
                  </p>
                )}
                {saved && updateProfile.isSuccess && (
                  <p className="success" role="status">
                    {t('settings.profile.saved')}
                  </p>
                )}
              </form>
            </section>
          )}

          {selectedTab === 'general' && (
            <section className="settings-section">
              <div className="card-title">
                <div>
                  <h3>{t('settings.display.title')}</h3>
                  <p>{t('settings.display.hint')}</p>
                </div>
              </div>
              <form
                onSubmit={handleSubmit(async (values) => {
                  await updateSettings.mutateAsync({
                    ...values,
                  });
                  await i18n.changeLanguage(values.language);
                  setSaved(true);
                })}
              >
                <div className="settings-two-columns">
                  <label>
                    {t('settings.language')}
                    <Controller
                      control={control}
                      name="language"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={[
                            { value: 'ar', label: t('gate.fields.languageAr') },
                            { value: 'en', label: t('gate.fields.languageEn') },
                          ]}
                        />
                      )}
                    />
                  </label>
                  <label>
                    {t('settings.theme')}
                    <Controller
                      control={control}
                      name="theme"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={['system', 'light', 'dark'].map((value) => ({
                            value,
                            label: t(`settings.themes.${value}`),
                          }))}
                        />
                      )}
                    />
                  </label>
                  <label>
                    {t('settings.display.dateFormat')}
                    <Controller
                      control={control}
                      name="dateFormat"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={[
                            { value: 'dd/MM/yyyy', label: t('settings.display.dayFirst') },
                            { value: 'yyyy-MM-dd', label: t('settings.display.yearFirst') },
                          ]}
                        />
                      )}
                    />
                  </label>
                  <label>
                    {t('settings.display.weekStart')}
                    <Controller
                      control={control}
                      name="weekStartsOn"
                      render={({ field }) => (
                        <Select
                          value={String(field.value)}
                          onValueChange={(value) => field.onChange(Number(value))}
                          items={[
                            { value: '6', label: t('settings.display.saturday') },
                            { value: '0', label: t('settings.display.sunday') },
                            { value: '1', label: t('settings.display.monday') },
                          ]}
                        />
                      )}
                    />
                  </label>
                  <label>
                    {t('settings.display.reminder')}
                    <Input
                      type="number"
                      min="0"
                      max="10080"
                      {...register('defaultReminderMinutes', { valueAsNumber: true })}
                    />
                  </label>
                </div>
                {Object.keys(errors).length > 0 && (
                  <p className="error" role="alert">
                    {t('settings.display.invalid')}
                  </p>
                )}
                <div className="form-actions">
                  <Button disabled={updateSettings.isPending}>{t('settings.save')}</Button>
                </div>
                {updateSettings.isError && (
                  <p className="error" role="alert">
                    {t('settings.saveError')}
                  </p>
                )}
                {saved && updateSettings.isSuccess && (
                  <p className="success">{t('settings.saved')}</p>
                )}
              </form>
            </section>
          )}

          {selectedTab === 'security' && (
            <div className="settings-stack">
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>{t('settings.security.lockTitle')}</h3>
                    <p>{t('settings.security.lockHint')}</p>
                  </div>
                </div>
                <form
                  onSubmit={handleSubmit(async (values) => {
                    await updateSettings.mutateAsync({
                      ...values,
                    });
                    setSaved(true);
                  })}
                >
                  <label>
                    {t('settings.lockTimeout')}
                    <Input
                      type="number"
                      min="1"
                      {...register('lockTimeoutMinutes', { valueAsNumber: true })}
                    />
                  </label>
                  <div className="form-actions">
                    <Button>{t('settings.security.lockSave')}</Button>
                  </div>
                </form>
              </section>
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>{t('settings.security.remindersTitle')}</h3>
                    <p>{t('settings.security.remindersHint')}</p>
                  </div>
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.security.autostart')}</strong>
                    <span>{t('settings.security.autostartHint')}</span>
                  </div>
                  <Switch
                    label={t('settings.security.autostart')}
                    checked={settings.autostartEnabled}
                    disabled={setAutostart.isPending}
                    onCheckedChange={(checked) => setAutostart.mutate(checked)}
                  />
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.security.notifications')}</strong>
                    <span>{t('settings.security.notificationsHint')}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="secondary-button"
                    onClick={enableNotifications}
                  >
                    {notificationStatus === 'granted'
                      ? t('settings.security.notificationsGranted')
                      : t('settings.security.notificationsAllow')}
                  </Button>
                </div>
                {notificationStatus === 'denied' && (
                  <p className="warning">{t('settings.security.notificationsDenied')}</p>
                )}
                {setAutostart.isError && (
                  <p className="error" role="alert">
                    {t('settings.security.autostartError')}
                  </p>
                )}
                <p className="muted reminder-disclosure">
                  {t('settings.security.remindersDisclosure')}
                </p>
              </section>
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>{t('settings.security.passwordTitle')}</h3>
                    <p>{t('settings.security.passwordHint')}</p>
                  </div>
                </div>
                <form onSubmit={submitPassword}>
                  <label>
                    {t('settings.security.currentPassword')}
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={passwords.current}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, current: event.target.value }))
                      }
                    />
                  </label>
                  <div className="settings-two-columns">
                    <label>
                      {t('gate.fields.newPassword')}
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={passwords.next}
                        onChange={(event) =>
                          setPasswords((current) => ({ ...current, next: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      {t('gate.fields.confirmPassword')}
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={passwords.confirm}
                        onChange={(event) =>
                          setPasswords((current) => ({ ...current, confirm: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  {passwordError && (
                    <p className="error" role="alert">
                      {passwordError}
                    </p>
                  )}
                  {changePassword.isError && (
                    <p className="error" role="alert">
                      {t('settings.security.passwordError')}
                    </p>
                  )}
                  {changePassword.isSuccess && (
                    <p className="success" role="status">
                      {t('settings.security.passwordChanged')}
                    </p>
                  )}
                  <div className="form-actions">
                    <Button disabled={changePassword.isPending}>
                      {t('settings.security.passwordTitle')}
                    </Button>
                  </div>
                </form>
              </section>
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>{t('settings.security.countersTitle')}</h3>
                    <p>{t('settings.security.countersHint')}</p>
                  </div>
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.security.counters')}</strong>
                    <span>{t('settings.security.countersDetail')}</span>
                  </div>
                  <Switch
                    label={t('settings.security.counters')}
                    checked={settings.usageCountersEnabled}
                    disabled={setUsageCounters.isPending}
                    onCheckedChange={(checked) => setUsageCounters.mutate(checked)}
                  />
                </div>
                {setUsageCounters.isError && (
                  <p className="error" role="alert">
                    {t('settings.security.countersError')}
                  </p>
                )}
              </section>
              <section className="security-note">
                <Icon name="shield" size={22} />
                <div>
                  <strong>{t('settings.security.recoveryTitle')}</strong>
                  <p>{t('settings.security.recoveryHint')}</p>
                </div>
              </section>
            </div>
          )}

          {selectedTab === 'privacy' && (
            <div className="settings-stack">
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>{t('settings.privacy.title')}</h3>
                    <p>{t('settings.privacy.hint')}</p>
                  </div>
                </div>
                <dl className="privacy-list">
                  <div>
                    <dt>{t('settings.privacy.documents')}</dt>
                    <dd>{t('settings.privacy.documentsValue')}</dd>
                  </div>
                  <div>
                    <dt>{t('settings.privacy.backups')}</dt>
                    <dd>{t('settings.privacy.backupsValue')}</dd>
                  </div>
                  <div>
                    <dt>{t('settings.privacy.network')}</dt>
                    <dd>{t('settings.privacy.networkValue')}</dd>
                  </div>
                </dl>
                <div className="form-actions">
                  <Link className="button-link" to="/backups">
                    {t('settings.privacy.manageBackups')}
                  </Link>
                </div>
              </section>
              <section className="security-note">
                <Icon name="lock" size={22} />
                <div>
                  <strong>{t('settings.privacy.documentsNoteTitle')}</strong>
                  <p>{t('settings.privacy.documentsNote')}</p>
                </div>
              </section>
            </div>
          )}

          {selectedTab === 'backups' && (
            <div className="settings-stack">
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>{t('settings.backups.title')}</h3>
                    <p>{t('settings.backups.hint')}</p>
                  </div>
                </div>
                <BackupSettingsPanel />
              </section>
              <section className="security-note">
                <Icon name="backup" size={22} />
                <div>
                  <strong>{t('settings.backups.restoreTitle')}</strong>
                  <p>{t('settings.backups.restoreHint')}</p>
                </div>
              </section>
            </div>
          )}

          {selectedTab === 'about' && (
            <div className="settings-stack">
              <UpdateSettings />
              <section className="settings-section about-section">
                <img src="/logo.png" alt="" />
                <div>
                  <h3>{t('app.brandName')}</h3>
                  <p className="about-tagline">{t('app.brandTagline')}</p>
                  <p>
                    {t('settings.about.version', { version: import.meta.env.VITE_APP_VERSION })}
                  </p>
                  <p>{t('settings.about.description')}</p>
                  <span className="local-status">{t('app.localOnly')}</span>
                </div>
              </section>
              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h3>{t('settings.about.developerTitle')}</h3>
                    <p>{t('settings.about.contactHint')}</p>
                  </div>
                </div>
                <DeveloperContacts />
              </section>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
