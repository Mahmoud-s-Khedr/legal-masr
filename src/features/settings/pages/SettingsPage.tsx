import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
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
      return setPasswordError('يجب ألا تقل كلمة المرور الجديدة عن 12 حرفًا.');
    if (passwords.next !== passwords.confirm)
      return setPasswordError('تأكيد كلمة المرور غير مطابق.');
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
        title="الإعدادات"
        description="بيانات مكتبك، حماية الخزنة، وتفضيلات العمل اليومية."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="أقسام الإعدادات">
          {(
            [
              ['profile', 'الملف الشخصي', 'clients'],
              ['general', 'العرض والتقويم', 'settings'],
              ['security', 'الأمان والقفل', 'shield'],
              ['backups', 'النسخ الاحتياطي', 'backup'],
              ['privacy', 'الخصوصية والبيانات', 'backup'],
              ['about', 'حول التطبيق', 'documents'],
            ] as const
          ).map(([value, label, icon]) => (
            <Button
              type="button"
              key={value}
              className={selectedTab === value ? 'active' : ''}
              onClick={() => chooseTab(value)}
            >
              <Icon name={icon} size={19} />
              {label}
            </Button>
          ))}
        </nav>

        <div className="settings-content">
          {selectedTab === 'profile' && (
            <section className="settings-section">
              <div className="card-title">
                <div>
                  <h3>بيانات المحامي</h3>
                  <p>تُستخدم هذه البيانات في العناوين والتقارير المطبوعة فقط.</p>
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
                  اسم المحامي
                  <Input required name="fullName" defaultValue={profile?.fullName ?? ''} />
                </label>
                <div className="settings-two-columns">
                  <label>
                    رقم القيد بالنقابة
                    <Input name="barNumber" defaultValue={profile?.barNumber ?? ''} />
                  </label>
                  <label>
                    رقم الهاتف
                    <Input dir="ltr" name="phone" defaultValue={profile?.phone ?? ''} />
                  </label>
                </div>
                <label>
                  عنوان المكتب
                  <Textarea name="officeAddress" defaultValue={profile?.officeAddress ?? ''} />
                </label>
                <div className="form-actions">
                  <Button disabled={!profile || updateProfile.isPending}>حفظ بيانات المكتب</Button>
                </div>
                {updateProfile.isError && <p className="error">تعذر حفظ بيانات المكتب.</p>}
                {saved && updateProfile.isSuccess && (
                  <p className="success">تم حفظ بيانات المكتب محليًا.</p>
                )}
              </form>
            </section>
          )}

          {selectedTab === 'general' && (
            <section className="settings-section">
              <div className="card-title">
                <div>
                  <h3>العرض والتقويم</h3>
                  <p>تُطبّق اللغة والواجهة فور الحفظ، مع بقاء التواريخ القانونية بلا تحويل زمني.</p>
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
                    تنسيق التاريخ
                    <Controller
                      control={control}
                      name="dateFormat"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={[
                            { value: 'dd/MM/yyyy', label: 'يوم / شهر / سنة' },
                            { value: 'yyyy-MM-dd', label: 'سنة - شهر - يوم' },
                          ]}
                        />
                      )}
                    />
                  </label>
                  <label>
                    بداية الأسبوع
                    <Controller
                      control={control}
                      name="weekStartsOn"
                      render={({ field }) => (
                        <Select
                          value={String(field.value)}
                          onValueChange={(value) => field.onChange(Number(value))}
                          items={[
                            { value: '6', label: 'السبت' },
                            { value: '0', label: 'الأحد' },
                            { value: '1', label: 'الاثنين' },
                          ]}
                        />
                      )}
                    />
                  </label>
                  <label>
                    التذكير الافتراضي قبل الموعد (دقيقة)
                    <Input
                      type="number"
                      min="0"
                      max="10080"
                      {...register('defaultReminderMinutes', { valueAsNumber: true })}
                    />
                  </label>
                </div>
                {Object.keys(errors).length > 0 && (
                  <p className="error">راجع القيم المدخلة في إعدادات العرض.</p>
                )}
                <div className="form-actions">
                  <Button disabled={updateSettings.isPending}>{t('settings.save')}</Button>
                </div>
                {updateSettings.isError && <p className="error">تعذر حفظ الإعدادات.</p>}
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
                    <h3>القفل التلقائي</h3>
                    <p>يقفل التطبيق بعد عدم الاستخدام لحماية بيانات الموكلين.</p>
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
                    <Button>حفظ مدة القفل</Button>
                  </div>
                </form>
              </section>
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>التذكيرات عند تشغيل الجهاز</h3>
                    <p>
                      اسمح بإشعارات عامة وآمنة، وشغّل التطبيق مع تسجيل الدخول حتى تظهر التذكيرات من
                      دون فتحه يدويًا.
                    </p>
                  </div>
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>تشغيل ليجال مصر مع الجهاز</strong>
                    <span>يمكن تعطيله في أي وقت. لا يرسل التطبيق أي بيانات عبر الإنترنت.</span>
                  </div>
                  <Switch
                    label="التشغيل التلقائي مع بدء الجهاز"
                    checked={settings.autostartEnabled}
                    disabled={setAutostart.isPending}
                    onCheckedChange={(checked) => setAutostart.mutate(checked)}
                  />
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>إذن الإشعارات</strong>
                    <span>نص الإشعار لا يعرض أسماء الموكلين أو تفاصيل القضايا.</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="secondary-button"
                    onClick={enableNotifications}
                  >
                    {notificationStatus === 'granted' ? 'تم السماح' : 'السماح بالإشعارات'}
                  </Button>
                </div>
                {notificationStatus === 'denied' && (
                  <p className="warning">تم رفض الإذن. يمكنك تغييره من إعدادات نظام التشغيل.</p>
                )}
                {setAutostart.isError && (
                  <p className="error">تعذر تغيير التشغيل التلقائي على هذا الجهاز.</p>
                )}
                <p className="muted reminder-disclosure">
                  لا تظهر التذكيرات إذا كان التطبيق مغلقًا بالكامل، إلا عند تفعيل التشغيل مع الجهاز
                  وترك التطبيق يعمل.
                </p>
              </section>
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>تغيير كلمة المرور</h3>
                    <p>يُعاد تغليف مفتاح الخزنة؛ لا تُعاد كتابة قاعدة البيانات بالكامل.</p>
                  </div>
                </div>
                <form onSubmit={submitPassword}>
                  <label>
                    كلمة المرور الحالية
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
                      كلمة المرور الجديدة
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
                      تأكيد كلمة المرور
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
                  {passwordError && <p className="error">{passwordError}</p>}
                  {changePassword.isError && (
                    <p className="error">كلمة المرور الحالية غير صحيحة أو تعذر حفظ التغيير.</p>
                  )}
                  {changePassword.isSuccess && <p className="success">تم تغيير كلمة المرور.</p>}
                  <div className="form-actions">
                    <Button disabled={changePassword.isPending}>تغيير كلمة المرور</Button>
                  </div>
                </form>
              </section>
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>عدادات استخدام مجمّعة</h3>
                    <p>
                      اختيارية ومحلية فقط؛ لا تتضمن أسماء أو أرقامًا أو أي بيانات قانونية ولا تُرسل
                      عبر الشبكة.
                    </p>
                  </div>
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>تفعيل العدادات المجمّعة</strong>
                    <span>
                      تسجل أعدادًا إجمالية مثل عدد القضايا أو النسخ الاحتياطية التي أُنشئت.
                    </span>
                  </div>
                  <Switch
                    label="تفعيل العدادات المجمّعة"
                    checked={settings.usageCountersEnabled}
                    disabled={setUsageCounters.isPending}
                    onCheckedChange={(checked) => setUsageCounters.mutate(checked)}
                  />
                </div>
                {setUsageCounters.isError && (
                  <p className="error">تعذر حفظ اختيار العدادات المجمّعة.</p>
                )}
              </section>
              <section className="security-note">
                <Icon name="shield" size={22} />
                <div>
                  <strong>مفتاح الاسترداد مسؤوليتك</strong>
                  <p>
                    احتفظ بالمفتاح الذي ظهر أثناء الإعداد في مكان منفصل وآمن. لا يستطيع الدعم
                    استعادة بياناتك بدونه.
                  </p>
                </div>
              </section>
            </div>
          )}

          {selectedTab === 'privacy' && (
            <div className="settings-stack">
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>مكان البيانات</h3>
                    <p>كل سجلات الموكلين والقضايا تبقى على هذا الجهاز.</p>
                  </div>
                </div>
                <dl className="privacy-list">
                  <div>
                    <dt>مجلد المستندات المُدارة</dt>
                    <dd dir="ltr">داخل مجلد بيانات التطبيق</dd>
                  </div>
                  <div>
                    <dt>مجلد النسخ الاحتياطي</dt>
                    <dd dir="ltr">داخل مجلد بيانات التطبيق/Backups</dd>
                  </div>
                  <div>
                    <dt>الاتصال بالشبكة</dt>
                    <dd>
                      لا تُرسل بيانات القضايا أو الموكلين. لا توجد تحليلات استخدام أو مزامنة سحابية.
                    </dd>
                  </div>
                </dl>
                <div className="form-actions">
                  <Link className="button-link" to="/backups">
                    إدارة النسخ الاحتياطي
                  </Link>
                </div>
              </section>
              <section className="security-note">
                <Icon name="lock" size={22} />
                <div>
                  <strong>المستندات المُدارة ليست خزنة ملفات مشفّرة مستقلة</strong>
                  <p>
                    قاعدة البيانات مشفّرة، أما المرفقات فتستفيد من حماية حساب الجهاز وBitLocker أو
                    FileVault. النسخة الاحتياطية الكاملة مشفّرة.
                  </p>
                </div>
              </section>
            </div>
          )}

          {selectedTab === 'backups' && (
            <div className="settings-stack">
              <section className="settings-section">
                <div className="card-title">
                  <div>
                    <h3>نسخة احتياطية يدوية</h3>
                    <p>
                      تتضمن النسخة قاعدة البيانات المشفرة وكل المرفقات المُدارة. تحقّق منها قبل
                      الاستعادة.
                    </p>
                  </div>
                </div>
                <BackupSettingsPanel />
              </section>
              <section className="security-note">
                <Icon name="backup" size={22} />
                <div>
                  <strong>الاستعادة تستبدل الخزنة الحالية بعد التحقق</strong>
                  <p>
                    احتفظ بنسخة مستقلة قبل الاستعادة. سيُرفض أي أرشيف تالف قبل تغيير البيانات
                    الحالية.
                  </p>
                </div>
              </section>
            </div>
          )}

          {selectedTab === 'about' && (
            <section className="settings-section about-section">
              <img src="/logo.png" alt="" />
              <div>
                <h3>ليجال مصر — LegalMaster Solo</h3>
                <p>الإصدار 0.1.0</p>
                <p>
                  تطبيق مكتبي مجاني يعمل دون اتصال لمساعدة المحامي الفردي في مصر على تنظيم القضايا
                  والجلسات والمهام والأتعاب.
                </p>
                <span className="local-status">محفوظ محليًا</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
