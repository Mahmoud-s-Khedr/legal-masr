import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, unlink, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { verifyManifest } from './verify-visual-manifest.mjs';
import { routes, languages, viewports } from './visual-matrix.mjs';
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(type, 4);
  data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
function png(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'visual-verifier-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const captures = [];
  for (const [name, route] of routes)
    for (const language of languages)
      for (const v of viewports) {
        const file = `${name}-${language}-${v.width}x${v.height}.png`;
        const bytes = png(v.width, v.height);
        await writeFile(join(root, file), bytes);
        captures.push({
          file,
          route,
          language,
          viewport: `${v.width}x${v.height}`,
          ...v,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
  const manifest = { status: 'candidate', captures };
  const save = () => writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  await save();
  return { root, manifest, save };
}
test('accepts every unique combination and requires explicit approval for release', async (t) => {
  const { root, manifest, save } = await fixture(t);
  assert.equal((await verifyManifest(root)).captures.length, 68);
  await assert.rejects(verifyManifest(root, { requireApproval: true }), /approval/);
  manifest.status = 'approved';
  await save();
  await verifyManifest(root, { requireApproval: true });
});
for (const defect of [
  'missing-entry',
  'duplicate',
  'missing-file',
  'corrupt',
  'hash',
  'traversal',
  'dimensions',
  'symlink',
])
  test(`rejects ${defect}`, async (t) => {
    const { root, manifest, save } = await fixture(t);
    const capture = manifest.captures[0];
    const path = join(root, capture.file);
    if (defect === 'missing-entry') manifest.captures.pop();
    if (defect === 'duplicate') manifest.captures[1] = capture;
    if (defect === 'missing-file') await unlink(path);
    if (defect === 'hash') capture.sha256 = '0'.repeat(64);
    if (defect === 'traversal') capture.file = '../' + capture.file;
    if (defect === 'dimensions') capture.width++;
    if (defect === 'symlink') {
      await unlink(path);
      await symlink(join(root, manifest.captures[1].file), path);
    }
    if (defect === 'corrupt') {
      const bytes = await readFile(path);
      bytes[40] ^= 1;
      await writeFile(path, bytes);
      capture.sha256 = createHash('sha256').update(bytes).digest('hex');
    }
    await save();
    await assert.rejects(verifyManifest(root));
  });
