import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Parse the documented quoted CSV contract independently of the Rust writer.
export function csvRows(bytes) {
  assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
  const text = bytes.subarray(3).toString('utf8');
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === ',') {
      row.push(cell);
      cell = '';
    } else if (!quoted && c === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += c;
  }
  assert.equal(quoted, false);
  assert.equal(cell, '');
  assert.equal(row.length, 0);
  assert(rows.length > 0);
  for (const data of rows) assert.equal(data.length, rows[0].length);
  return rows;
}

export function verifyExportEntry(name, bytes, entry) {
  assert(/^(?:[a-z_]+\.csv|documents\/[A-Za-z0-9_.-]+)$/.test(name));
  assert(!name.includes('..'));
  assert.equal(bytes.length, entry.sizeBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  if (name.endsWith('.csv')) assert.equal(csvRows(bytes).length - 1, entry.rowCount);
  else assert.equal(entry.rowCount, null);
}

export function verifySupportEntries(entries, secrets) {
  const names = Object.keys(entries);
  for (const name of ['README.txt', 'system.json', 'recent-codes.log'])
    assert(names.includes(name));
  assert(
    names.every(
      (name) =>
        ['README.txt', 'system.json', 'recent-codes.log'].includes(name) ||
        /^logs\/\d{2}\.log$/.test(name),
    ),
  );
  const contents = Object.values(entries).join('\n');
  for (const secret of secrets) assert(!contents.includes(secret));
  const system = JSON.parse(entries['system.json']);
  assert.deepEqual(Object.keys(system).sort(), [
    'applicationVersion',
    'architecture',
    'osFamily',
    'osVersion',
    'schemaMigrationVersion',
    'settings',
  ]);
  assert.deepEqual(Object.keys(system.settings).sort(), ['language', 'theme']);
  assert.equal(system.schemaMigrationVersion, 6);
}
