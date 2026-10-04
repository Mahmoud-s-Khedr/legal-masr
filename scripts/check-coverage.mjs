import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const metrics = {
  renderer: ['statements', 'branches', 'functions', 'lines'],
  rust: ['regions', 'functions', 'lines'],
};
function percentage(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)
    throw new Error(`Malformed coverage: ${label}`);
  return value;
}
export function measurements(renderer, rust) {
  const result = { renderer: {}, rust: {} };
  for (const metric of metrics.renderer)
    result.renderer[metric] = percentage(renderer?.total?.[metric]?.pct, `renderer.${metric}`);
  for (const metric of metrics.rust)
    result.rust[metric] = percentage(rust?.data?.[0]?.totals?.[metric]?.percent, `rust.${metric}`);
  return result;
}
export function checkCoverage(policy, renderer, rust) {
  if (policy?.version !== 1) throw new Error('Malformed coverage policy');
  const actual = measurements(renderer, rust);
  for (const [layer, names] of Object.entries(metrics))
    for (const metric of names) {
      const floor = percentage(policy?.floors?.[layer]?.[metric], `${layer}.${metric} floor`);
      if (actual[layer][metric] < floor)
        throw new Error(
          `Coverage below floor: ${layer}.${metric} ${actual[layer][metric]} < ${floor}`,
        );
    }
  return actual;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [policy, renderer, rust] = await Promise.all(
    [
      'tests/coverage-policy.json',
      'coverage/renderer/coverage-summary.json',
      'coverage/rust/coverage.json',
    ].map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
  );
  console.log(JSON.stringify(checkCoverage(policy, renderer, rust)));
}
