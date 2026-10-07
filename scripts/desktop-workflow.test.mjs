import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  assert.match(body, /^ {10}tauri-driver --help$/m);
  assert.match(body, /^ {10}msedgedriver --version$/m);
  assert.match(body, /if \(\$LASTEXITCODE -ne 0\) \{ throw "Tauri driver preflight failed" \}/);
  assert.match(body, /if \(\$LASTEXITCODE -ne 0\) \{ throw "Edge driver preflight failed" \}/);
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

async function runLinuxJourneys(event, failure) {
  const root = await mkdtemp(join(tmpdir(), 'desktop-workflow-test-'));
  try {
    await mkdir(join(root, 'bin'));
    await mkdir(join(root, 'test-results/desktop'), { recursive: true });
    await writeFile(
      join(root, 'bin/xvfb-run'),
      `#!/bin/bash
attempt=1
if [[ -f attempts ]]; then attempt=$(( $(cat attempts) + 1 )); fi
echo "$attempt" > attempts
if [[ "$attempt" == 1 && "$TEST_FAILURE" == missing ]]; then exit 1; fi
echo "{\\"attempt\\":$attempt}" > test-results/desktop/results.json
if [[ "$attempt" == 1 && "$TEST_FAILURE" == failed ]]; then exit 1; fi
`,
      { mode: 0o755 },
    );
    // A missing report must not be replaced with one left by an earlier invocation.
    await writeFile(join(root, 'test-results/desktop/results.json'), '{"stale":true}');
    const body = stepBody('Linux journeys')
      .split('        run: |\n')[1]
      .split('\n')
      .map((line) => line.slice(10))
      .join('\n')
      .replace('${{ github.event_name }}', event);
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', body], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        TEST_FAILURE: failure,
      },
    });
    const files = (await readdir(join(root, 'test-results/desktop'))).filter((name) =>
      name.startsWith('run-'),
    );
    return {
      status: result.status,
      attempts: Number(await readFile(join(root, 'attempts'), 'utf8')),
      reports: await Promise.all(
        files.map((name) => readFile(join(root, 'test-results/desktop', name), 'utf8')),
      ),
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('Linux PR smoke succeeds with one retained outcome', async () => {
  const result = await runLinuxJourneys('pull_request', 'none');
  assert.equal(result.status, 0);
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.reports.map(JSON.parse), [{ attempt: 1 }]);
});

test('Linux push retains all three outcomes and fails after an unsuccessful attempt', async () => {
  const result = await runLinuxJourneys('push', 'failed');
  assert.equal(result.status, 1);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.reports.map(JSON.parse), [
    { attempt: 1 },
    { attempt: 2 },
    { attempt: 3 },
  ]);
});

test('Linux missing outcome fails without retaining a stale report and still runs later attempts', async () => {
  const result = await runLinuxJourneys('push', 'missing');
  assert.equal(result.status, 1);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.reports.map(JSON.parse), [{ attempt: 2 }, { attempt: 3 }]);
});
