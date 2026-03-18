/**
 * credentialIssuer.ts — Wave 94 + 100: Credential Issuance + DID Metadata
 *
 * Signs credential payloads using ES256 (ECDSA P-256) via `jose`.
 * Produces self-contained VerifiableCredential objects.
 * Wave 100: embeds issuer DID document reference in credential metadata.
 */

import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { log } from '../../obs/logger';
import { resolveDID } from '../identity/didRegistry';
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

function normalizeExpiration(expiresAt: string | undefined): number | string {
  if (!expiresAt) {
    return '2y';
  }

  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? expiresAt : Math.floor(parsed.getTime() / 1000);
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

  const nowEpoch = Math.floor(Date.now() / 1000);

  const jws = await new SignJWT({
    credentialId: unsigned.credentialId,
    issuer: unsigned.issuer,
    subject: unsigned.subject,
    claims: unsigned.claims,
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'vc+jwt' })
    .setIssuedAt(nowEpoch)
    .setIssuer(unsigned.issuer)
    .setSubject(unsigned.subject)
    .setExpirationTime(normalizeExpiration(unsigned.expiresAt))
    .sign(privateKey);

  // Wave 100: Embed DID metadata if issuer is registered in DID registry
  const issuerDIDDoc = resolveDID(req.issuer);

  const credential: VerifiableCredential = {
    ...unsigned,
    signature: jws,
    status: 'ACTIVE',
    // Attach DID controller reference when available
    ...(issuerDIDDoc && {
      claims: {
        ...unsigned.claims,
        _issuerDID: {
          did: issuerDIDDoc.did,
          controller: issuerDIDDoc.controller,
          subjectType: issuerDIDDoc.subjectType,
          label: issuerDIDDoc.label,
        },
      },
    }),
  };

  log('info', 'credential_issued', {
    credentialId: credential.credentialId,
    issuer: credential.issuer,
    subject: credential.subject,
    issuerDIDResolved: !!issuerDIDDoc,
  });

  return credential;
}
