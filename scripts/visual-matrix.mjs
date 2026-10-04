export const routes = [
  ['onboarding', '/?captureOnboarding=1', 'input[type="password"]'],
  ['dashboard', '/', '.agenda-timeline'],
  ['clients', '/clients', 'tbody a'],
  ['client-detail', '/clients/demo-client-adel', '.detail-card'],
  ['new-client', '/clients/new', 'form input'],
  ['powers-of-attorney', '/powers-of-attorney', 'tbody a'],
  ['poa-detail', '/powers-of-attorney/demo-poa-1', '.detail-card'],
  ['cases', '/cases', 'tbody a'],
  ['case-detail', '/cases/demo-case-14', '.detail-card'],
  ['new-case', '/cases/new', 'form [role="checkbox"]'],
  ['agenda', '/calendar', '.agenda-item'],
  ['tasks', '/tasks', '.task-records'],
  ['attachments', '/attachments?case=demo-case-14', '.attachment-rows'],
  ['finances', '/finances?case=demo-case-14', 'tbody'],
  ['backups', '/backups', '.backup-settings .muted'],
  ['settings', '/settings', 'form'],
];
export const languages = ['ar', 'en'];
export const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];
export const baselineRoot = 'tests/visual/baseline';
export const fixtureTime = '2026-10-03T09:00:00Z';
