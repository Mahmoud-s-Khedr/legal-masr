import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { useSettings, useUpdateSettings } from '../../features/settings/api/settingsApi';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'العربية' : 'English';

  return (
    <Button
      type="button"
      className={['language-switcher', className].filter(Boolean).join(' ')}
      aria-label={label}
      onClick={() => {
        void i18n.changeLanguage(next);
        if (settings) {
          updateSettings.mutate({
            language: next,
            theme: settings.theme,
            dateFormat: settings.dateFormat,
            weekStartsOn: settings.weekStartsOn,
            defaultReminderMinutes: settings.defaultReminderMinutes,
            lockTimeoutMinutes: settings.lockTimeoutMinutes,
          });
        }
      }}
    >
      {label}
    </Button>
  );
}
