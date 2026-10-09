/* global document */
import { openGuideDesktop } from './guide-desktop.mjs';
import { copyFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

// Never retain vaults, archives, passwords, keys or native document paths.
const output = 'docs/reviews/evidence/2026-10-09/full-test/portability';
await mkdir(output, { recursive: true });
const temporaryArchive = join(tmpdir(), `legalmaster-portability-${randomUUID()}`);
const password = 'Fictional portability password 2026';
const results = [];
let h;
try {
  h = await openGuideDesktop('en');
  await h.invoke('app_initialize', {
    input: { fullName: 'Fictional source lawyer', password, language: 'en' },
  });
  const client = await h.invoke('client_create', {
    input: { internalNumber: 'PORTABLE-SOURCE', fullName: 'Fictional source client' },
  });
  const archive = await h.invoke('backup_create');
  await copyFile(archive, temporaryArchive);
  await h.selection('backup');
  await h.invoke('backup_validate');
  results.push({ scenario: 'source-vault-validates-own-backup', result: 'passed' });
  await h.close();
  h = await openGuideDesktop('en');
  await h.wait('form');
  await writeFile(
    join(output, 'fresh-install-setup.png'),
    Buffer.from(await h.browser.takeScreenshot(), 'base64'),
  );
  const restoreControlCount = await h.browser.execute(
    () =>
      [...document.querySelectorAll('button')].filter((el) => /restore|استعاد/.test(el.textContent))
        .length,
  );
  results.push({
    scenario: 'fresh-install-restore-entry-point',
    result: restoreControlCount ? 'passed' : 'defect-confirmed',
    restoreControlCount,
  });
  await h.invoke('app_initialize', {
    input: { fullName: 'Fictional destination lawyer', password, language: 'en' },
  });
  const retained = await h.invoke('client_create', {
    input: { internalNumber: 'PORTABLE-DESTINATION', fullName: 'Fictional destination client' },
  });
  await mkdir(join(h.root, 'vault/Backups'), { recursive: true });
  await copyFile(temporaryArchive, join(h.root, 'vault/Backups/foreign.lmsbackup'));
  await h.selection('backup');
  for (const command of ['backup_validate', 'backup_restore']) {
    let code;
    try {
      await h.invoke(command);
    } catch (error) {
      code = error.code;
    }
    results.push({
      scenario: `${command}-different-vault-same-original-password`,
      result: code ? 'defect-confirmed' : 'passed',
      errorCode: code,
    });
  }
  assert.equal(
    (await h.invoke('client_get', { id: retained.id })).internalNumber,
    'PORTABLE-DESTINATION',
  );
  const clients = await h.invoke('client_list', { input: {} });
  assert(!clients.some((item) => item.id === client.id));
  results.push({ scenario: 'failed-foreign-restore-preserves-destination', result: 'passed' });
} finally {
  await h?.close();
  await rm(temporaryArchive, { force: true });
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results));
