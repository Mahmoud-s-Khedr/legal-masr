import { publicKeyPacket } from './updater-signing.mjs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function updaterConfiguration(env) {
  const publicKey = env.LEGAL_MASR_UPDATER_PUBLIC_KEY?.trim();
  const privateKey = env.TAURI_SIGNING_PRIVATE_KEY?.trim();
  if (!publicKey && !privateKey) return { bundle: { createUpdaterArtifacts: false } };
  if (!publicKey || !privateKey)
    throw new Error('Updater builds require both a public key and a private signing key.');
  publicKeyPacket(publicKey);
  return { bundle: { createUpdaterArtifacts: true }, plugins: { updater: { pubkey: publicKey } } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeFile(
    'release-updater.conf.json',
    `${JSON.stringify(updaterConfiguration(process.env), null, 2)}\n`,
  );
}
