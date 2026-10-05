/** Formats a local calendar date without converting it through UTC. */
export function localDateOnly(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Turns an ISO date-only value into a local calendar date for presentation.
 * This intentionally does not use `new Date("YYYY-MM-DD")`, which treats the
 * input as UTC and can display the previous day in western time zones.
 */
export function dateOnlyToLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
