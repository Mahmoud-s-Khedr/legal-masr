import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { baselineRoot, routes, languages, viewports } from './visual-matrix.mjs';

export function pngDimensions(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('Invalid PNG signature');
  let width, height, channels;
  let offset = 8;
  const data = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    if (offset + size + 12 > bytes.length) throw new Error('Truncated PNG');
    const chunk = bytes.subarray(offset + 4, offset + 8 + size);
    let crc = 0xffffffff;
    for (const byte of chunk) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== bytes.readUInt32BE(offset + 8 + size))
      throw new Error('Corrupt PNG chunk');
    const type = chunk.subarray(0, 4).toString();
    if (offset === 8 && type !== 'IHDR') throw new Error('Missing PNG header');
    if (type === 'IHDR') {
      if (width || size !== 13) throw new Error('Invalid PNG header');
      const bitDepth = bytes[offset + 16],
        color = bytes[offset + 17];
      if (
        bitDepth !== 8 ||
        ![2, 6].includes(color) ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        bytes[offset + 20] !== 0
      )
        throw new Error('Unsupported screenshot PNG encoding');
      channels = color === 2 ? 3 : 4;
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      if (!width || !height || width > 20000 || height > 20000)
        throw new Error('Invalid PNG dimensions');
    }
    if (type === 'IDAT') data.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length || !data.length) throw new Error('Incomplete PNG');
  const pixels = inflateSync(Buffer.concat(data), { maxOutputLength: 200_000_000 });
  const stride = width * channels + 1;
  if (pixels.length !== stride * height) throw new Error('Invalid PNG pixel payload');
  for (let row = 0; row < height; row++)
    if (pixels[row * stride] > 4) throw new Error('Invalid PNG row filter');
  return { width, height };
}

export async function verifyManifest(root = baselineRoot, { requireApproval = false } = {}) {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (requireApproval && manifest.status !== 'approved')
    throw new Error('Visual baseline awaits user approval');
  if (!['candidate', 'approved'].includes(manifest.status))
    throw new Error('Invalid baseline status');
  if (!Array.isArray(manifest.captures) || manifest.captures.length !== 64)
    throw new Error('Expected 64 visual captures');
  const expected = new Set(
    routes.flatMap(([route]) =>
      languages.flatMap((language) =>
        viewports.map((v) => `${route}-${language}-${v.width}x${v.height}.png`),
      ),
    ),
  );
  for (const capture of manifest.captures) {
    const { file, language, viewport, sha256, width, height } = capture;
    if (typeof file !== 'string' || !/^[a-z-]+-(ar|en)-(1366x768|1440x900)\.png$/.test(file))
      throw new Error('Unsafe capture filename');
    if (!expected.delete(file)) throw new Error('Duplicate or unsupported capture');
    const [, route, fileLanguage, fileViewport] = file.match(
      /^([a-z-]+)-(ar|en)-(1366x768|1440x900)\.png$/,
    );
    if (
      language !== fileLanguage ||
      viewport !== fileViewport ||
      capture.route !== routes.find(([name]) => name === route)?.[1]
    )
      throw new Error('Mismatched capture identity');
    const path = join(root, file);
    if (!(await lstat(path)).isFile()) throw new Error('Baseline must be a regular file');
    const bytes = await readFile(path);
    if (createHash('sha256').update(bytes).digest('hex') !== sha256)
      throw new Error('Baseline hash mismatch');
    const dimensions = pngDimensions(bytes);
    const [viewportWidth, viewportHeight] = viewport.split('x').map(Number);
    if (
      dimensions.width !== viewportWidth ||
      dimensions.height < viewportHeight ||
      width !== dimensions.width ||
      height !== dimensions.height
    )
      throw new Error('Baseline dimension mismatch');
  }
  if (expected.size) throw new Error('Missing captures');
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = await verifyManifest(process.argv[2] || baselineRoot, {
    requireApproval: process.argv.includes('--approved'),
  });
  console.log(`Verified ${manifest.captures.length} ${manifest.status} visual captures.`);
}
