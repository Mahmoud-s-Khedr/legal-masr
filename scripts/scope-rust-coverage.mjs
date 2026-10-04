import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Merge monomorphizations by source coordinates. Unit-test modules and native
// harnesses must not inflate production floors, even when tests share a file.
export function scopeRustCoverage(raw, lcov, limits) {
  const regions = new Map();
  const functions = new Map();
  const lines = new Map();
  const included = (file, line) => limits.has(file) && line < limits.get(file);
  for (const fn of raw.data[0].functions) {
    const code = fn.regions.filter(
      (region) =>
        region[7] === 0 &&
        included(fn.filenames[region[5]], region[0]) &&
        included(fn.filenames[region[5]], region[2]),
    );
    if (!code.length) continue;
    const first = code[0];
    const functionKey = `${fn.filenames[first[5]]}:${first[0]}:${first[1]}`;
    functions.set(functionKey, Math.max(functions.get(functionKey) ?? 0, fn.count));
    for (const region of code) {
      const key = `${fn.filenames[region[5]]}:${region.slice(0, 4).join(':')}`;
      regions.set(key, Math.max(regions.get(key) ?? 0, region[4]));
    }
  }
  let file = '';
  for (const record of lcov.split('\n')) {
    if (record.startsWith('SF:')) file = record.slice(3);
    if (record.startsWith('DA:')) {
      const [line, count] = record.slice(3).split(',').map(Number);
      if (included(file, line))
        lines.set(`${file}:${line}`, Math.max(lines.get(`${file}:${line}`) ?? 0, count));
    }
  }
  const summarize = (counts) => {
    if (!counts.size) throw new Error('Missing production Rust coverage');
    const covered = [...counts.values()].filter((value) => value > 0).length;
    return { count: counts.size, covered, percent: (covered / counts.size) * 100 };
  };
  return {
    type: 'legalmaster.production-coverage',
    version: 1,
    data: [
      {
        totals: {
          regions: summarize(regions),
          functions: summarize(functions),
          lines: summarize(lines),
        },
      },
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const raw = JSON.parse(await readFile('coverage/rust/raw.json', 'utf8'));
  const lcov = await readFile('coverage/rust/raw.lcov', 'utf8');
  const limits = new Map();
  const source = resolve('src-tauri/src') + '/';
  for (const file of raw.data[0].files) {
    const path = file.filename.replaceAll('\\', '/');
    if (!path.startsWith(source.replaceAll('\\', '/')) || path.endsWith('/desktop_e2e.rs'))
      continue;
    const text = await readFile(file.filename, 'utf8');
    const cutoff = text.split('\n').findIndex((line) => line.trim() === '#[cfg(test)]');
    limits.set(file.filename, cutoff < 0 ? Infinity : cutoff + 1);
  }
  const summary = scopeRustCoverage(raw, lcov, limits);
  await writeFile('coverage/rust/coverage.json', JSON.stringify(summary, null, 2) + '\n');
  console.log('Production Rust coverage:', JSON.stringify(summary.data[0].totals));
  const records = [];
  for (const block of lcov.split('end_of_record')) {
    const entries = block.trim().split('\n');
    const file = entries.find((line) => line.startsWith('SF:'))?.slice(3);
    if (!limits.has(file)) continue;
    const allowedFunctions = new Set(
      entries
        .filter(
          (line) =>
            line.startsWith('FN:') && Number(line.slice(3).split(',')[0]) < limits.get(file),
        )
        .map((line) => line.slice(line.indexOf(',') + 1)),
    );
    records.push(
      entries
        .filter((line) => {
          if (/^(LF|LH|FNF|FNH|BRF|BRH):/.test(line)) return false;
          if (line.startsWith('FN:') || line.startsWith('FNDA:'))
            return allowedFunctions.has(line.slice(line.indexOf(',') + 1));
          if (line.startsWith('DA:')) return Number(line.slice(3).split(',')[0]) < limits.get(file);
          if (line.startsWith('BRDA:'))
            return Number(line.slice(5).split(',')[0]) < limits.get(file);
          return true;
        })
        .join('\n') + '\nend_of_record',
    );
  }
  await writeFile('coverage/rust/lcov.info', records.join('\n') + '\n');
}
