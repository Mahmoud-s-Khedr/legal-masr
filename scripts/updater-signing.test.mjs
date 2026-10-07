import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMatchingUpdaterKey, publicKeyPacket } from './updater-signing.mjs';
const key = Buffer.concat([Buffer.from('Ed'), Buffer.alloc(40)]);
const publicKey = Buffer.from(`untrusted comment: test\n${key.toString('base64')}\n`).toString(
  'base64',
);
const signature = Buffer.from(
  `untrusted comment: test\n${Buffer.concat([Buffer.from('ED'), Buffer.alloc(72)]).toString('base64')}\ntrusted comment: fixture\n${Buffer.alloc(64).toString('base64')}\n`,
).toString('base64');
test('decodes Tauri-wrapped public keys and matches signature key identifiers', () => {
  assert.deepEqual(publicKeyPacket(publicKey), key);
  assert.doesNotThrow(() => assertMatchingUpdaterKey(signature, publicKey));
});
test('rejects missing and malformed public keys', () => {
  for (const value of [
    undefined,
    '',
    'invalid',
    Buffer.from('untrusted comment: test\nwrong').toString('base64'),
  ]) {
    assert.throws(() => publicKeyPacket(value), /Invalid/);
  }
});
test('rejects missing or malformed signatures', () => {
  for (const value of [
    '',
    'invalid',
    Buffer.from('untrusted comment: test\nwrong').toString('base64'),
  ]) {
    assert.throws(() => assertMatchingUpdaterKey(value, publicKey), /Invalid/);
  }
});
test('refuses unknown signature algorithms', () => {
  const value = Buffer.from(
    `untrusted comment: test\n${Buffer.alloc(74).toString('base64')}\ntrusted comment: test\n${Buffer.alloc(64).toString('base64')}\n`,
  ).toString('base64');
  assert.throws(() => assertMatchingUpdaterKey(value, publicKey), /Invalid/);
});
