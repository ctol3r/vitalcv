import crypto from 'crypto';

export function sha256(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function normalizeLeafHashes(leaves: string[]): string[] {
  const normalized = leaves.map((leaf) => leaf.trim().toLowerCase());
  if (
    normalized.some(
      (leaf) => leaf.length === 0 || leaf.length % 2 !== 0 || !/^[0-9a-f]+$/.test(leaf),
    )
  ) {
    throw new Error('Leaves must be non-empty hexadecimal strings');
  }
  return normalized;
}

export function merkleRoot(leaves: string[]): string | null {
  if (leaves.length === 0) return null;

  const normalizedLeaves = normalizeLeafHashes(leaves);
  let layer = normalizedLeaves.map((leaf) => Buffer.from(leaf, 'hex'));
  while (layer.length > 1) {
    const nextLayer: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      nextLayer.push(crypto.createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    layer = nextLayer;
  }

  return layer[0].toString('hex');
}
