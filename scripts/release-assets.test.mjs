import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = new URL('..', import.meta.url);
const script = new URL('./release-assets.mjs', import.meta.url);
const version = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
).version;

async function writeArtifact(root, directory, name, contents = name) {
  const artifactDirectory = join(root, directory);
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(join(artifactDirectory, name), contents);
}

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'legalmaster-release-assets-'));
  await writeArtifact(root, 'raw-windows-x64', 'Legal Masr_0.1.0_x64-setup.exe');
  await writeArtifact(root, 'raw-windows-x64', 'Legal-Masr-windows-x64-portable.zip');
  await writeArtifact(root, 'raw-linux-x64', 'legalmaster-solo_0.1.0_amd64.deb');
  await writeArtifact(root, 'raw-linux-x64', 'legalmaster-solo-0.1.0-1.x86_64.rpm');
  await writeArtifact(root, 'raw-linux-x64', 'legalmaster-solo_0.1.0_amd64.AppImage');
  await writeArtifact(root, 'raw-macos-x64', 'Legal Masr_x86_64.dmg');
  await writeArtifact(root, 'raw-macos-arm64', 'Legal Masr_aarch64.dmg');
  return root;
}

const pubkey = Buffer.from(
  `untrusted comment: fixture public key\n${Buffer.concat([Buffer.from('Ed'), Buffer.alloc(40)]).toString('base64')}\n`,
).toString('base64');
const signature = Buffer.from(
  `untrusted comment: fixture signature\n${Buffer.concat([Buffer.from('ED'), Buffer.alloc(72)]).toString('base64')}\ntrusted comment: fixture\n${Buffer.alloc(64).toString('base64')}\n`,
).toString('base64');

function stage(input, output, updater = false) {
  return spawnSync(
    process.execPath,
    [
      script.pathname,
      'stage',
      '--input',
      input,
      '--output',
      output,
      ...(updater ? ['--updater'] : []),
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, LEGAL_MASR_UPDATER_PUBLIC_KEY: pubkey },
    },
  );
}

test('stages every required platform package and checksums', async () => {
  const root = await fixtureRoot();
  const output = join(root, 'release-assets');
  const result = stage(root, output);

  assert.equal(result.status, 0, result.stderr);
  const names = [
    `Legal-Masr_${version}_windows_x64-setup.exe`,
    `Legal-Masr_${version}_windows_x64-portable.zip`,
    `Legal-Masr_${version}_linux_x64.deb`,
    `Legal-Masr_${version}_linux_x64.rpm`,
    `Legal-Masr_${version}_linux_x64.AppImage`,
    `Legal-Masr_${version}_macos_x64.dmg`,
    `Legal-Masr_${version}_macos_arm64.dmg`,
  ];
  const sums = await readFile(join(output, 'SHA256SUMS.txt'), 'utf8');
  for (const name of names) {
    assert.ok(sums.includes(`  ${name}\n`), `checksum missing for ${name}`);
    assert.ok((await readFile(join(output, name))).length > 0, `artifact missing: ${name}`);
  }
});

test('refuses to stage an incomplete release', async () => {
  const incomplete = await mkdtemp(join(tmpdir(), 'legalmaster-release-assets-incomplete-'));
  const output = join(incomplete, 'release-assets');
  await writeArtifact(incomplete, 'raw-windows-x64', 'installer.exe');
  await writeArtifact(incomplete, 'raw-windows-x64', 'portable.zip');
  await writeArtifact(incomplete, 'raw-linux-x64', 'package.deb');
  await writeArtifact(incomplete, 'raw-linux-x64', 'package.AppImage');
  await writeArtifact(incomplete, 'raw-macos-x64', 'intel.dmg');
  await writeArtifact(incomplete, 'raw-macos-arm64', 'arm64.dmg');

  const incompleteResult = stage(incomplete, output);
  assert.notEqual(incompleteResult.status, 0);
  assert.match(
    incompleteResult.stderr,
    /Expected one Windows installer, portable archive, Debian package, RPM package, AppImage/,
  );
});

async function signedFixture() {
  const root = await fixtureRoot();
  for (const [directory, name] of [
    ['raw-windows-x64', 'Legal Masr_0.1.0_x64-setup.exe'],
    ['raw-linux-x64', 'legalmaster-solo_0.1.0_amd64.AppImage'],
    ['raw-macos-x64', 'Legal Masr.app.tar.gz'],
    ['raw-macos-arm64', 'Legal Masr.app.tar.gz'],
  ]) {
    if (name.endsWith('.tar.gz')) await writeArtifact(root, directory, name);
    await writeArtifact(root, directory, `${name}.sig`, signature);
  }
  return root;
}

test('signed releases advertise exactly the four native updater packages', async () => {
  const root = await signedFixture();
  const output = join(root, 'release-assets');
  const result = stage(root, output, true);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(join(output, 'latest.json'), 'utf8'));
  assert.equal(manifest.version, version);
  assert.deepEqual(Object.keys(manifest.platforms).sort(), [
    'darwin-aarch64',
    'darwin-x86_64',
    'linux-x86_64',
    'windows-x86_64',
  ]);
  for (const { url, signature } of Object.values(manifest.platforms)) {
    const file = new URL(url).pathname.split('/').at(-1);
    assert.ok(
      url.startsWith(
        `https://github.com/Mahmoud-s-Khedr/legal-masr/releases/download/v${version}/`,
      ),
    );
    assert.equal(signature, (await readFile(join(output, `${file}.sig`), 'utf8')).trim());
    assert.ok((await readFile(join(output, file))).length > 0);
  }
  const sums = await readFile(join(output, 'SHA256SUMS.txt'), 'utf8');
  assert.match(sums, / {2}latest.json\n/);
  assert.match(sums, /\.app.tar.gz.sig\n/);
});

test('signed releases reject a missing signature rather than advertise an unusable update', async () => {
  const root = await signedFixture();
  await unlink(join(root, 'raw-linux-x64', 'legalmaster-solo_0.1.0_amd64.AppImage.sig'));
  const result = stage(root, join(root, 'release-assets'), true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AppImage.sig/);
});

test('signed releases reject missing macOS updater archives', async () => {
  const root = await signedFixture();
  await unlink(join(root, 'raw-macos-arm64', 'Legal Masr.app.tar.gz'));
  const result = stage(root, join(root, 'release-assets'), true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected one updater archive/);
});

test('signed releases reject a mismatched public signing key', async () => {
  const root = await signedFixture();
  const mismatched = Buffer.from(
    `untrusted comment: fixture\n${Buffer.concat([Buffer.from('ED'), Buffer.alloc(72, 1)]).toString('base64')}\ntrusted comment: fixture\n${Buffer.alloc(64).toString('base64')}\n`,
  ).toString('base64');
  await writeArtifact(root, 'raw-windows-x64', 'Legal Masr_0.1.0_x64-setup.exe.sig', mismatched);
  const result = stage(root, join(root, 'release-assets'), true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match/);
});
