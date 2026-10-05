import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export const hostGraphicsLibraries = ['libwayland-client.so.0', 'libxkbcommon.so.0'];

export function preferWaylandBackend(gtkHook) {
  const forcedX11 = /^export GDK_BACKEND=x11(?:\s+#.*)?$/m;
  assert.match(
    gtkHook,
    forcedX11,
    'The generated AppImage GTK hook no longer has the expected forced X11 backend.',
  );
  return gtkHook.replace(
    forcedX11,
    '# Prefer the active Wayland session and use X11 only when Wayland is unavailable.\n' +
      'export GDK_BACKEND="${GDK_BACKEND:-wayland,x11}"',
  );
}

async function findAppImagePlugin() {
  const cacheRoot = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  const tauriCache = join(cacheRoot, 'tauri');
  const candidates = (await readdir(tauriCache))
    .filter((entry) => /^linuxdeploy-plugin-appimage(?:[-.].*)?\.AppImage$/.test(entry))
    .sort()
    .map((entry) => join(tauriCache, entry));
  assert.equal(
    candidates.length,
    1,
    `Expected one Tauri-cached linuxdeploy AppImage plugin in ${tauriCache}; found ${candidates.length}.`,
  );
  return candidates[0];
}

async function findOnlyAppImage(directory) {
  const appImages = (await readdir(directory))
    .filter((entry) => entry.endsWith('.AppImage'))
    .map((entry) => join(directory, entry));
  assert.equal(
    appImages.length,
    1,
    `Expected one AppImage in ${directory}; found ${appImages.length}.`,
  );
  return appImages[0];
}

async function readVersion() {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  return packageJson.version;
}

export async function normalizeAppImage(appImagePath) {
  const requestedPath = resolve(appImagePath);
  await access(requestedPath);
  const input = (await readdir(requestedPath).catch(() => null))
    ? await findOnlyAppImage(requestedPath)
    : requestedPath;
  const workDirectory = await mkdtemp(join(tmpdir(), 'legalmaster-appimage-'));
  try {
    await execFile(input, ['--appimage-extract'], { cwd: workDirectory });
    const appDir = join(workDirectory, 'squashfs-root');
    const libraryDirectory = join(appDir, 'usr', 'lib');
    for (const library of hostGraphicsLibraries) await rm(join(libraryDirectory, library));

    const gtkHookPath = join(appDir, 'apprun-hooks', 'linuxdeploy-plugin-gtk.sh');
    const gtkHook = await readFile(gtkHookPath, 'utf8');
    await writeFile(gtkHookPath, preferWaylandBackend(gtkHook));

    const plugin = await findAppImagePlugin();
    await execFile(plugin, ['--appdir', appDir], {
      cwd: workDirectory,
      env: {
        ...process.env,
        APPIMAGE_EXTRACT_AND_RUN: '1',
        ARCH: 'x86_64',
        LINUXDEPLOY_OUTPUT_VERSION: await readVersion(),
      },
    });
    const output = await findOnlyAppImage(workDirectory);
    await rename(output, input);
    console.log(`Normalized ${basename(input)} for native Wayland and X11 graphics libraries.`);
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [appImagePath] = process.argv.slice(2);
  assert.ok(appImagePath, 'Usage: node scripts/normalize-appimage-runtime.mjs <path-to-AppImage>');
  await normalizeAppImage(appImagePath);
}
