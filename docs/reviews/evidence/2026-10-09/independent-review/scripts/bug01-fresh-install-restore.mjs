/* global console, process, Buffer, document */
/* Independent BUG-01 reproduction. Fictional data only; output stays in the scratchpad. */
import { openGuideDesktop } from '../../../../../../scripts/guide-desktop.mjs';
import { copyFile, mkdir, readdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const out = process.argv[2];
await mkdir(out, { recursive: true });
const keep = join(tmpdir(), `review-bug01-${randomUUID()}.lmsbackup`);
const password = 'Reviewer fictional password 2026!';
const log = [];
const note = (name, value) => {
  log.push({ name, ...value });
  console.log(name, JSON.stringify(value));
};
const attempt = async (h, command) => {
  try {
    await h.invoke(command);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code };
  }
};

let h = await openGuideDesktop('en');
try {
  await h.invoke('app_initialize', {
    input: { fullName: 'Reviewer source lawyer', password, language: 'en' },
  });
  const src = await h.invoke('client_create', {
    input: { internalNumber: 'REV-SRC-1', fullName: 'Reviewer source client' },
  });
  const archive = await h.invoke('backup_create');
  await copyFile(archive, keep);
  await h.selection('backup');
  note('source-validate-same-session', await attempt(h, 'backup_validate'));
  // Control: does validation survive an application restart in the SAME installation?
  await h.restart();
  await h.wait('form');
  const status = await h.invoke('app_get_status').catch((e) => ({ err: e.code }));
  note('status-after-restart', { status: JSON.stringify(status).slice(0, 120) });
  await h.invoke('app_unlock', { password }).catch((e) => note('unlock-error', { code: e.code }));
  await h.selection('backup');
  note('source-validate-after-restart-unlock', await attempt(h, 'backup_validate'));
  const contents = await readdir(join(h.root, 'vault'));
  note('source-vault-files', { contents });
  // Control: an obviously corrupt file in the same vault -> which code?
  await h.selection('corrupt');
  note('source-validate-corrupt-file', await attempt(h, 'backup_validate'));
  await h.close();

  // New installation, same password.
  h = await openGuideDesktop('en');
  await h.wait('form');
  const buttons = await h.browser.execute(() =>
    [...document.querySelectorAll('button,a,[role=button]')].map((b) => b.textContent.trim()),
  );
  note('fresh-install-visible-actions', { buttons });
  await writeFile(
    join(out, 'fresh-install.png'),
    Buffer.from(await h.browser.takeScreenshot(), 'base64'),
  );
  await h.invoke('app_initialize', {
    input: { fullName: 'Reviewer destination lawyer', password, language: 'en' },
  });
  const dst = await h.invoke('client_create', {
    input: { internalNumber: 'REV-DST-1', fullName: 'Reviewer destination client' },
  });
  await mkdir(join(h.root, 'vault/Backups'), { recursive: true });
  await copyFile(keep, join(h.root, 'vault/Backups/foreign.lmsbackup'));
  // Only the foreign file is present in Backups? (backup_create was never run here)
  note('dest-backups-dir', { files: await readdir(join(h.root, 'vault/Backups')) });
  await h.selection('backup');
  note('dest-validate-foreign', await attempt(h, 'backup_validate'));
  note('dest-restore-foreign', await attempt(h, 'backup_restore'));
  const list = await h.invoke('client_list', { input: {} });
  note('dest-clients-after', {
    numbers: list.map((c) => c.internalNumber),
    destinationKept: list.some((c) => c.id === dst.id),
    sourceRestored: list.some((c) => c.id === src.id),
  });
  // Control: destination still usable after the refused restore (not locked/interrupted).
  const post = await h.invoke('client_create', {
    input: { internalNumber: 'REV-DST-2', fullName: 'Reviewer second client' },
  });
  note('dest-usable-after-refusal', { created: Boolean(post.id) });
  // Control: destination's own backup validates, proving the code path works for same-key archives.
  await h.invoke('backup_create');
  await h.selection('backup'); // newest sorted file wins; own archive sorts after "foreign"
  note('dest-validate-own-newest', await attempt(h, 'backup_validate'));
} finally {
  await h?.close().catch(() => {});
  await rm(keep, { force: true });
  await writeFile(join(out, 'bug01.json'), JSON.stringify(log, null, 2));
}
