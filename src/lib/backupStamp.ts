const pad = (value: number) => String(value).padStart(2, '0');

/** The lawyer's local date and time as YYYY-MM-DD-HH-mm-ss, used to name a backup file. */
export function backupStamp(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
