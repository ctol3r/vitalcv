/**
 * credentialVerifier.ts — Wave 94 + 95: Credential Verification
 *
 * Verifies: signature (ES256 JWS), issuer trust (via registry),
 * credential status, and expiration.
 */

import { importSPKI, jwtVerify } from 'jose';
import { log } from '../../obs/logger';
import type { VerifiableCredential, VerificationResult } from './credentialModel';
import { getIssuer } from '../registry/trustRegistry';

// ── Public API ────────────────────────────────────────────────────────

export async function verifyCredential(
  credential: VerifiableCredential,
): Promise<VerificationResult> {
  const errors: string[] = [];
  const checks = {
    signature: false,
    issuerTrusted: false,
    statusActive: false,
    notExpired: false,
  };

  // 1. Issuer trusted? (Wave 95 integration)
  const issuerRecord = getIssuer(credential.issuer);
  if (issuerRecord && issuerRecord.status === 'ACTIVE') {
    checks.issuerTrusted = true;
  } else if (!issuerRecord) {
    errors.push(`Issuer "${credential.issuer}" not found in trust registry`);
  } else {
    errors.push(`Issuer "${credential.issuer}" status is ${issuerRecord.status}`);
  }

  // 2. Signature verification
  if (issuerRecord?.publicKey) {
    try {
      const publicKey = await importSPKI(issuerRecord.publicKey, 'ES256');
      await jwtVerify(credential.signature, publicKey, {
        issuer: credential.issuer,
        subject: credential.subject,
      });
      checks.signature = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown signature error';
      errors.push(`Signature verification failed: ${msg}`);
    }
  } else {
    errors.push('Cannot verify signature — no public key available for issuer');
  }

  // 3. Status check
  if (credential.status === 'ACTIVE') {
    checks.statusActive = true;
  } else {
    errors.push(`Credential status is ${credential.status}`);
  }

  // 4. Expiration check
  if (!credential.expiresAt) {
    checks.notExpired = true; // No expiration set
  } else {
    const exp = new Date(credential.expiresAt);
    if (exp > new Date()) {
      checks.notExpired = true;
    } else {
      errors.push(`Credential expired at ${credential.expiresAt}`);
    }
  }

  const valid =
    checks.signature &&
    checks.issuerTrusted &&
    checks.statusActive &&
    checks.notExpired;

  log('info', 'credential_verified', {
    credentialId: credential.credentialId,
    valid,
    errors,
  });

  return {
    valid,
    credentialId: credential.credentialId,
    checks,
    errors,
    verifiedAt: new Date().toISOString(),
  };
}
