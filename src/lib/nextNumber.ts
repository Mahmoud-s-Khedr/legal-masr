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
  const patterns = new Map<string, { count: number; max: number; width: number }>();
  for (const value of existing) {
    const match = /^(.*?)(\d+)$/.exec(asciiDigits(value).trim());
    if (!match) continue;
    const [, prefix, digits] = match;
    const number = Number(digits);
    if (!Number.isSafeInteger(number)) continue;
    const pattern = patterns.get(prefix) ?? { count: 0, max: -1, width: 0 };
    pattern.count += 1;
    if (number > pattern.max) {
      pattern.max = number;
      pattern.width = digits.length;
    }
    patterns.set(prefix, pattern);
  }
  const [prefix, pattern] = [...patterns.entries()].sort(
    ([, a], [, b]) => b.count - a.count || b.max - a.max,
  )[0] ?? ['', { count: 0, max: 0, width: 1 }];
  let next = pattern.max + 1;
  const render = (number: number) => prefix + String(number).padStart(pattern.width, '0');
  while (taken.has(render(next).toLowerCase())) next += 1;
  return render(next);
}
