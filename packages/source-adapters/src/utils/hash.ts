// SHA-256 utility for source adapters

export function sha256Sync(input: string): string {
  // Use Bun/Node built-in crypto via globalThis
  const crypto = (globalThis as any).crypto;
  if (crypto?.createHash) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
  throw new Error('SHA-256 not available');
}
