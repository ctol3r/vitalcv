/**
 * webauthnChallengeStore.ts — Wave 122
 *
 * In-memory challenge store for WebAuthn authentication flows.
 * Challenges are single-use and expire after 5 minutes.
 *
 * Production upgrade: replace with Redis/Postgres-backed store for
 * multi-instance deployments. Use challengeStore.set/get/delete pattern
 * and the same TTL semantics.
 */

import { randomBytes } from 'node:crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
  /** Optional: lock challenge to a specific session/npi */
  sessionId?: string;
}

const store = new Map<string, ChallengeEntry>();

/** Prune expired challenges — called on every write */
function prune(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}

/** Generate and store a new random challenge. Returns the challengeId and base64url challenge. */
export function createChallenge(sessionId?: string): { challengeId: string; challenge: string } {
  prune();

  const challengeId = randomBytes(16).toString('hex');
  const challengeBytes = randomBytes(32);
  const challenge = challengeBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  store.set(challengeId, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    sessionId,
  });

  return { challengeId, challenge };
}

/** Retrieve and consume a challenge (single-use). Returns null if not found or expired. */
export function consumeChallenge(challengeId: string): string | null {
  const entry = store.get(challengeId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(challengeId);
    return null;
  }
  store.delete(challengeId); // single-use
  return entry.challenge;
}

/** Peek at a challenge without consuming it (for debugging/tests). */
export function peekChallenge(challengeId: string): string | null {
  const entry = store.get(challengeId);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.challenge;
}

export const challengeStore = { createChallenge, consumeChallenge, peekChallenge };
