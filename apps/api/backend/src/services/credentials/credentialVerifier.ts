/**
 * credentialVerifier.ts — Wave 94 + 95 + 100 + 101: Credential Verification
 *
 * Verifies: signature (ES256 JWS), issuer trust (via registry),
 * credential status, expiration, DID registry (Wave 100),
 * and revocation registry (Wave 101).
 */

import { importSPKI, jwtVerify } from 'jose';
import { log } from '../../obs/logger';
import type { VerifiableCredential, VerificationResult } from './credentialModel';
import { getIssuer } from '../registry/trustRegistry';
import { resolveDID } from '../identity/didRegistry';
import { isRevoked } from '../revocation/revocationRegistry';

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

  // 1. Issuer trusted? (Wave 95: trust registry)
  const issuerRecord = getIssuer(credential.issuer);
  if (issuerRecord && issuerRecord.status === 'ACTIVE') {
    checks.issuerTrusted = true;
  } else if (!issuerRecord) {
    // Wave 100: fallback to DID registry if not in trust registry
    const issuerDID = resolveDID(credential.issuer);
    if (issuerDID && issuerDID.status === 'ACTIVE') {
      checks.issuerTrusted = true;
    } else {
      errors.push(`Issuer "${credential.issuer}" not found in trust registry or DID registry`);
    }
  } else {
    errors.push(`Issuer "${credential.issuer}" status is ${issuerRecord.status}`);
  }

  // 2. Wave 100: Verify issuer DID is active (belt-and-suspenders check)
  const issuerDIDDoc = resolveDID(credential.issuer);
  if (issuerDIDDoc && issuerDIDDoc.status !== 'ACTIVE') {
    errors.push(`Issuer DID ${credential.issuer} is ${issuerDIDDoc.status} in DID registry`);
    checks.issuerTrusted = false;
  }

  // 3. Signature verification (use trust registry public key if available, else DID doc)
  const signingPublicKey = issuerRecord?.publicKey || issuerDIDDoc?.publicKey || '';
  if (signingPublicKey) {
    try {
      const publicKey = await importSPKI(signingPublicKey, 'ES256');
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

  // 4. Status check (credential-level)
  if (credential.status === 'ACTIVE') {
    checks.statusActive = true;
  } else {
    errors.push(`Credential status is ${credential.status}`);
  }

  // 5. Wave 101: Revocation registry check
  const revocationEntry = isRevoked(credential.credentialId);
  if (revocationEntry) {
    checks.statusActive = false;
    errors.push(`Credential ${credential.credentialId} has been revoked: ${revocationEntry.reason}`);
  }

  // 6. Expiration check
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
