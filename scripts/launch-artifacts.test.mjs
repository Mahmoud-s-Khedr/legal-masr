import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { csvRows, verifyExportEntry, verifySupportEntries } from './launch-artifacts.mjs';
const bytes = Buffer.from('\ufeffid,notes\r\n"1","عربي,\r\nwith ""quotes"""\r\n');
const entry = {
  sizeBytes: bytes.length,
  rowCount: 1,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
test('launch export verifier counts CSV records with Arabic, commas, escaped quotes and embedded lines', () => {
  assert.deepEqual(csvRows(bytes), [
    ['id', 'notes'],
    ['1', 'عربي,\r\nwith "quotes"'],
  ]);
  verifyExportEntry('clients.csv', bytes, entry);
});
test('launch export verifier rejects corruption, wrong counts, missing BOM and unsafe manifest paths', () => {
  for (const change of [{ sizeBytes: 0 }, { rowCount: 2 }, { sha256: '0'.repeat(64) }])
    assert.throws(() => verifyExportEntry('clients.csv', bytes, { ...entry, ...change }));
  assert.throws(() => csvRows(bytes.subarray(3)));
  assert.throws(() => csvRows(Buffer.from('\ufeffid\r\n"unclosed\r\n')));
  for (const name of ['../private.csv', '/tmp/data.csv', 'documents/../data', 'documents\\file'])
    assert.throws(() => verifyExportEntry(name, bytes, entry));
});
const support = () => ({
  'README.txt': 'حزمة دعم / Support bundle',
  'system.json': JSON.stringify({
    applicationVersion: '0.1.0',
    architecture: 'x86_64',
    osFamily: 'linux',
    osVersion: '6.1.0',
    schemaMigrationVersion: 6,
    settings: { language: 'ar', theme: 'light' },
  }),
  'recent-codes.log': '',
  'logs/01.log': 'OPERATION_FAILED',
});
test('launch support verifier accepts the bilingual allowlisted archive', () =>
  verifySupportEntries(support(), ['fictional-secret']));
test('launch support verifier refuses secrets, unexpected files and additional metadata/settings', () => {
  assert.throws(() =>
    verifySupportEntries({ ...support(), 'logs/01.log': 'fictional-secret' }, ['fictional-secret']),
  );
  assert.throws(() => verifySupportEntries({ ...support(), 'vault.sqlite': '' }, []));
  const extra = support();
  const system = JSON.parse(extra['system.json']);
  system.settings.fullName = 'private';
  extra['system.json'] = JSON.stringify(system);
  assert.throws(() => verifySupportEntries(extra, []));
  const missing = support();
  delete missing['README.txt'];
  assert.throws(() => verifySupportEntries(missing, []));
});
