const NON_LATIN_DIGITS = /[٠-٩۰-۹]/g;

/**
 * Parses an amount typed in Egyptian pounds into integer piasters.
 *
 * Accepted: Western, Arabic-Indic or Persian digits; «.» or «٫» as the decimal
 * mark (at most two places); «٬» or a comma as a thousands separator only in
 * strict three-digit groups (1,500 or ١٬٥٠٠); a lone comma before one or two
 * digits as a decimal mark (1250,05). Anything ambiguous, zero, negative or
 * beyond the safe integer range returns null so the caller can explain it.
 */
export function parseMoneyToMinor(value: string): number | null {
  const normalized = value
    .trim()
    .replace(NON_LATIN_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/(ج\.?م\.?|جنيه|EGP|LE)$/i, '');
  let canonical: string | null = null;
  if (/^\d+(\.\d{1,2})?$/.test(normalized)) canonical = normalized;
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(normalized))
    canonical = normalized.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(normalized)) canonical = normalized.replace(',', '.');
  if (!canonical) return null;
  const [pounds, piasters = ''] = canonical.split('.');
  const amount = Number(pounds) * 100 + Number(piasters.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/** Piasters back to an editable pound amount, e.g. 150050 → "1500.50". */
export function minorToInput(amountMinor: number) {
  const pounds = Math.trunc(amountMinor / 100);
  const piasters = Math.abs(amountMinor % 100);
  return piasters ? `${pounds}.${String(piasters).padStart(2, '0')}` : String(pounds);
}
