/**
 * credentialIssuer.ts — Wave 94: Credential Issuance
 *
 * Signs credential payloads using ES256 (ECDSA P-256) via `jose`.
 * Produces self-contained VerifiableCredential objects.
 */

import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { log } from '../../obs/logger';
import type {
  IssueCredentialRequest,
  VerifiableCredential,
  UnsignedCredential,
} from './credentialModel';

// ── Helpers ───────────────────────────────────────────────────────────

function buildUnsigned(req: IssueCredentialRequest): UnsignedCredential {
  return {
    credentialId: randomUUID(),
    issuer: req.issuer,
    subject: req.subject,
    claims: req.claims,
    issuedAt: new Date().toISOString(),
    expiresAt: req.expiresAt,
    schemaVersion: '1.0',
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Issue a signed verifiable credential.
 *
 * @param req   - Credential request (issuer, subject, claims)
 * @param pem   - PKCS#8 PEM private key for ES256 signing
 * @returns Signed VerifiableCredential
 */
export async function issueCredential(
  req: IssueCredentialRequest,
  pem: string,
): Promise<VerifiableCredential> {
  const unsigned = buildUnsigned(req);

  const privateKey = await importPKCS8(pem, 'ES256');

  const jws = await new SignJWT({
    credentialId: unsigned.credentialId,
    issuer: unsigned.issuer,
    subject: unsigned.subject,
    claims: unsigned.claims,
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'vc+jwt' })
    .setIssuedAt()
    .setIssuer(unsigned.issuer)
    .setSubject(unsigned.subject)
    .setExpirationTime(unsigned.expiresAt ?? '2y')
    .sign(privateKey);

  const credential: VerifiableCredential = {
    ...unsigned,
    signature: jws,
    status: 'ACTIVE',
  };

  log('info', 'credential_issued', {
    credentialId: credential.credentialId,
    issuer: credential.issuer,
    subject: credential.subject,
  });

  return credential;
}
