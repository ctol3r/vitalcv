import { randomBytes } from 'crypto';

const NONCE_TTL_MS = 5 * 60 * 1000;

type NonceRecord = {
  readonly expiresAt: number;
  used: boolean;
};

const nonceTable = new Map<string, NonceRecord>();

function cleanupExpired(now: number): void {
  for (const [nonce, record] of nonceTable.entries()) {
    if (record.expiresAt <= now) {
      nonceTable.delete(nonce);
    }
  }
}

export function issueNonce(now = Date.now()): { nonce: string; expiresInSeconds: number } {
  cleanupExpired(now);
  const nonce = randomBytes(32).toString('base64url');
  nonceTable.set(nonce, { expiresAt: now + NONCE_TTL_MS, used: false });
  return { nonce, expiresInSeconds: NONCE_TTL_MS / 1000 };
}

export type ConsumeNonceResult = 'accepted' | 'missing' | 'expired' | 'replay';

export function consumeNonce(nonce: string, now = Date.now()): ConsumeNonceResult {
  cleanupExpired(now);
  const record = nonceTable.get(nonce);

  if (!record) {
    return 'missing';
  }

  if (record.expiresAt <= now) {
    nonceTable.delete(nonce);
    return 'expired';
  }

  if (record.used) {
    return 'replay';
  }

  record.used = true;
  return 'accepted';
}

export function resetNonceTable(): void {
  nonceTable.clear();
}

export function getNonceTtlMs(): number {
  return NONCE_TTL_MS;
}
