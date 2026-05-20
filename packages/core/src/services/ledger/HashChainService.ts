/**
 * Durable cryptographic event chain — WAVE C75.
 *
 * Each AuditEvent in a lineage is bound to its predecessor by a
 * `chainHash = SHA-256(previousHash || canonicalJSON(payload))`. The
 * chain is hash-linked end-to-end; a single mutation anywhere in the
 * lineage breaks every subsequent hash.
 *
 * Genesis: the first event in a lineage uses `GENESIS_VITALCV` as its
 * `previousHash`. The literal is binding so verifiers can replay the
 * chain offline without consulting VitalCV infrastructure.
 *
 * This module is intentionally pure — no I/O, no Prisma, no time. The
 * persistence wrapper that calls it lives in
 * `apps/api/backend/src/services/audit/createAuditEventWithChain.ts`.
 */

import { createHash } from 'node:crypto';

/**
 * Binding sentinel for the first event in a new lineage. Renders as
 * the `previousHash` argument when no predecessor exists. Encoded
 * verbatim into the chain so an offline verifier can detect genesis
 * deterministically.
 */
export const CHAIN_GENESIS_MARKER = 'GENESIS_VITALCV';

/**
 * Hash algorithm identifier surfaced alongside chain hashes so a
 * downstream verifier knows which primitive to recompute with.
 */
export const CHAIN_HASH_ALGORITHM = 'sha256';

/**
 * Canonical JSON serialization for the chained payload.
 *
 * Object keys are sorted lexicographically and rendered without
 * surrounding whitespace so that two semantically-equal payloads
 * always produce the same byte string — the prerequisite for a
 * reproducible hash chain across processes and language runtimes.
 */
export function canonicalizePayload(payload: unknown): string {
  return JSON.stringify(sortKeysRecursive(payload));
}

function sortKeysRecursive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysRecursive);
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = sortKeysRecursive(v);
  return out;
}

/**
 * Compute the next chain hash.
 *
 *   chainHash = SHA-256( previousHash || '|' || canonicalJSON(payload) )
 *
 * The separator (`|`) is binding — it guarantees that no payload value
 * can collide with the boundary between previousHash and payload.
 */
export function calculateNextHash(
  previousHash: string,
  currentEventPayload: unknown,
): string {
  const prev =
    previousHash && previousHash.length > 0
      ? previousHash
      : CHAIN_GENESIS_MARKER;
  const canonical = canonicalizePayload(currentEventPayload);
  return createHash(CHAIN_HASH_ALGORITHM)
    .update(prev)
    .update('|')
    .update(canonical)
    .digest('hex');
}

/**
 * Re-verify a hash chain segment offline.
 *
 * Accepts an ordered list of (payload, expectedHash) tuples plus the
 * head hash that anchors the segment (or `CHAIN_GENESIS_MARKER` if the
 * segment begins at genesis). Returns the index of the first divergence
 * or `-1` if the chain reconciles end-to-end.
 *
 * Useful for tests, replay tooling, and the verifier-side audit
 * inspection surface.
 */
export interface ChainSegmentEntry {
  payload: unknown;
  expectedHash: string;
}

export function verifyChainSegment(
  anchorPreviousHash: string,
  entries: readonly ChainSegmentEntry[],
): number {
  let prev = anchorPreviousHash;
  for (let i = 0; i < entries.length; i++) {
    const computed = calculateNextHash(prev, entries[i].payload);
    if (computed !== entries[i].expectedHash) return i;
    prev = computed;
  }
  return -1;
}
