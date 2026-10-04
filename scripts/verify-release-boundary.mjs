import { readFile } from 'node:fs/promises';
// Run against the unpackaged executable produced by a normal packaging build.
const bytes = await readFile(process.argv[2]);
for (const marker of [
  'LEGALMASTER_E2E_ROOT',
  'LEGALMASTER_E2E_NONCE',
  'DESKTOP_E2E_ISOLATION_REQUIRED',
  'runner-marker',
  'dialog-selection',
])
  if (bytes.includes(Buffer.from(marker)))
    throw new Error('Packaging binary contains desktop test adapters');
console.log('Packaging binary contains no desktop harness markers.');
