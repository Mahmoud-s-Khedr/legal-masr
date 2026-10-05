import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { hostGraphicsLibraries } from './normalize-appimage-runtime.mjs';

const execFile = promisify(execFileCallback);
const [appImagePath] = process.argv.slice(2);
assert.ok(appImagePath, 'Usage: node scripts/verify-appimage-runtime.mjs <path-to-AppImage>');

const requestedPath = resolve(appImagePath);
await access(requestedPath);
const directory = await readdir(requestedPath).catch(() => null);
const appImages = directory?.filter((entry) => entry.endsWith('.AppImage')) || [];
assert.ok(!directory || appImages.length === 1, `Expected one AppImage in ${requestedPath}.`);
const input = directory ? join(requestedPath, appImages[0]) : requestedPath;
const workDirectory = await mkdtemp(join(tmpdir(), 'legalmaster-appimage-verify-'));
try {
  await execFile(input, ['--appimage-extract'], { cwd: workDirectory });
  const appDir = join(workDirectory, 'squashfs-root');
  for (const library of hostGraphicsLibraries) {
    await assert.rejects(access(join(appDir, 'usr', 'lib', library)), /ENOENT/);
  }
  const hook = await readFile(join(appDir, 'apprun-hooks', 'linuxdeploy-plugin-gtk.sh'), 'utf8');
  assert.match(hook, /export GDK_BACKEND="\$\{GDK_BACKEND:-wayland,x11\}"/);
  console.log('AppImage delegates compositor libraries to the host and prefers Wayland.');
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
