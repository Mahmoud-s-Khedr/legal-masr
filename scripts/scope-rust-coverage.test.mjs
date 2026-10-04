import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeRustCoverage } from './scope-rust-coverage.mjs';
test('excludes test/harness regions and merges generic instantiations', () => {
  const fn = (file, line, count) => ({
    filenames: [file],
    count,
    regions: [[line, 1, line, 8, count, 0, 0, 0]],
  });
  const raw = {
    data: [
      {
        functions: [
          fn('production.rs', 2, 0),
          fn('production.rs', 2, 1),
          fn('production.rs', 3, 0),
          fn('production.rs', 20, 1),
          fn('desktop_e2e.rs', 2, 1),
        ],
      },
    ],
  };
  const result = scopeRustCoverage(
    raw,
    'SF:production.rs\nDA:2,1\nDA:3,0\nDA:20,1\nSF:desktop_e2e.rs\nDA:2,1',
    new Map([['production.rs', 10]]),
  );
  for (const metric of ['lines', 'functions', 'regions'])
    assert.deepEqual(result.data[0].totals[metric], { count: 2, covered: 1, percent: 50 });
});
test('rejects empty coverage scope', () =>
  assert.throws(() => scopeRustCoverage({ data: [{ functions: [] }] }, '', new Map()), /Missing/));
