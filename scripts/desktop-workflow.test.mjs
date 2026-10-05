import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/desktop.yml', import.meta.url),
  'utf8',
);

function stepBody(name) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = workflow.indexOf('\n      - name:', start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

test('desktop workflow has a Windows driver preflight after installation', () => {
  const matchDriver = workflow.indexOf(
    '      - name: Match Windows driver to installed WebView2\n',
  );
  const preflight = workflow.indexOf('      - name: Windows desktop-driver preflight\n');

  assert.ok(matchDriver >= 0);
  assert.ok(preflight > matchDriver, 'preflight must follow EdgeDriver installation');
  const body = stepBody('Windows desktop-driver preflight');
  assert.match(body, /Get-Command tauri-driver -CommandType Application -ErrorAction Stop/);
  assert.match(body, /Get-Command msedgedriver -CommandType Application -ErrorAction Stop/);
  assert.match(body, /^ {10}tauri-driver --version$/m);
  assert.match(body, /^ {10}msedgedriver --version$/m);
});

test('Windows retries run all three attempts and retain each available sanitized result', () => {
  const body = stepBody('Windows journeys');

  assert.match(body, /1\.\.3 \| ForEach-Object/);
  assert.match(
    body,
    /Remove-Item test-results\/desktop\/results\.json -Force -ErrorAction SilentlyContinue/,
  );
  assert.match(
    body,
    /Copy-Item test-results\/desktop\/results\.json "test-results\/desktop\/run-\$run\.json" -ErrorAction Stop/,
  );
  assert.match(body, /if \(\$runFailed\) \{ \$anyFailed = \$true \}/);
  assert.match(body, /if \(\$anyFailed\) \{ exit 1 \}/);
  assert.doesNotMatch(body, /if \(\$LASTEXITCODE -ne 0\) \{ exit \$LASTEXITCODE \}/);
});
