import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = 'docs/reviews/';
const register = JSON.parse(await readFile(root + '2026-10-08-remediation-register.json', 'utf8'));
const entries = register.entries;
const byId = new Map(entries.map((entry) => [entry.id, entry]));
assert.equal(byId.size, entries.length, 'register IDs must be unique');
const sources = new Map(
  await Promise.all(
    register.sources.map(async (file) => [file, (await readFile(root + file, 'utf8')).split('\n')]),
  ),
);
for (const entry of entries) {
  assert.ok(
    Number.isInteger(entry.ownerPhase) && entry.ownerPhase >= 0 && entry.ownerPhase <= 7,
    entry.id,
  );
  assert.ok(
    sources.get(entry.source.file)?.[entry.source.line - 1],
    entry.id + ': missing source line',
  );
  for (const field of ['scenario', 'acceptance', 'disposition', 'evidenceStatus'])
    assert.ok(entry[field]?.trim(), entry.id + ': ' + field);
  assert.ok(entry.requiredTests.length >= 2, entry.id + ': missing normal/failure tests');
  if (entry.parent) assert.ok(byId.has(entry.parent), entry.id + ': missing parent');
  if (entry.evidenceStatus === 'passed')
    assert.ok(
      entry.evidence.some((item) => item.kind === 'executed' && item.result === 'passed'),
      entry.id + ': static inspection cannot pass an issue',
    );
}
for (const prefix of ['B', 'H']) {
  const count = prefix === 'B' ? 14 : 3;
  for (let number = 1; number <= count; number++)
    assert.ok(byId.has(prefix + String(number).padStart(2, '0')));
}
const appendix = sources.get('2026-10-08-original-agent-findings.md');
let findingCount = 0;
for (let index = 0; index < appendix.length; index++) {
  if (/^(?:\*\*|### )[A-Z]+\d+(?:\b|[. ])/.test(appendix[index])) {
    findingCount++;
    assert.ok(
      entries.some(
        (entry) =>
          !entry.parent &&
          entry.source.file === '2026-10-08-original-agent-findings.md' &&
          entry.source.line === index + 1,
      ),
      'unregistered appendix finding at ' + (index + 1),
    );
  }
}
assert.equal(entries.filter((entry) => entry.scope === 'command-coverage').length, 69);
const review = sources.get('2026-10-08-prelaunch-review.md');
let medium = false;
for (let index = 0; index < review.length; index++) {
  const line = review[index];
  if (line === '### Medium severity') medium = true;
  if (line === '### Low severity and polish') medium = false;
  if (!medium || !line.startsWith('|') || /^\|[\s:-]+\|/.test(line)) continue;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells[0] === 'Area') continue;
  for (const scenario of cells[1].split(';').map((part) => part.trim())) {
    assert.ok(
      entries.some(
        (entry) =>
          entry.source.file === '2026-10-08-prelaunch-review.md' &&
          entry.source.line === index + 1 &&
          entry.scenario === scenario,
      ),
      'unregistered medium constituent: ' + scenario,
    );
  }
}
const audit = sources.get('2026-10-08-coverage-audit.md');
for (let index = 0; index < audit.length; index++) {
  const line = audit[index];
  if (!line.startsWith('|') || /^\|[\s:-]+\|/.test(line)) continue;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (['Route', 'Form / surface', 'Surface', 'Form'].includes(cells[0])) continue;
  const required =
    index < 45 ? cells.slice(1).filter((cell) => cell.includes('G')) : cells.slice(-1);
  for (const cell of required)
    for (const part of cell
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (index < 45 && !part.includes('G')) continue;
      assert.ok(
        entries.some(
          (entry) =>
            entry.source.file === '2026-10-08-coverage-audit.md' &&
            entry.source.line === index + 1 &&
            entry.scenario === cells[0] + ' — ' + part,
        ),
        'unregistered coverage assertion at ' + (index + 1),
      );
    }
}
console.log(
  `Traceability verified: ${entries.length} entries, ${findingCount} scoped appendix findings, 17 blockers/high findings, 69 commands.`,
);
