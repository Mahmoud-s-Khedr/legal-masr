import assert from 'node:assert/strict';
import test from 'node:test';
import { updaterConfiguration } from './prepare-updater.mjs';
const pubkey = Buffer.from(
  `untrusted comment: test public key\n${Buffer.concat([Buffer.from('Ed'), Buffer.alloc(40)]).toString('base64')}\n`,
).toString('base64');

test('unsigned builds remain available without signing credentials', () => {
  assert.deepEqual(updaterConfiguration({}), { bundle: { createUpdaterArtifacts: false } });
});
test('half-configured or invalid signing configuration fails closed', () => {
  assert.throws(() => updaterConfiguration({ LEGAL_MASR_UPDATER_PUBLIC_KEY: pubkey }), /both/);
  assert.throws(() => updaterConfiguration({ TAURI_SIGNING_PRIVATE_KEY: 'private' }), /both/);
  assert.throws(
    () =>
      updaterConfiguration({
        LEGAL_MASR_UPDATER_PUBLIC_KEY: 'invalid',
        TAURI_SIGNING_PRIVATE_KEY: 'private',
      }),
    /Invalid/,
  );
});
test('signed builds embed only the public key and enable updater artifacts', () => {
  const result = updaterConfiguration({
    LEGAL_MASR_UPDATER_PUBLIC_KEY: pubkey,
    TAURI_SIGNING_PRIVATE_KEY: 'secret-private-key',
  });
  assert.equal(result.bundle.createUpdaterArtifacts, true);
  assert.equal(result.plugins.updater.pubkey, pubkey);
  assert.ok(!JSON.stringify(result).includes('secret-private-key'));
});
