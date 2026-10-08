import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DraftForm } from '@/components/forms/DraftForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';
import { profileDraftSchema, passwordDraftSchema } from '@/lib/formSchemas';
import { FieldGroup } from '@/components/ui/field';
import { Field } from '@/components/forms/FormField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { DeveloperContacts } from '../../../components/layout/DeveloperContacts';
import { Icon } from '../../../components/layout/Icon';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '../../../components/ui/select';
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
  const passwordForm = useForm<z.infer<typeof passwordDraftSchema>>({
    resolver: zodResolver(passwordDraftSchema),
    defaultValues: { current: '', next: '', confirm: '' },
  });
  const passwordDraft = useWatch({ control: passwordForm.control });
  const passwords = {
    current: passwordDraft.current ?? '',
    next: passwordDraft.next ?? '',
    confirm: passwordDraft.confirm ?? '',
  };
  const setPasswords = (
    next: typeof passwords | ((current: typeof passwords) => typeof passwords),
  ) => passwordForm.reset(typeof next === 'function' ? next(passwordForm.getValues()) : next);
  const profileForm = useForm<z.infer<typeof profileDraftSchema>>({
    resolver: zodResolver(profileDraftSchema),
    defaultValues: { fullName: '', barNumber: '', phone: '', officeAddress: '' },
  });
  useEffect(() => {
    if (profile && !profileForm.formState.isDirty)
      profileForm.reset({
        fullName: profile.fullName,
        barNumber: profile.barNumber ?? '',
        phone: profile.phone ?? '',
        officeAddress: profile.officeAddress ?? '',
      });
  }, [profile, profileForm]);
  const [passwordError, setPasswordError] = useState('');
  const {
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
          <Alert variant="destructive">
            <AlertDescription>{t('settings.loadError')}</AlertDescription>
          </Alert>
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
  const submitPassword = async () => {
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
        <Tabs
          value={selectedTab}
          onValueChange={(value) => chooseTab(value as Tab)}
          orientation="vertical"
        >
          <TabsList
            variant="line"
            className="settings-nav"
            aria-label={t('settings.sectionsLabel')}
          >
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
              <TabsTrigger key={value} value={value}>
                <Icon name={icon} size={19} />
                {t(`settings.tabs.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="settings-content">
          {selectedTab === 'profile' && (
            <section className="settings-section">
              <div className="card-title">
                <div>
                  <h3>{t('settings.profile.title')}</h3>
                  <p>{t('settings.profile.hint')}</p>
                </div>
              </div>
              <DraftForm
                key={profile?.fullName ?? 'profile-loading'}
                onSubmit={profileForm.handleSubmit(async (values) => {
                  try {
                    await updateProfile.mutateAsync({
                      fullName: values.fullName,
                      barNumber: values.barNumber || null,
                      phone: values.phone || null,
                      officeAddress: values.officeAddress || null,
                      defaultCurrency: 'EGP',
                    });
                    setSaved(true);
                  } catch {
                    /* Keep draft for retry. */
                  }
                })}
              >
                <FieldGroup>
                  <Field
                    label={<>{t('settings.profile.fullName')}</>}
                    required
                    error={profileForm.formState.errors.fullName ? t('forms.required') : undefined}
                  >
                    <Input required {...profileForm.register('fullName')} />
                  </Field>
                  <div className="settings-two-columns">
                    <Field label={<>{t('settings.profile.barNumber')}</>}>
                      <Input {...profileForm.register('barNumber')} />
                    </Field>
                    <Field label={<>{t('settings.profile.phone')}</>}>
                      <Input dir="ltr" {...profileForm.register('phone')} />
                    </Field>
                  </div>
                  <Field label={<>{t('settings.profile.officeAddress')}</>}>
                    <Textarea {...profileForm.register('officeAddress')} />
                  </Field>
                  <div className="form-actions">
                    <Button type="submit" disabled={!profile || updateProfile.isPending}>
                      {t('settings.profile.save')}
                    </Button>
                  </div>
                  {updateProfile.isError && (
                    <Alert variant="destructive">
                      <AlertDescription>{t('settings.profile.saveError')}</AlertDescription>
                    </Alert>
                  )}
                  {saved && updateProfile.isSuccess && (
                    <p className="success" role="status">
                      {t('settings.profile.saved')}
                    </p>
                  )}
                </FieldGroup>
              </DraftForm>
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
              <DraftForm
                onSubmit={handleSubmit(async (values) => {
                  await updateSettings.mutateAsync({
                    ...values,
                  });
                  await i18n.changeLanguage(values.language);
                  setSaved(true);
                })}
              >
                <FieldGroup>
                  <div className="settings-two-columns">
                    <Field label={t('settings.language')}>
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
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={undefined} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {[
                                  { value: 'ar', label: t('gate.fields.languageAr') },
                                  { value: 'en', label: t('gate.fields.languageEn') },
                                ].map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label={t('settings.theme')}>
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
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={undefined} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {['system', 'light', 'dark']
                                  .map((value) => ({
                                    value,
                                    label: t(`settings.themes.${value}`),
                                  }))
                                  .map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label={t('settings.display.dateFormat')}>
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
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={undefined} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {[
                                  { value: 'dd/MM/yyyy', label: t('settings.display.dayFirst') },
                                  { value: 'yyyy-MM-dd', label: t('settings.display.yearFirst') },
                                ].map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label={t('settings.display.weekStart')}>
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
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={undefined} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {[
                                  { value: '6', label: t('settings.display.saturday') },
                                  { value: '0', label: t('settings.display.sunday') },
                                  { value: '1', label: t('settings.display.monday') },
                                ].map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label={<>{t('settings.display.reminder')}</>}>
                      <Controller
                        control={control}
                        name="defaultReminderMinutes"
                        render={({ field }) => {
                          const values = [
                            ...new Set(
                              [...[0, 15, 30, 60, 120, 1440], field.value].filter(
                                (value) => value !== undefined,
                              ),
                            ),
                          ];
                          return (
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => field.onChange(Number(value))}
                            >
                              <SelectTrigger ref={field.ref}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {values.map((value) => (
                                    <SelectItem key={value} value={String(value)}>
                                      {value} {t('settings.minutes')}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          );
                        }}
                      />
                    </Field>
                  </div>
                  {Object.keys(errors).length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>{t('settings.display.invalid')}</AlertDescription>
                    </Alert>
                  )}
                  <div className="form-actions">
                    <Button type="submit" disabled={updateSettings.isPending}>
                      {t('settings.save')}
                    </Button>
                  </div>
                  {updateSettings.isError && (
                    <Alert variant="destructive">
                      <AlertDescription>{t('settings.saveError')}</AlertDescription>
                    </Alert>
                  )}
                  {saved && updateSettings.isSuccess && (
                    <p className="success">{t('settings.saved')}</p>
                  )}
                </FieldGroup>
              </DraftForm>
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
                <DraftForm
                  onSubmit={handleSubmit(async (values) => {
                    await updateSettings.mutateAsync({
                      ...values,
                    });
                    setSaved(true);
                  })}
                >
                  <FieldGroup>
                    <Field label={<>{t('settings.lockTimeout')}</>}>
                      <Controller
                        control={control}
                        name="lockTimeoutMinutes"
                        render={({ field }) => {
                          const values = [
                            ...new Set(
                              [...[1, 5, 10, 15, 30, 60], field.value].filter(
                                (value) => value !== undefined,
                              ),
                            ),
                          ];
                          return (
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => field.onChange(Number(value))}
                            >
                              <SelectTrigger ref={field.ref}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {values.map((value) => (
                                    <SelectItem key={value} value={String(value)}>
                                      {value} {t('settings.minutes')}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          );
                        }}
                      />
                    </Field>
                    <div className="form-actions">
                      <Button type="submit" disabled={updateSettings.isPending}>
                        {t('settings.security.lockSave')}
                      </Button>
                    </div>
                  </FieldGroup>
                </DraftForm>
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
                    aria-label={t('settings.security.autostart')}
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
                  <Alert variant="destructive">
                    <AlertDescription>{t('settings.security.autostartError')}</AlertDescription>
                  </Alert>
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
                <DraftForm onSubmit={passwordForm.handleSubmit(submitPassword)}>
                  <FieldGroup>
                    <Field label={<>{t('settings.security.currentPassword')}</>}>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...passwordForm.register('current')}
                        aria-invalid={!!passwordForm.formState.errors.current}
                      />
                    </Field>
                    <div className="settings-two-columns">
                      <Field label={<>{t('gate.fields.newPassword')}</>}>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          {...passwordForm.register('next')}
                          aria-invalid={!!passwordForm.formState.errors.next}
                        />
                      </Field>
                      <Field
                        label={<>{t('gate.fields.confirmPassword')}</>}
                        error={
                          passwordForm.formState.errors.confirm ? t('forms.invalid') : undefined
                        }
                      >
                        <Input
                          type="password"
                          autoComplete="new-password"
                          {...passwordForm.register('confirm')}
                          aria-invalid={!!passwordForm.formState.errors.confirm}
                        />
                      </Field>
                    </div>
                    {passwordError && (
                      <Alert variant="destructive">
                        <AlertDescription>{passwordError}</AlertDescription>
                      </Alert>
                    )}
                    {changePassword.isError && (
                      <Alert variant="destructive">
                        <AlertDescription>{t('settings.security.passwordError')}</AlertDescription>
                      </Alert>
                    )}
                    {changePassword.isSuccess && (
                      <p className="success" role="status">
                        {t('settings.security.passwordChanged')}
                      </p>
                    )}
                    <div className="form-actions">
                      <Button type="submit" disabled={changePassword.isPending}>
                        {t('settings.security.passwordTitle')}
                      </Button>
                    </div>
                  </FieldGroup>
                </DraftForm>
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
                    aria-label={t('settings.security.counters')}
                    checked={settings.usageCountersEnabled}
                    disabled={setUsageCounters.isPending}
                    onCheckedChange={(checked) => setUsageCounters.mutate(checked)}
                  />
                </div>
                {setUsageCounters.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>{t('settings.security.countersError')}</AlertDescription>
                  </Alert>
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
                  <Link to="/backups">{t('settings.privacy.manageBackups')}</Link>
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
              <section className="settings-section about-section">
                <img src="/logo.png" alt="" />
                <div>
                  <h3>{t('app.brandName')}</h3>
                  <p className="about-tagline">{t('app.brandTagline')}</p>
                  <p>{t('settings.about.version', { version: '0.1.0' })}</p>
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
