import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGuideManifest, verifyImageBytes } from './user-guide-validation.mjs';
const screens = [{ id: 'setup' }];
const good = () => ({
  source: 'native-tauri-webkit-real-ipc',
  sourceRevision: 'a'.repeat(40),
  binarySha256: 'b'.repeat(64),
  results: [{ result: 'passed' }],
  screenshots: ['ar', 'en'].map((locale) => ({
    locale,
    screenLocale: locale,
    id: 'setup',
    part: 1,
    filename: 'setup.png',
    direction: locale === 'ar' ? 'rtl' : 'ltr',
    viewport: { width: 1440, height: 900 },
    callouts: [{ x: 10, y: 10, width: 300, height: 50, label: 'Name' }],
  })),
});
test('complete bilingual screen inventory is accepted', () =>
  validateGuideManifest(good(), screens));
test('missing translation, duplicate screenshots, and capture failures cannot publish', () => {
  for (const mutate of [
    (m) => m.screenshots.pop(),
    (m) => m.screenshots.push(m.screenshots[0]),
    (m) => m.results.push({ result: 'failed' }),
    (m) => (m.screenshots[1].screenLocale = 'ar'),
  ]) {
    const m = good();
    mutate(m);
    assert.throws(() => validateGuideManifest(m, screens));
  }
});
test('unsafe filenames and out-of-frame or invalid marks are refused', () => {
  for (const mutate of [
    (m) => (m.screenshots[0].filename = '../security.json'),
    (m) => (m.screenshots[0].callouts[0].x = -1),
    (m) => (m.screenshots[0].callouts[0].width = 2000),
    (m) => (m.screenshots[0].callouts[0].y = NaN),
    (m) => (m.screenshots[0].part = 3),
  ]) {
    const m = good();
    mutate(m);
    assert.throws(() => validateGuideManifest(m, screens));
  }
});
test('malformed screenshot bytes cannot be accepted as a PNG', () =>
  assert.throws(() =>
    verifyImageBytes(Buffer.from('not a PNG'), 'a'.repeat(64), { width: 1440, height: 900 }),
  ));
