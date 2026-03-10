/**
 * Wave 199 — SD-JWT Issuer Service
 *
 * Implements selective-disclosure JWT issuance per the SD-JWT spec.
 * Each undisclosed claim is replaced with a salted hash commitment.
 * Holder binds the credential via holderDid.
 */

import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, jwtVerify, importJWK } from "jose";;
import { log } from '../../obs/logger';
import { getOrCreateKey, getKeyByKid } from './keyManager';
import { recordIssuanceReceipt } from './issuanceReceipts';
import { getFeatureFlag } from '../../config/envValidation';

export interface SdJwtClaim {
  key: string;
  value: unknown;
  disclosed: boolean; // true = visible in JWT; false = selective disclosure
}

export interface IssuedSdJwt {
  compact: string;       // JWT~disclosure1~disclosure2 format
  disclosures: string[]; // base64url-encoded disclosure strings
  kid: string;
  issuedAt: string;
  expiresAt: string;
  credentialId: string;
}

const ISSUER_DID = process.env.ISSUER_DID ?? 'did:web:vitalcv.com';

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function sha256b64url(input: string): string {
  return base64url(createHash('sha256').update(input).digest());
}

function generateDisclosure(salt: string, key: string, value: unknown): string {
  return base64url(JSON.stringify([salt, key, value]));
}

function checkIssuerCapability(issuerDid: string, credentialType: string): boolean {
  // Check feature flag
  if (!getFeatureFlag('FEATURE_SD_JWT_ISSUER')) return false;

  // Check trust registry if available
  try {
    const { checkCapability } = require('../trust-anchors/trustRegistryGovernance');
    // Sync check — governance is in-memory
    const result = checkCapability(issuerDid, credentialType);
    if (typeof result === 'object' && 'granted' in result) {
      return (result as { granted: boolean }).granted;
    }
  } catch {
    // Registry not loaded yet — allow if issuer is the configured issuer
  }

  return issuerDid === ISSUER_DID || issuerDid.startsWith('did:vitalcv:');
}

export async function issueSdJwt(
  holderDid: string,
  claims: SdJwtClaim[],
  opts?: { expiresInSeconds?: number; type?: string; issuerDid?: string },
): Promise<IssuedSdJwt> {
  const issuerDid = opts?.issuerDid ?? ISSUER_DID;
  const credentialType = opts?.type ?? 'VerifiableCredential';

  if (!checkIssuerCapability(issuerDid, credentialType)) {
    throw new Error(`Issuer '${issuerDid}' is not authorized to issue '${credentialType}' credentials`);
  }

  const { privateKey, kid } = await getOrCreateKey();
  const now = Math.floor(Date.now() / 1_000);
  const expiresIn = opts?.expiresInSeconds ?? 365 * 24 * 3600;
  const exp = now + expiresIn;

  const disclosures: string[] = [];
  const sdHashes: string[] = [];
  const visibleClaims: Record<string, unknown> = {};

  for (const claim of claims) {
    if (claim.disclosed) {
      visibleClaims[claim.key] = claim.value;
    } else {
      const salt = base64url(randomBytes(32));
      const disclosure = generateDisclosure(salt, claim.key, claim.value);
      disclosures.push(disclosure);
      sdHashes.push(sha256b64url(disclosure));
    }
  }

  const credentialId = `vc:vitalcv:${randomBytes(16).toString('hex')}`;

  const payload: Record<string, unknown> = {
    iss: issuerDid,
    sub: holderDid,
    iat: now,
    exp,
    jti: credentialId,
    type: credentialType,
    ...visibleClaims,
  };

  if (sdHashes.length > 0) {
    payload['_sd'] = sdHashes;
    payload['_sd_alg'] = 'sha-256';
  }

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'vc+sd-jwt' })
    .sign(privateKey);

  const compact = disclosures.length > 0
    ? `${jwt}~${disclosures.join('~')}~`
    : jwt;

  const issuedAt = new Date(now * 1_000).toISOString();
  const expiresAt = new Date(exp * 1_000).toISOString();

  recordIssuanceReceipt({
    credentialId,
    holderDid,
    type: credentialType,
    issuedAt,
    claims: claims.map((c) => c.key),
    kid,
  });

  log('info', 'sd_jwt_issued', { credentialId, holderDid, type: credentialType, kid, disclosureCount: disclosures.length });

  return { compact, disclosures, kid, issuedAt, expiresAt, credentialId };
}

export async function verifySdJwt(
  compact: string,
  disclosures: string[],
): Promise<{ valid: boolean; claims: Record<string, unknown>; errors: string[] }> {
  const errors: string[] = [];
  const claims: Record<string, unknown> = {};

  try {
    // Split compact token (JWT~disc1~disc2~ format)
    const parts = compact.split('~').filter(Boolean);
    const jwt = parts[0];
    const embeddedDisclosures = parts.slice(1);
    const allDisclosures = [...new Set([...embeddedDisclosures, ...disclosures])];

    // Find the right public key
    const headerStr = jwt.split('.')[0];
    const header = JSON.parse(Buffer.from(headerStr, 'base64url').toString()) as { kid?: string; alg?: string };
    const kidEntry = header.kid ? getKeyByKid(header.kid) : null;

    if (!kidEntry) {
      errors.push(`No key found for kid: ${header.kid ?? 'unknown'}`);
      return { valid: false, claims, errors };
    }

    const publicKey = await importJWK(kidEntry.publicKeyJwk as Parameters<typeof importJWK>[0], 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey);

    // Visible claims
    for (const [k, v] of Object.entries(payload)) {
      if (!['iss', 'sub', 'iat', 'exp', 'jti', '_sd', '_sd_alg', 'type'].includes(k)) {
        claims[k] = v;
      }
    }
    if (payload.sub) claims['sub'] = payload.sub;
    if (payload.type) claims['type'] = payload.type;

    // Selective disclosures
    const sdHashes = (payload['_sd'] as string[]) ?? [];
    for (const disc of allDisclosures) {
      const hash = sha256b64url(disc);
      if (sdHashes.includes(hash)) {
        try {
          const decoded = JSON.parse(Buffer.from(disc, 'base64url').toString()) as [string, string, unknown];
          claims[decoded[1]] = decoded[2];
        } catch {
          errors.push(`Failed to decode disclosure: ${disc.slice(0, 20)}…`);
        }
      }
    }

    return { valid: errors.length === 0, claims, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'JWT verification failed');
    return { valid: false, claims, errors };
  }
}
