/**
 * Wave 203 — c_nonce Manager
 * Issues, validates, and expires c_nonces for OID4VCI credential requests.
 */
import { randomBytes } from 'node:crypto';

interface NonceEntry { issuedAt: number; usedAt?: number; expiresAt: number }
const nonces = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 5 * 60 * 1_000;

export function issueNonce(): string {
  const nonce = randomBytes(24).toString('base64url');
  nonces.set(nonce, { issuedAt: Date.now(), expiresAt: Date.now() + NONCE_TTL_MS });
  return nonce;
}

export function validateNonce(nonce: string): { valid: boolean; reason?: string } {
  const entry = nonces.get(nonce);
  if (!entry) return { valid: false, reason: 'unknown_nonce' };
  if (entry.usedAt) return { valid: false, reason: 'nonce_already_used' };
  if (Date.now() > entry.expiresAt) return { valid: false, reason: 'nonce_expired' };
  entry.usedAt = Date.now();
  return { valid: true };
}

export function purgeExpiredNonces(): void {
  const now = Date.now();
  for (const [k, v] of nonces) { if (now > v.expiresAt + 60_000) nonces.delete(k); }
}
