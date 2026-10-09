const asciiDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

/**
 * The next free internal number, following the office's own pattern: «C-7» after «C-6»,
 * «2026/016» after «2026/015», «8» after «7». The most used pattern wins; a number already
 * taken is skipped. Without any numbered files it starts at 1.
 */
export function suggestNextNumber(existing: readonly string[]): string {
  const taken = new Set(existing.map((value) => asciiDigits(value).trim().toLowerCase()));
  const patterns = new Map<
    string,
    { count: number; max: number; width: number; prefix: string; suffix: string }
  >();
  for (const value of existing) {
    const match = /^(.*?)(\d+)$/.exec(asciiDigits(value).trim());
    if (!match) continue;
    const withYear = /^(.*?)(\d+)(\s*\/\s*(?:18|19|20|21)\d{2})$/.exec(asciiDigits(value).trim());
    const [, prefix, digits] = withYear ?? match;
    const suffix = withYear?.[3] ?? '';
    const key = JSON.stringify([prefix, suffix]);
    const number = Number(digits);
    if (!Number.isSafeInteger(number) || number === Number.MAX_SAFE_INTEGER) continue;
    const pattern = patterns.get(key) ?? { count: 0, max: -1, width: 0, prefix, suffix };
    pattern.count += 1;
    if (number > pattern.max) {
      pattern.max = number;
      pattern.width = digits.length;
    }
    patterns.set(key, pattern);
  }
  const [, pattern] = [...patterns.entries()].sort(
    ([, a], [, b]) => b.count - a.count || b.max - a.max,
  )[0] ?? ['', { count: 0, max: 0, width: 1, prefix: '', suffix: '' }];
  let next = pattern.max + 1;
  const render = (number: number) =>
    pattern.prefix + String(number).padStart(pattern.width, '0') + pattern.suffix;
  while (taken.has(render(next).toLowerCase())) next += 1;
  return render(next);
}
