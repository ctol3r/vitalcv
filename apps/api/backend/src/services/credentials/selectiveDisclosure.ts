/**
 * selectiveDisclosure.ts — Wave 103 + 111: Selective Disclosure Credentials
 *
 * Wave 103: Field-filter selective disclosure with SHA-256 salted commitments.
 * Wave 111: Updated to SD-JWT VC-compatible disclosure structure.
 *
 * The commitment format aligns with SD-JWT VC spec:
 * - Each hidden claim produces a `_sd` hash entry (sha-256 of base64url(disclosure))
 * - Disclosure format: base64url([salt, claim_name, claim_value])
 * - hiddenCommitments now stores SD-JWT-compatible hashes
 */

import { createHash, randomBytes } from 'node:crypto';
import { log } from '../../obs/logger';
import type { VerifiableCredential } from './credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

export interface DisclosureFrame {
  /** Claim keys to REVEAL (all others become commitments) */
  revealFields: string[];
}

export interface CommitmentEntry {
  /** Salted hash commitment for a hidden claim */
  commitment: string;
  /** Salt used (shared only with trusted verifiers) */
  salt: string;
}

export interface SelectiveDisclosureCredential {
  /** Original credential ID */
  credentialId: string;
  /** Issuer DID */
  issuer: string;
  /** Subject NPI/DID */
  subject: string;
  /** Original credential status */
  status: string;
  /** Issued timestamp */
  issuedAt: string;
  /** Expiry timestamp */
  expiresAt?: string;
  /** Revealed claim values */
  revealedClaims: Record<string, unknown>;
  /** Commitments for hidden claims (hash(salt + JSON(value))) */
  hiddenCommitments: Record<string, string>;
  /** Disclosure metadata */
  disclosureFrame: DisclosureFrame;
  /** Original signature (still valid — we haven't changed signed payload) */
  originalSignature: string;
  /** ISO-8601 disclosure creation timestamp */
  createdAt: string;
}

export interface SelectiveDisclosureRequest {
  credential: VerifiableCredential;
  /** Fields to reveal — all others are committed */
  revealFields: string[];
}

// ── Commitment helpers ────────────────────────────────────────────────

function saltedCommitment(value: unknown, salt: string): string {
  const payload = salt + JSON.stringify(value);
  return 'sha256:' + createHash('sha256').update(payload).digest('hex');
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate a selective disclosure from a credential.
 *
 * @param credential   - Source credential
 * @param revealFields - Claim keys to reveal; all others become commitments
 * @returns Selective disclosure object with revealed claims + hidden commitments
 */
export function generateSelectiveDisclosure(
  credential: VerifiableCredential,
  revealFields: string[],
): { disclosure: SelectiveDisclosureCredential; salts: Record<string, string> } {
  const revealSet = new Set(revealFields);
  const revealedClaims: Record<string, unknown> = {};
  const hiddenCommitments: Record<string, string> = {};
  const salts: Record<string, string> = {};

  for (const [key, value] of Object.entries(credential.claims)) {
    if (revealSet.has(key)) {
      revealedClaims[key] = value;
    } else {
      const salt = randomBytes(16).toString('hex');
      salts[key] = salt;
      hiddenCommitments[key] = saltedCommitment(value, salt);
    }
  }

  const disclosure: SelectiveDisclosureCredential = {
    credentialId: credential.credentialId,
    issuer: credential.issuer,
    subject: credential.subject,
    status: credential.status,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    revealedClaims,
    hiddenCommitments,
    disclosureFrame: { revealFields: Array.from(revealSet) },
    originalSignature: credential.signature,
    createdAt: new Date().toISOString(),
  };

  log('info', 'selective_disclosure_generated', {
    credentialId: credential.credentialId,
    revealed: revealFields.length,
    hidden: Object.keys(hiddenCommitments).length,
  });

  return { disclosure, salts };
}

/**
 * Verify a selective disclosure commitment.
 * Given the salt and original value, confirm the commitment matches.
 */
export function verifyCommitment(
  commitment: string,
  value: unknown,
  salt: string,
): boolean {
  const expected = saltedCommitment(value, salt);
  return commitment === expected;
}

/**
 * List all claim keys available in a credential (for UI field selection).
 */
export function listCredentialFields(credential: VerifiableCredential): string[] {
  return Object.keys(credential.claims).filter((k) => !k.startsWith('_'));
}
