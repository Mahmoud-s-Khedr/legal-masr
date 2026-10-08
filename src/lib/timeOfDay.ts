const ARABIC_INDIC = /[٠-٩۰-۹]/g;
// Direction marks the Arabic time formatter adds around «9:30 ص».
const BIDI_MARKS = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g;
const MORNING = /\s*(ص|صباحا|صباحًا|صباحاً|am|a\.m\.?)$/;
const EVENING = /\s*(م|مساء|مساءً|مساءا|مساءاً|pm|p\.m\.?)$/;

/**
 * Reads a time the way lawyers type it — 9:30, 09:30, 9.30, ٩:٣٠, 930, 14:00, 2:00 م,
 * 2 م, 9:30 am — and returns the canonical 24-hour HH:mm, or null when it is not a time.
 * Without ص/م, a single-digit hour from 1 to 6 means the afternoon: courts do not sit at
 * two in the morning. The field shows the result back («2:00 م») so nothing is hidden.
 */
export function normalizeTypedTime(raw: string): string | null {
  let value = raw
    .replace(BIDI_MARKS, '')
    .trim()
    .toLowerCase()
    .replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) & 0xf));
  let meridiem: 'am' | 'pm' | null = null;
  if (MORNING.test(value)) {
    meridiem = 'am';
    value = value.replace(MORNING, '');
  } else if (EVENING.test(value)) {
    meridiem = 'pm';
    value = value.replace(EVENING, '');
  }
  const match = /^(\d{1,2})(?:[:.٫](\d{2}))?$/.exec(value) ?? /^(\d{1,2})(\d{2})$/.exec(value);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (meridiem === 'pm' && hour < 12) hour += 12;
  } else {
    if (hour > 23) return null;
    if (match[1].length === 1 && hour >= 1 && hour <= 6) hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** True for the canonical 24-hour HH:mm the backend stores. */
export function isCanonicalTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
