import { dateOnlyToLocalDate } from './dateOnly';

/**
 * Presentation-only formatting. Stored values stay as ISO date-only strings,
 * `HH:mm` times and integer minor units; nothing here is parsed back.
 *
 * Arabic uses the Egyptian locale with the Gregorian calendar (courts and
 * notaries use Gregorian dates) and Western digits, so displayed numbers match
 * the case numbers, phone numbers and amounts lawyers type.
 */
export type DisplayLanguage = 'ar' | 'en';
export type DateFormatPreference = 'dd/MM/yyyy' | 'yyyy-MM-dd';

const localeTag = (language: DisplayLanguage) =>
  language === 'ar' ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB-u-ca-gregory';

/**
 * Joins display names with the interface language's list separator. A fixed
 * separator is used instead of Intl.ListFormat so the output does not depend on
 * the ICU data bundled with each platform web view.
 */
export function formatNameList(items: readonly string[], language: DisplayLanguage) {
  return items.join(language === 'ar' ? '، ' : ', ');
}

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Short numeric date following the lawyer's preference, e.g. 03/10/2026. */
export function formatDateShort(value: string, preference: DateFormatPreference = 'dd/MM/yyyy') {
  if (!isDateOnly(value)) return value;
  if (preference === 'yyyy-MM-dd') return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Full readable date, e.g. «السبت، 3 أكتوبر 2026». */
export function formatDateLong(value: string, language: DisplayLanguage) {
  if (!isDateOnly(value)) return value;
  return new Intl.DateTimeFormat(localeTag(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateOnlyToLocalDate(value));
}

/** Compact readable date without the year, e.g. «الثلاثاء 6 أكتوبر». */
export function formatDateCompact(value: string, language: DisplayLanguage) {
  if (!isDateOnly(value)) return value;
  return new Intl.DateTimeFormat(localeTag(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dateOnlyToLocalDate(value));
}

export function formatMonthYear(date: Date, language: DisplayLanguage) {
  return new Intl.DateTimeFormat(localeTag(language), { month: 'long', year: 'numeric' }).format(
    date,
  );
}

export function formatWeekday(date: Date, language: DisplayLanguage, width: 'long' | 'short') {
  return new Intl.DateTimeFormat(localeTag(language), { weekday: width }).format(date);
}

/** `HH:mm` court time shown on a 12-hour clock, e.g. «10:30 ص». */
export function formatTime(value: string, language: DisplayLanguage) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return new Intl.DateTimeFormat(localeTag(language), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** An instant (e.g. a backup timestamp) in the device's local time. */
export function formatDateTime(value: string, language: DisplayLanguage) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Integer piasters to Egyptian pounds, e.g. 150000 → «1,500.00 ج.م.». */
export function formatMoney(amountMinor: number, language: DisplayLanguage) {
  return new Intl.NumberFormat(localeTag(language), {
    style: 'currency',
    currency: 'EGP',
  }).format(amountMinor / 100);
}

export function formatNumber(value: number, language: DisplayLanguage) {
  return new Intl.NumberFormat(localeTag(language)).format(value);
}

const BYTE_UNITS = {
  ar: ['بايت', 'ك.ب', 'م.ب', 'ج.ب'],
  en: ['B', 'KB', 'MB', 'GB'],
} as const;

export function formatBytes(bytes: number, language: DisplayLanguage) {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.en.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  const number = new Intl.NumberFormat(localeTag(language), {
    maximumFractionDigits: digits,
  }).format(value);
  return `${number} ${BYTE_UNITS[language][unit]}`;
}

/** Whole calendar days from `from` to `to`, both date-only values. */
export function daysBetween(from: string, to: string) {
  const start = dateOnlyToLocalDate(from);
  const end = dateOnlyToLocalDate(to);
  return Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );
}
