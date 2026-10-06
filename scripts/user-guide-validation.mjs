import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function validateGuideManifest(manifest, screens, { requireHashes = false } = {}) {
  assert.equal(manifest.source, 'native-tauri-webkit-real-ipc');
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
  assert.match(manifest.binarySha256, /^[a-f0-9]{64}$/);
  const keys = new Set();
  for (const shot of manifest.screenshots) {
    assert(['ar', 'en'].includes(shot.locale));
    assert(screens.some((screen) => screen.id === shot.id));
    assert(Number.isInteger(shot.part) && shot.part > 0);
    assert.equal(shot.filename, `${shot.id}${shot.part > 1 ? `-${shot.part}` : ''}.png`);
    const key = `${shot.locale}/${shot.filename}`;
    assert(!keys.has(key), 'Duplicate guide screenshot');
    keys.add(key);
    assert.equal(shot.direction, shot.locale === 'ar' ? 'rtl' : 'ltr');
    assert.equal(shot.screenLocale, shot.locale);
    assert(shot.viewport.width >= 1000 && shot.viewport.height >= 600);
    assert(shot.callouts.length > 0);
    for (const box of shot.callouts) {
      assert(Number.isFinite(box.x) && Number.isFinite(box.y));
      assert(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0);
      assert(
        box.x + box.width <= shot.viewport.width + 1 &&
          box.y + box.height <= shot.viewport.height + 1,
      );
      assert(typeof box.label === 'string' && box.label.length > 0);
    }
    if (requireHashes) {
      assert.match(shot.originalSha256, /^[a-f0-9]{64}$/);
      assert.match(shot.annotatedSha256, /^[a-f0-9]{64}$/);
    }
  }
  for (const locale of ['ar', 'en'])
    for (const screen of screens) {
      const parts = manifest.screenshots
        .filter((s) => s.locale === locale && s.id === screen.id)
        .map((s) => s.part)
        .sort((a, b) => a - b);
      assert(parts.length > 0, `Missing guide screenshot: ${locale}/${screen.id}`);
      assert.deepEqual(
        parts,
        parts.map((_, i) => i + 1),
        'Non-contiguous screenshot parts',
      );
    }
  assert(
    !manifest.results.some((result) => result.result === 'failed'),
    'Native guide workflow failed',
  );
}
export function verifyImageBytes(bytes, hash, viewport) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), viewport.width);
  assert.equal(bytes.readUInt32BE(20), viewport.height);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
}
