/**
 * sdJwtCredential.ts — Wave 111: SD-JWT VC Selective Disclosure
 *
 * Implements SD-JWT Verifiable Credentials per the IETF SD-JWT VC spec.
 * Each disclosable claim is replaced with a `_sd` hash in the JWT body,
 * and the actual disclosure tuples are appended after the `~` separator.
 *
 * Format: <issuer-jwt>~<disclosure1>~<disclosure2>~...~[holder-binding-jwt]
 *
 * Spec: https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-04.html
 */

import { createHash, randomBytes } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { log } from '../../obs/logger';
import type { VerifiableCredential } from './credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

/**
 * A disclosure tuple: [salt, claim_name, claim_value]
 * Base64url-encoded JSON array.
 */
export type DisclosureTuple = [string, string, unknown];

export interface SdJwtCredential {
  /** The SD-JWT string: issuer_jwt~disclosure1~disclosure2~[holder_jwt] */
  sdJwt: string;
  /** The decoded issuer JWT payload (for inspection) */
  issuedPayload: Record<string, unknown>;
  /** All disclosures (encoded) */
  disclosures: string[];
  /** Disclosure map: claim_name → disclosure (encoded) */
  disclosureMap: Record<string, string>;
  credentialId: string;
  issuer: string;
  subject: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface SdJwtBuildRequest {
  credential: VerifiableCredential;
  /** Claims that should be selectively disclosable (others always revealed) */
  disclosableClaims: string[];
  pem: string;
}

export interface SdJwtPresentation {
  /** Subset SD-JWT: issuer_jwt~selected_disclosures~... */
  sdJwt: string;
  /** Claim names included in this presentation */
  disclosedClaims: string[];
  /** Claim names withheld in this presentation */
  withheldClaims: string[];
  presentationId: string;
  createdAt: string;
}

export interface SdJwtVerifyResult {
  valid: boolean;
  credentialId: string;
  disclosedClaims: Record<string, unknown>;
  withheldCount: number;
  errors: string[];
  verifiedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function base64urlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function encodeDisclosure(salt: string, claimName: string, claimValue: unknown): string {
  const tuple: DisclosureTuple = [salt, claimName, claimValue];
  return base64urlEncode(JSON.stringify(tuple));
}

function sdHash(disclosure: string): string {
  return createHash('sha256').update(disclosure).digest('base64url');
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Build an SD-JWT VC from a VerifiableCredential.
 * Selected claims become hashed `_sd` entries; all disclosures are appended.
 */
export async function buildSdJwtCredential(req: SdJwtBuildRequest): Promise<SdJwtCredential> {
  const { credential, disclosableClaims, pem } = req;
  const disclosableSet = new Set(disclosableClaims);

  const disclosures: string[] = [];
  const disclosureMap: Record<string, string> = {};
  const sdHashes: string[] = [];
  const alwaysRevealedClaims: Record<string, unknown> = {};

  // Build disclosures for selectively disclosable claims
  for (const [key, value] of Object.entries(credential.claims)) {
    if (key.startsWith('_')) continue; // skip internal
    if (disclosableSet.has(key)) {
      const salt = randomBytes(16).toString('base64url');
      const encoded = encodeDisclosure(salt, key, value);
      disclosures.push(encoded);
      disclosureMap[key] = encoded;
      sdHashes.push(sdHash(encoded));
    } else {
      alwaysRevealedClaims[key] = value;
    }
  }

  // Build the JWT payload with `_sd` hashes
  const payload: Record<string, unknown> = {
    vct: 'https://credentials.vitalcv.com/vc-type/v1',
    credentialId: credential.credentialId,
    iss: credential.issuer,
    sub: credential.subject,
    iat: Math.floor(new Date(credential.issuedAt).getTime() / 1000),
    status: credential.status,
    ...alwaysRevealedClaims,
    _sd: sdHashes,
    _sd_alg: 'sha-256',
  };

  if (credential.expiresAt) {
    payload['exp'] = Math.floor(new Date(credential.expiresAt).getTime() / 1000);
  }

  const privateKey = await importPKCS8(pem, 'ES256');
  const issuerJwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'vc+sd-jwt' })
    .sign(privateKey);

  const sdJwt = [issuerJwt, ...disclosures, ''].join('~');

  log('info', 'sd_jwt_vc_built', {
    credentialId: credential.credentialId,
    disclosableCount: disclosures.length,
    alwaysRevealedCount: Object.keys(alwaysRevealedClaims).length,
  });

  return {
    sdJwt,
    issuedPayload: payload,
    disclosures,
    disclosureMap,
    credentialId: credential.credentialId,
    issuer: credential.issuer,
    subject: credential.subject,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
  };
}

/**
 * Create a selective presentation from an SD-JWT VC.
 * Only includes disclosures for the requested claim names.
 */
export function discloseClaims(
  sdJwtCredential: SdJwtCredential,
  claimsToReveal: string[],
): SdJwtPresentation {
  const revealSet = new Set(claimsToReveal);
  const parts = sdJwtCredential.sdJwt.split('~');
  const issuerJwt = parts[0];

  const selectedDisclosures: string[] = [];
  const disclosedClaims: string[] = [];
  const withheldClaims: string[] = [];

  for (const [claimName, encoded] of Object.entries(sdJwtCredential.disclosureMap)) {
    if (revealSet.has(claimName)) {
      selectedDisclosures.push(encoded);
      disclosedClaims.push(claimName);
    } else {
      withheldClaims.push(claimName);
    }
  }

  const sdJwt = [issuerJwt, ...selectedDisclosures, ''].join('~');

  return {
    sdJwt,
    disclosedClaims,
    withheldClaims,
    presentationId: randomBytes(8).toString('hex'),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Verify disclosures in an SD-JWT presentation.
 * Decodes each disclosure and checks its hash appears in the `_sd` array.
 */
export async function verifyDisclosures(sdJwtString: string): Promise<SdJwtVerifyResult> {
  const errors: string[] = [];
  const disclosedClaims: Record<string, unknown> = {};
  let withheldCount = 0;
  let credentialId = 'unknown';

  try {
    const parts = sdJwtString.split('~').filter(Boolean);
    if (parts.length < 1) {
      return { valid: false, credentialId, disclosedClaims, withheldCount, errors: ['Empty SD-JWT'], verifiedAt: new Date().toISOString() };
    }

    const issuerJwt = parts[0];
    const disclosureParts = parts.slice(1);

    // Decode the JWT payload (without full verification for now — sig check is in credentialVerifier)
    const payloadB64 = issuerJwt.split('.')[1] ?? '';
    const payloadStr = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadStr) as Record<string, unknown>;

    credentialId = payload['credentialId'] as string ?? 'unknown';
    const sdHashes = (payload['_sd'] as string[]) ?? [];
    withheldCount = sdHashes.length - disclosureParts.length;

    // Verify each disclosure
    for (const encoded of disclosureParts) {
      const hash = sdHash(encoded);
      if (!sdHashes.includes(hash)) {
        errors.push(`Disclosure hash ${hash} not found in _sd array`);
        continue;
      }

      try {
        const decoded = JSON.parse(base64urlDecode(encoded)) as DisclosureTuple;
        const [, claimName, claimValue] = decoded;
        disclosedClaims[claimName] = claimValue;
      } catch {
        errors.push(`Failed to decode disclosure: ${encoded}`);
      }
    }

    const valid = errors.length === 0;
    return {
      valid,
      credentialId,
      disclosedClaims,
      withheldCount,
      errors,
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    return { valid: false, credentialId, disclosedClaims, withheldCount, errors, verifiedAt: new Date().toISOString() };
  }
}
