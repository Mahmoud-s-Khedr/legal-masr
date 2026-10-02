import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
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
  await writeArtifact(root, 'raw-windows-x64', 'LegalMaster Solo_0.1.0_x64-setup.exe');
  await writeArtifact(root, 'raw-windows-x64', 'LegalMaster-Solo-windows-x64-portable.zip');
  await writeArtifact(root, 'raw-linux-x64', 'legalmaster-solo_0.1.0_amd64.deb');
  await writeArtifact(root, 'raw-linux-x64', 'legalmaster-solo-0.1.0-1.x86_64.rpm');
  await writeArtifact(root, 'raw-linux-x64', 'legalmaster-solo_0.1.0_amd64.AppImage');
  await writeArtifact(root, 'raw-macos-x64', 'LegalMaster Solo_x86_64.dmg');
  await writeArtifact(root, 'raw-macos-arm64', 'LegalMaster Solo_aarch64.dmg');
  return root;
}

function stage(input, output) {
  return spawnSync(
    process.execPath,
    [script.pathname, 'stage', '--input', input, '--output', output],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    },
  );
}

test('stages every required platform package and checksums', async () => {
  const root = await fixtureRoot();
  const output = join(root, 'release-assets');
  const result = stage(root, output);

  assert.equal(result.status, 0, result.stderr);
  const names = [
    `LegalMaster-Solo_${version}_windows_x64-setup.exe`,
    `LegalMaster-Solo_${version}_windows_x64-portable.zip`,
    `LegalMaster-Solo_${version}_linux_x64.deb`,
    `LegalMaster-Solo_${version}_linux_x64.rpm`,
    `LegalMaster-Solo_${version}_linux_x64.AppImage`,
    `LegalMaster-Solo_${version}_macos_x64.dmg`,
    `LegalMaster-Solo_${version}_macos_arm64.dmg`,
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
