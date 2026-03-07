/**
 * revocationRegistry.ts — Wave 101: Credential Revocation Registry
 *
 * Maintains an authoritative list of revoked credentials.
 * Revocation is permanent — a revoked credential cannot be un-revoked.
 * In production this would be backed by a W3C Bitstring Status List
 * or an on-chain revocation registry.
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import { revocationCascade, type CascadeResult } from '../decision/revocationCascade';

// ── Types ─────────────────────────────────────────────────────────────

export interface RevocationEntry {
  /** Internal entry ID */
  entryId: string;
  /** Credential being revoked */
  credentialId: string;
  /** DID or registry ID of the issuer performing revocation */
  issuer: string;
  /** Human-readable revocation reason */
  reason: string;
  /** ISO-8601 revocation timestamp */
  revokedAt: string;
  /** Optional: additional metadata */
  metadata?: Record<string, unknown>;
}

export interface RevokeCredentialRequest {
  credentialId: string;
  issuer: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface RevokeCredentialCascadeResult {
  entry: RevocationEntry;
  cascadeTriggered: boolean;
  cascadeResult: CascadeResult | null;
}

// ── Storage ───────────────────────────────────────────────────────────

/** credentialId → RevocationEntry */
const revocations = new Map<string, RevocationEntry>();

// ── Public API ────────────────────────────────────────────────────────

function getOrCreateRevocationEntry(req: RevokeCredentialRequest): {
  entry: RevocationEntry;
  created: boolean;
} {
  const existing = revocations.get(req.credentialId);
  if (existing) {
    log('warn', 'revocation_already_exists', { credentialId: req.credentialId });
    return { entry: existing, created: false };
  }

  const entry: RevocationEntry = {
    entryId: randomUUID(),
    credentialId: req.credentialId,
    issuer: req.issuer,
    reason: req.reason,
    revokedAt: new Date().toISOString(),
    metadata: req.metadata,
  };

  revocations.set(req.credentialId, entry);

  log('warn', 'credential_revoked', {
    credentialId: req.credentialId,
    issuer: req.issuer,
    reason: req.reason,
  });

  return { entry, created: true };
}

/**
 * Revoke a credential. Idempotent — revoking an already-revoked
 * credential returns the existing entry.
 */
export function revokeCredential(req: RevokeCredentialRequest): RevocationEntry {
  return getOrCreateRevocationEntry(req).entry;
}

/**
 * Revoke a credential and eagerly invalidate any dependent decision capsules.
 * The revocation entry remains authoritative even if cascade propagation fails.
 */
export async function revokeCredentialWithCascade(
  req: RevokeCredentialRequest,
): Promise<RevokeCredentialCascadeResult> {
  const { entry } = getOrCreateRevocationEntry(req);

  try {
    const cascadeResult = await revocationCascade.propagateRevocation(req.credentialId);
    return {
      entry,
      cascadeTriggered: true,
      cascadeResult,
    };
  } catch (error) {
    log('warn', 'revocation_cascade_failed', {
      credentialId: req.credentialId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      entry,
      cascadeTriggered: false,
      cascadeResult: null,
    };
  }
}

/**
 * Check if a credential is revoked.
 * Returns the RevocationEntry if revoked, null otherwise.
 */
export function isRevoked(credentialId: string): RevocationEntry | null {
  return revocations.get(credentialId) ?? null;
}

/** Get revocation entry by credential ID. */
export function getRevocationEntry(credentialId: string): RevocationEntry | null {
  return revocations.get(credentialId) ?? null;
}

/** List all revoked credentials, optionally filtered by issuer. */
export function listRevocations(issuer?: string): RevocationEntry[] {
  const all = Array.from(revocations.values()).sort(
    (a, b) => new Date(b.revokedAt).getTime() - new Date(a.revokedAt).getTime(),
  );
  return issuer ? all.filter((r) => r.issuer === issuer) : all;
}

/** Total revocation count. */
export function revocationCount(): number {
  return revocations.size;
}
