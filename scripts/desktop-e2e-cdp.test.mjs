import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationTarget } from './desktop-e2e-cdp.mjs';

test('selects only the Tauri application page from Windows debugging targets', () => {
  const target = applicationTarget([
    { type: 'page', url: 'about:blank' },
    { type: 'iframe', url: 'http://tauri.localhost/' },
    { type: 'page', url: 'http://tauri.localhost/' },
  ]);
  assert.equal(target?.type, 'page');
});

test('does not select an unrelated debugging target', () => {
  assert.equal(
    applicationTarget([{ type: 'page', url: 'https://example.test/private?password=fictional' }]),
    undefined,
  );
});
