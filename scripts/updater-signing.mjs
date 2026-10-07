// Pairing checks catch release configuration mistakes. Package authentication
// itself remains Tauri's native minisign verification on the user's machine.
export function publicKeyPacket(publicKey) {
  const lines = Buffer.from(publicKey ?? '', 'base64')
    .toString('utf8')
    .trim()
    .split(/\r?\n/);
  const packet = Buffer.from(lines[1] ?? '', 'base64');
  if (
    !lines[0]?.startsWith('untrusted comment:') ||
    packet.length !== 42 ||
    packet.subarray(0, 2).toString() !== 'Ed'
  ) {
    throw new Error('Invalid Tauri updater public key.');
  }
  return packet;
}

export function assertMatchingUpdaterKey(signature, publicKey) {
  const key = publicKeyPacket(publicKey);
  const lines = Buffer.from(signature, 'base64').toString('utf8').trim().split(/\r?\n/);
  const packet = Buffer.from(lines[1] ?? '', 'base64');
  const globalSignature = Buffer.from(lines[3] ?? '', 'base64');
  if (
    packet.length !== 74 ||
    !['Ed', 'ED'].includes(packet.subarray(0, 2).toString()) ||
    !lines[2]?.startsWith('trusted comment: ') ||
    globalSignature.length !== 64
  ) {
    throw new Error('Invalid Tauri updater signature.');
  }
  if (!key.subarray(2, 10).equals(packet.subarray(2, 10))) {
    throw new Error('Updater signature does not match the configured public key.');
  }
}
