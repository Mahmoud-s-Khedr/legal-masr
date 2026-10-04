import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage, metrics } from './check-coverage.mjs';
const floors = {
  renderer: Object.fromEntries(metrics.renderer.map((key) => [key, 60])),
  rust: Object.fromEntries(metrics.rust.map((key) => [key, 50])),
};
function reports() {
  return {
    policy: { version: 1, floors },
    renderer: { total: Object.fromEntries(metrics.renderer.map((key) => [key, { pct: 60 }])) },
    rust: {
      data: [{ totals: Object.fromEntries(metrics.rust.map((key) => [key, { percent: 50 }])) }],
    },
  };
}
test('accepts unchanged coverage including exact floors', () => {
  const { policy, renderer, rust } = reports();
  assert.equal(checkCoverage(policy, renderer, rust).renderer.lines, 60);
});
for (const [layer, names] of Object.entries(metrics))
  for (const metric of names) {
    test(`rejects below-floor ${layer}.${metric}`, () => {
      const { policy, renderer, rust } = reports();
      if (layer === 'renderer') renderer.total[metric].pct = 59.9;
      else rust.data[0].totals[metric].percent = 49.9;
      assert.throws(() => checkCoverage(policy, renderer, rust), /below floor/);
    });
  }
for (const invalid of [undefined, null, '60', NaN, Infinity, -1, 101])
  test(`rejects malformed percentage ${String(invalid)}`, () => {
    const { policy, renderer, rust } = reports();
    renderer.total.lines.pct = invalid;
    assert.throws(() => checkCoverage(policy, renderer, rust), /Malformed/);
  });
test('rejects missing reports and malformed policy', () => {
  const { policy, renderer, rust } = reports();
  assert.throws(() => checkCoverage(policy, {}, rust));
  assert.throws(() => checkCoverage(policy, renderer, {}));
  assert.throws(() => checkCoverage({}, renderer, rust));
});
