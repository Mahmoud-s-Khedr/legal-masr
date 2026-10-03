import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = 'docs/visual-baseline/shadcn-migration';
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const routes = [
  'onboarding',
  'dashboard',
  'clients',
  'client-detail',
  'new-client',
  'powers-of-attorney',
  'poa-detail',
  'cases',
  'case-detail',
  'new-case',
  'agenda',
  'tasks',
  'attachments',
  'finances',
  'backups',
  'settings',
];
const expected = routes.length * 2 * 2;
if (!Array.isArray(manifest.captures) || manifest.captures.length !== expected)
  throw new Error(`Expected ${expected} visual captures.`);
const combinations = new Set();
for (const capture of manifest.captures) {
  if (
    !['ar', 'en'].includes(capture.language) ||
    !['1366x768', '1440x900'].includes(capture.viewport)
  )
    throw new Error('Unsupported language or viewport in capture manifest.');
  if (!capture.file.endsWith('.png') || /(?:password|secret|\/home\/|[a-z]:\\)/i.test(capture.file))
    throw new Error('Unsafe capture file name.');
  const route = capture.file.split('.')[0];
  if (!routes.includes(route)) throw new Error(`Unsupported fixture route: ${route}`);
  const identity = `${route}:${capture.language}:${capture.viewport}`;
  if (combinations.has(identity)) throw new Error(`Duplicate capture: ${identity}`);
  combinations.add(identity);
  await access(join(root, capture.file));
}
for (const route of routes)
  for (const language of ['ar', 'en'])
    for (const viewport of ['1366x768', '1440x900'])
      if (!combinations.has(`${route}:${language}:${viewport}`))
        throw new Error(`Missing fixture route capture: ${route}:${language}:${viewport}`);
console.log(`Verified ${manifest.captures.length} redacted visual captures.`);
