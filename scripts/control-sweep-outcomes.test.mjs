import test from 'node:test';
import assert from 'node:assert/strict';
import { hasControlFailures } from './control-sweep-outcomes.mjs';

test('successful controls and explicitly unavailable controls do not fail a sweep', () => {
  assert.equal(
    hasControlFailures([
      { result: 'clicked' },
      { result: 'passed' },
      { result: 'skipped-disabled' },
      { result: 'skipped-hidden' },
      { kind: 'runtime-errors', errors: [] },
    ]),
    false,
  );
});
test('a failed button fails the sweep even when all other buttons work', () => {
  assert.equal(
    hasControlFailures([{ result: 'clicked' }, { kind: 'button', result: 'failed' }]),
    true,
  );
});
test('a keyboard workflow failure fails the sweep', () => {
  assert.equal(hasControlFailures([{ kind: 'global-search-keyboard', result: 'failed' }]), true);
});
test('a renderer exception fails the sweep even without an individual button failure', () => {
  assert.equal(
    hasControlFailures([
      { result: 'clicked' },
      { kind: 'runtime-errors', errors: ['Fictional renderer exception'] },
    ]),
    true,
  );
});
