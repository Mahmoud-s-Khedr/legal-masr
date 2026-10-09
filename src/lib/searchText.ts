const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;
const DIACRITICS_AND_TATWEEL = /[ً-ٰٟـ]/g;

/**
 * Folds the Arabic spelling differences people do not notice when typing — hamza forms
 * of alef, alef maqsura, teh marbuta, diacritics, tatweel, digit scripts, letter case and
 * repeated spaces — so «احمد» finds «أحمد». Mirrors `normalize_text` in the Rust core.
 */
export function normalizeSearchText(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
    .replace(DIACRITICS_AND_TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .split(/\s+/)
    .join(' ')
    .toLocaleLowerCase();
}

/** The digits of a phone number, whichever digits it was typed with. */
export function phoneDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
    .replace(/\D/g, '');
}

/** True when `query` appears in `text` once both are normalized (empty queries match). */
export function matchesSearch(text: string, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  if (normalizeSearchText(text).includes(needle)) return true;
  const digits = phoneDigits(query);
  return digits.length >= 3 && phoneDigits(text).includes(digits);
}
