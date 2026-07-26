import { createHash, createHmac } from 'node:crypto';
import { canonicalizeJson } from './canonicalizeJson';

export { canonicalizeJson };

export function stableStringify(value: unknown): string {
  return canonicalizeJson(value as object);
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256ForPayload(payload: unknown): string {
  return sha256Hex(canonicalizeJson(payload as object));
}

/**
 * Keyed digest (HMAC-SHA-256, hex). Use when a hash is exposed publicly and its
 * preimage is low-entropy (dictionary-attackable) — e.g. salting anchored
 * Merkle claim-leaf hashes before they leave the trust boundary (ASVS gap G4).
 * The `secret` is a server-held key an attacker does not have, so they cannot
 * recompute the digest from candidate claim values.
 */
export function hmacSha256Hex(value: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function hashDeterministicPayload(payload: unknown): string {
  return sha256ForPayload(payload);
}

export function createHashChain(parts: Record<string, unknown>): string {
  return sha256ForPayload(parts);
}

/** Alias used by compliance modules (emergency governance, audit scrapbook). */
export function generateAuditHash(payload: string): string {
  return sha256Hex(payload);
}
