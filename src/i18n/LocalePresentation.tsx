import { arSA, enUS, type Locale } from 'date-fns/locale';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../features/settings/api/settingsApi';

type LocalePresentation = {
  language: 'ar' | 'en';
  direction: 'rtl' | 'ltr';
  dateLocale: Locale;
  weekStartsOn: number;
};

export const LocalePresentationContext = createContext<LocalePresentation>({
  language: 'ar',
  direction: 'rtl',
  dateLocale: arSA,
  weekStartsOn: 6,
});

/** Presentation preferences only. Stored date-only values remain ISO strings. */
export function LocalePresentationProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { data: settings } = useSettings();
  // i18next is changed optimistically by the selector/settings form. Do not let a
  // stale settings query briefly flip the interface back while that write settles.
  const language = (i18n.language === 'en' ? 'en' : 'ar') as 'ar' | 'en';
  const value = useMemo<LocalePresentation>(
    () => ({
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
      dateLocale: language === 'ar' ? arSA : enUS,
      weekStartsOn: settings?.weekStartsOn ?? (language === 'ar' ? 6 : 0),
    }),
    [language, settings?.weekStartsOn],
  );
  return (
    <LocalePresentationContext.Provider value={value}>
      {children}
    </LocalePresentationContext.Provider>
  );
}

export const useLocalePresentation = () => useContext(LocalePresentationContext);
