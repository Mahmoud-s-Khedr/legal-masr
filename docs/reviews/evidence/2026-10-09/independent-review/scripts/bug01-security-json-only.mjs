/* global console, document, process, setTimeout */
import { openGuideDesktop } from '../../../../../../scripts/guide-desktop.mjs';
import { copyFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
const out = process.argv[2];
await mkdir(out, { recursive: true });
const stash = join(tmpdir(), `review-bug01b-${randomUUID()}`);
await mkdir(stash);
const password = 'Reviewer fictional password 2026!';
const log = [];
const note = (n, v) => {
  log.push({ n, ...v });
  console.log(n, JSON.stringify(v));
};
let h = await openGuideDesktop('en');
try {
  await h.invoke('app_initialize', {
    input: { fullName: 'Reviewer source', password, language: 'en' },
  });
  await h.invoke('client_create', {
    input: { internalNumber: 'B1B-SRC', fullName: 'Reviewer source client' },
  });
  const archive = await h.invoke('backup_create');
  await copyFile(archive, join(stash, 'a.lmsbackup'));
  await copyFile(join(h.root, 'vault/security.json'), join(stash, 'security.json'));
  await h.close();
  // New installation; place ONLY the old security.json + the backup, then restart so the app re-reads state.
  h = await openGuideDesktop('en');
  await h.wait('form');
  await mkdir(join(h.root, 'vault/Backups'), { recursive: true });
  await copyFile(join(stash, 'security.json'), join(h.root, 'vault/security.json'));
  await copyFile(join(stash, 'a.lmsbackup'), join(h.root, 'vault/Backups/a.lmsbackup'));
  await h.restart();
  await new Promise((r) => setTimeout(r, 1500));
  note('status-with-security-json-only', {
    status: await h.invoke('app_get_status').catch((e) => ({ err: e.code })),
  });
  let r;
  r = await h.invoke('app_unlock', { password }).then(
    () => ({ ok: true }),
    (e) => ({ ok: false, code: e.code }),
  );
  note('unlock-with-original-password', r);
  note('status-after-unlock', {
    status: await h.invoke('app_get_status').catch((e) => ({ err: e.code })),
  });
  await h.selection('backup');
  r = await h.invoke('backup_restore').then(
    () => ({ ok: true }),
    (e) => ({ ok: false, code: e.code }),
  );
  note('restore-attempt', r);
  const body = await h.browser.execute(() => document.body.innerText.slice(0, 300));
  note('ui-text', { body });
  note('vault-files', { files: await readdir(join(h.root, 'vault')) });
} finally {
  await h.close().catch(() => {});
  await writeFile(join(out, 'bug01b.json'), JSON.stringify(log, null, 2));
}
