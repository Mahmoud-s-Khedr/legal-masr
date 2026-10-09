import { arEG, enUS, type Locale } from 'date-fns/locale';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../features/settings/api/settingsApi';
import {
  type DateFormatPreference,
  formatBytes,
  formatDateCompact,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatMoney,
  formatNameList,
  formatMonthYear,
  formatNumber,
  formatTime,
  formatWeekday,
} from '../lib/format';

type LocalePresentation = {
  language: 'ar' | 'en';
  direction: 'rtl' | 'ltr';
  dateLocale: Locale;
  weekStartsOn: number;
  dateFormat: DateFormatPreference;
};

export const LocalePresentationContext = createContext<LocalePresentation>({
  language: 'ar',
  direction: 'rtl',
  dateLocale: arEG,
  weekStartsOn: 6,
  dateFormat: 'dd/MM/yyyy',
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
      dateLocale: language === 'ar' ? arEG : enUS,
      weekStartsOn: settings?.weekStartsOn ?? (language === 'ar' ? 6 : 0),
      dateFormat: settings?.dateFormat ?? 'dd/MM/yyyy',
    }),
    [language, settings?.weekStartsOn, settings?.dateFormat],
  );
  return (
    <LocalePresentationContext.Provider value={value}>
      {children}
    </LocalePresentationContext.Provider>
  );
}

export const useLocalePresentation = () => useContext(LocalePresentationContext);

/** Formatters bound to the active interface language and date preference. */
export function useFormat() {
  const { language, dateFormat } = useLocalePresentation();
  return useMemo(
    () => ({
      language,
      date: (value: string) => formatDateShort(value, dateFormat),
      dateLong: (value: string) => formatDateLong(value, language),
      dateCompact: (value: string) => formatDateCompact(value, language),
      dateTime: (value: string) => formatDateTime(value, language),
      monthYear: (date: Date) => formatMonthYear(date, language),
      weekday: (date: Date, width: 'long' | 'short' = 'short') =>
        formatWeekday(date, language, width),
      time: (value: string) => formatTime(value, language),
      money: (amountMinor: number) => formatMoney(amountMinor, language),
      number: (value: number) => formatNumber(value, language),
      bytes: (value: number) => formatBytes(value, language),
      list: (items: readonly string[]) => formatNameList(items, language),
    }),
    [language, dateFormat],
  );
}
