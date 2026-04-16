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
import {
  initializeTrustRegistryPersistence,
  validateIssuerForVerification,
} from '../registry/trustRegistry';
import { resolveDID } from '../identity/didRegistry';
import { isRevoked } from '../revocation/revocationRegistry';
import { checkCredentialHAIP, checkIssuerHAIP, HAIP_HEALTHCARE_POLICY } from '../trust/haipProfile';

const REQUIRED_SIGNING_ALGORITHM = 'ES256';

function sanitizeIdentifier(value: unknown, maxLength = 160): string {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : 'unknown';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseProtectedHeader(signature: string): Record<string, unknown> | null {
  const [headerSegment] = signature.split('.');
  if (!headerSegment) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validateCredentialEnvelope(credential: VerifiableCredential): string[] {
  const errors: string[] = [];

  if (!sanitizeIdentifier(credential.credentialId) || sanitizeIdentifier(credential.credentialId) === 'unknown') {
    errors.push('Credential ID is missing');
  }

  if (!sanitizeIdentifier(credential.issuer) || sanitizeIdentifier(credential.issuer) === 'unknown') {
    errors.push('Issuer is missing');
  }

  if (!sanitizeIdentifier(credential.subject) || sanitizeIdentifier(credential.subject) === 'unknown') {
    errors.push('Subject is missing');
  }

  if (!isIsoDate(credential.issuedAt)) {
    errors.push(`Credential issuedAt is invalid: ${String(credential.issuedAt)}`);
  } else if (Date.parse(credential.issuedAt) > Date.now()) {
    errors.push(`Credential issuedAt cannot be in the future: ${credential.issuedAt}`);
  }

  if (credential.expiresAt && !isIsoDate(credential.expiresAt)) {
    errors.push(`Credential expiresAt is invalid: ${credential.expiresAt}`);
  }

  const segments = credential.signature.split('.');
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    errors.push('Credential signature must be a compact JWS');
  }

  return errors;
}

// ── Public API ────────────────────────────────────────────────────────

export async function verifyCredential(
  credential: VerifiableCredential,
): Promise<VerificationResult> {
  await initializeTrustRegistryPersistence();
  const errors: string[] = [];
  const checks = {
    signature: false,
    issuerTrusted: false,
    statusActive: false,
    notExpired: false,
  };
  const envelopeErrors = validateCredentialEnvelope(credential);
  errors.push(...envelopeErrors);

  const sanitizedIssuer = sanitizeIdentifier(credential.issuer);
  const sanitizedCredentialId = sanitizeIdentifier(credential.credentialId);
  const sanitizedSubject = sanitizeIdentifier(credential.subject);

  // 1. Issuer trusted? Trust MUST be mediated by the registry.
  const registryValidation = validateIssuerForVerification(
    credential.issuer,
    REQUIRED_SIGNING_ALGORITHM,
  );
  const issuerRecord = registryValidation.issuer;
  if (registryValidation.ok) {
    checks.issuerTrusted = true;
  } else {
    const reason = registryValidation.reason ?? 'unknown';
    log('warn', 'registry.validation.failed', {
      credentialId: sanitizedCredentialId,
      issuer: sanitizedIssuer,
      subject: sanitizedSubject,
      reason,
    });
    if (reason === 'issuer_not_registered') {
      errors.push(`Issuer "${credential.issuer}" not found in trust registry`);
    } else if (reason === 'issuer_inactive') {
      errors.push(`Issuer "${credential.issuer}" status is ${issuerRecord?.status ?? 'UNKNOWN'}`);
    } else if (reason === 'algorithm_not_allowed') {
      errors.push(`Issuer "${credential.issuer}" does not allow ${REQUIRED_SIGNING_ALGORITHM} signing`);
    } else {
      errors.push(`Issuer "${credential.issuer}" is not trusted`);
    }
  }

  // 2. Verify issuer DID is active when present (belt-and-suspenders only).
  const issuerDIDDoc = resolveDID(credential.issuer);
  if (issuerDIDDoc && issuerDIDDoc.status !== 'ACTIVE') {
    errors.push(`Issuer DID ${credential.issuer} is ${issuerDIDDoc.status} in DID registry`);
    checks.issuerTrusted = false;
  }

  // 3. Signature verification (registry is the trust gate; DID may provide key material)
  const signingPublicKey = issuerRecord?.publicKey || issuerDIDDoc?.publicKey || '';
  const header = parseProtectedHeader(credential.signature);
  if (header?.alg !== REQUIRED_SIGNING_ALGORITHM) {
    errors.push(`Unsupported JWT alg: ${String(header?.alg ?? 'missing')}`);
  }

  if (
    signingPublicKey
    && checks.issuerTrusted
    && header?.alg === REQUIRED_SIGNING_ALGORITHM
    && envelopeErrors.length === 0
  ) {
    try {
      const publicKey = await importSPKI(signingPublicKey, REQUIRED_SIGNING_ALGORITHM);
      await jwtVerify(credential.signature, publicKey, {
        algorithms: [REQUIRED_SIGNING_ALGORITHM],
        issuer: credential.issuer,
        subject: credential.subject,
      });
      checks.signature = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown signature error';
      errors.push(`Signature verification failed: ${msg}`);
    }
  } else if (!signingPublicKey) {
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

  // Wave 112: HAIP compliance check (non-blocking by default — warnings only in base verifier)
  const haipResult = checkCredentialHAIP(credential, HAIP_HEALTHCARE_POLICY);
  const haipIssuerResult = issuerRecord ? checkIssuerHAIP(issuerRecord, HAIP_HEALTHCARE_POLICY) : null;
  const haipCriticalViolations = haipResult.violations.filter((v) => v.severity === 'CRITICAL');
  if (haipCriticalViolations.length > 0) {
    errors.push(...haipCriticalViolations.map((v) => `[HAIP:${v.rule}] ${v.detail}`));
  }

  const valid =
    checks.signature &&
    checks.issuerTrusted &&
    checks.statusActive &&
    checks.notExpired;

  log('info', 'credential_verified', {
    credentialId: sanitizedCredentialId,
    issuer: sanitizedIssuer,
    valid,
    haipCompliant: haipResult.compliant,
    errors,
  });

  return {
    valid,
    credentialId: credential.credentialId,
    checks,
    errors,
    verifiedAt: new Date().toISOString(),
    // Wave 112: attach HAIP result
    haip: {
      compliant: haipResult.compliant,
      issuerCompliant: haipIssuerResult?.compliant ?? null,
      violations: haipResult.violations,
    },
  };
}
