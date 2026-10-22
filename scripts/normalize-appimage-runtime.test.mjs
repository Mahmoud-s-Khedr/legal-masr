import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  hostGraphicsLibraries,
  normalizeAppImage,
  preferWaylandBackend,
} from './normalize-appimage-runtime.mjs';

test('AppImage normalization keeps compositor libraries on the host', () => {
  assert.deepEqual(hostGraphicsLibraries, ['libwayland-client.so.0', 'libxkbcommon.so.0']);
});

test('AppImage normalization prefers Wayland with an X11 fallback', () => {
  const hook = '# generated\nexport GDK_BACKEND=x11 # Crash with Wayland backend\n';
  assert.equal(
    preferWaylandBackend(hook),
    '# generated\n' +
      '# Prefer the active Wayland session and use X11 only when Wayland is unavailable.\n' +
      'export GDK_BACKEND="${GDK_BACKEND:-wayland,x11}"\n',
  );
});

test('AppImage normalization refuses an unknown generated launcher hook', () => {
  assert.throws(
    () => preferWaylandBackend('export GDK_BACKEND=wayland\n'),
    /expected forced X11 backend/,
  );
});

async function normalizationFixture(t, failRepack = false) {
  const root = await mkdtemp(join(tmpdir(), 'legalmaster-normalization-test-'));
  const previous = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = join(root, 'cache');
  t.after(async () => {
    if (previous === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous;
    await rm(root, { recursive: true, force: true });
  });
  const directory = join(root, 'bundles');
  await mkdir(directory);
  await mkdir(join(root, 'cache/tauri'), { recursive: true });
  const plugin = join(root, 'cache/tauri/linuxdeploy-plugin-appimage-test.AppImage');
  await writeFile(plugin, 'fictional tool');
  const input = join(directory, 'Fictional.AppImage');
  await writeFile(input, 'original bytes');
  const calls = [];
  const run = async (file, args, { cwd }) => {
    calls.push(file);
    assert.equal(dirname(cwd), directory, 'Repacking must share the destination filesystem');
    const appDir = join(cwd, 'squashfs-root');
    if (file === input) {
      assert.deepEqual(args, ['--appimage-extract']);
      await mkdir(join(appDir, 'usr/lib'), { recursive: true });
      await mkdir(join(appDir, 'apprun-hooks'), { recursive: true });
      for (const name of hostGraphicsLibraries)
        await writeFile(join(appDir, 'usr/lib', name), 'library');
      await writeFile(
        join(appDir, 'apprun-hooks/linuxdeploy-plugin-gtk.sh'),
        'export GDK_BACKEND=x11\n',
      );
    } else {
      assert.equal(file, plugin);
      assert.deepEqual(args, ['--appdir', appDir]);
      for (const name of hostGraphicsLibraries)
        await assert.rejects(access(join(appDir, 'usr/lib', name)), { code: 'ENOENT' });
      assert.match(
        await readFile(join(appDir, 'apprun-hooks/linuxdeploy-plugin-gtk.sh'), 'utf8'),
        /wayland,x11/,
      );
      if (failRepack) throw new Error('FICTIONAL_REPACK_FAILURE');
      await writeFile(join(cwd, 'Normalized.AppImage'), 'normalized bytes');
    }
  };
  return { input, directory, run, calls };
}
test('normalization publishes from a sibling workspace and removes staging', async (t) => {
  const fixture = await normalizationFixture(t);
  await normalizeAppImage(fixture.input, { run: fixture.run });
  assert.equal(await readFile(fixture.input, 'utf8'), 'normalized bytes');
  assert.equal(fixture.calls.length, 2);
  assert.deepEqual(await readdir(fixture.directory), ['Fictional.AppImage']);
});
test('normalization preserves the original image and cleans staging when repacking fails', async (t) => {
  const fixture = await normalizationFixture(t, true);
  await assert.rejects(
    normalizeAppImage(fixture.input, { run: fixture.run }),
    /FICTIONAL_REPACK_FAILURE/,
  );
  assert.equal(await readFile(fixture.input, 'utf8'), 'original bytes');
  assert.deepEqual(await readdir(fixture.directory), ['Fictional.AppImage']);
});
