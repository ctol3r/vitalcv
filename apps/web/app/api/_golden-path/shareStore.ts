/**
 * In-memory share token store for demo/development.
 * Production: Replace with database persistence.
 */

import type { ShareToken } from '@domain/qia';
import type { GoldenPathScenario } from '@/lib/golden-path';

interface ShareRecord {
  readonly token: ShareToken;
  readonly scenario: GoldenPathScenario;
  readonly createdAt: Date;
}

const store = new Map<string, ShareRecord>();

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function createShareRecord(input: {
  readonly token: ShareToken;
  readonly scenario: GoldenPathScenario;
}): void {
  store.set(input.token.token_id, {
    token: input.token,
    scenario: input.scenario,
    createdAt: new Date(),
  });

  // Cleanup expired tokens
  setTimeout(() => {
    store.delete(input.token.token_id);
  }, TTL_MS);
}

export function resolveShareRecord(tokenId: string, now: Date): ShareRecord | null {
  const record = store.get(tokenId);
  if (!record) {
    return null;
  }

  // Check expiration
  if (now >= record.token.expires_at) {
    store.delete(tokenId);
    return null;
  }

  return record;
}
