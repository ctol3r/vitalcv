/**
 * verifierSdk.ts — Wave 107: Verifier SDK
 *
 * Provides a typed SDK for hospitals, ATS systems, and third-party
 * verifiers to integrate with VitalCV credential verification.
 *
 * Functions:
 *   verifyCredential()    — Verify a VC object
 *   verifyPresentation()  — Verify a VP bundle
 *   checkRevocation()     — Check if a credential has been revoked
 */

import { log } from '../obs/logger';
import { verifyCredential as verifyVC } from '../services/credentials/credentialVerifier';
import { isRevoked } from '../services/revocation/revocationRegistry';
import type { VerifiableCredential } from '../services/credentials/credentialModel';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VerifyCredentialResult {
  valid: boolean;
  payload?: VerifiableCredential;
  error?: string;
}

export interface VerifyPresentationResult {
  valid: boolean;
  credentials?: VerifiableCredential[];
  holderDID?: string;
  error?: string;
}

export interface RevocationCheckResult {
  revoked: boolean;
  credentialId: string;
  reason?: string;
  revokedAt?: string;
}

// ── verifyCredential ───────────────────────────────────────────────────────────

/**
 * Verify a Verifiable Credential object.
 * Checks: issuer trust, signature, expiry, revocation status.
 */
export async function verifyCredential(credential: VerifiableCredential): Promise<VerifyCredentialResult> {
  try {
    const result = await verifyVC(credential);

    if (!result.valid) {
      return {
        valid: false,
        error: result.errors.join('; '),
      };
    }

    return {
      valid: true,
      payload: credential,
    };
  } catch (err) {
    log('error', 'VerifierSDK: verifyCredential failed', { detail: String(err) });
    return { valid: false, error: String(err) };
  }
}

// ── verifyPresentation ────────────────────────────────────────────────────────

/**
 * Verify a Verifiable Presentation containing one or more credentials.
 */
export async function verifyPresentation(
  presentationPayload: Record<string, unknown>,
): Promise<VerifyPresentationResult> {
  try {
    const credentials = presentationPayload['credentials'] as VerifiableCredential[] | undefined;
    const holderDID = presentationPayload['holder'] as string | undefined;

    if (!credentials || !Array.isArray(credentials)) {
      return { valid: false, error: 'No credentials array found in presentation payload' };
    }

    const results = await Promise.all(credentials.map((vc) => verifyCredential(vc)));
    const invalid = results.filter((r) => !r.valid);

    if (invalid.length > 0) {
      return {
        valid: false,
        error: `${invalid.length} credential(s) failed verification: ${invalid.map((r) => r.error).join('; ')}`,
      };
    }

    return {
      valid: true,
      credentials,
      holderDID,
    };
  } catch (err) {
    log('error', 'VerifierSDK: verifyPresentation failed', { detail: String(err) });
    return { valid: false, error: String(err) };
  }
}

// ── checkRevocation ───────────────────────────────────────────────────────────

/**
 * Check whether a specific credential has been revoked.
 */
export async function checkRevocation(credentialId: string): Promise<RevocationCheckResult> {
  try {
    const entry = isRevoked(credentialId);

    if (entry) {
      return {
        revoked: true,
        credentialId,
        reason: entry.reason,
        revokedAt: entry.revokedAt,
      };
    }

    return { revoked: false, credentialId };
  } catch (err) {
    log('error', 'VerifierSDK: checkRevocation failed', { credentialId, detail: String(err) });
    return { revoked: false, credentialId };
  }
}

// ── VerifierSDK object ────────────────────────────────────────────────────────

/**
 * Convenience object grouping all SDK methods.
 *
 * @example
 * import { VerifierSDK } from './sdk/verifierSdk';
 * const result = await VerifierSDK.verifyCredential(vc);
 */
export const VerifierSDK = {
  verifyCredential,
  verifyPresentation,
  checkRevocation,
} as const;

export default VerifierSDK;
