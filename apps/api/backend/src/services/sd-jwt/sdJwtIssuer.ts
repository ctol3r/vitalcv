/**
 * Wave 199 — SD-JWT Issuer Service
 *
 * Issues vc+sd-jwt credentials with per-claim salted disclosures, holder DID
 * binding, persisted receipts, and audit-linked issuance records.
 */

import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, importJWK, jwtVerify } from 'jose';
import prisma from '../../graphql/prisma_client';
import { getFeatureFlag } from '../../config/envValidation';
import { log } from '../../obs/logger';
import { getBindingByDid } from '../identity/npiDidBinding';
import { recordIssuanceReceipt } from './issuanceReceipts';
import { getIssuedCredentialRecord, persistIssuedCredentialRecord } from './credentialStore';
import { getKeyByKid, getOrCreateKey } from './keyManager';
import { checkCapability } from '../trust-anchors/trustRegistryGovernance';
import { sha256ForPayload, sha256Hex } from '../../utils/deterministic';

export interface SdJwtClaim {
  key: string;
  value: unknown;
  disclosed: boolean;
}

export interface IssuedSdJwt {
  compact: string;
  disclosures: string[];
  kid: string;
  issuedAt: string;
  expiresAt: string;
  credentialId: string;
  receiptId: string;
  auditEventId: string;
}

const ISSUER_DID = process.env.ISSUER_DID ?? 'did:web:vitalcv.com';
const DEFAULT_CREDENTIAL_TYPE = 'HEALTHCARE_LICENSE';
const SD_JWT_FORMAT = 'vc+sd-jwt';

function base64url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64url');
}

function sha256b64url(input: string): string {
  return base64url(createHash('sha256').update(input).digest());
}

function generateDisclosure(salt: string, key: string, value: unknown): string {
  return base64url(JSON.stringify([salt, key, value]));
}

function buildClaimDigests(claims: readonly SdJwtClaim[]): Record<string, string> {
  return claims.reduce<Record<string, string>>((accumulator, claim) => {
    accumulator[claim.key] = sha256ForPayload({
      claim: claim.key,
      disclosed: claim.disclosed,
      value: claim.value,
    });
    return accumulator;
  }, {});
}

async function assertHolderDidEligible(holderDid: string): Promise<void> {
  const binding = await getBindingByDid(holderDid);
  if (!binding) {
    return;
  }

  if (binding.status === 'ACTIVE') {
    return;
  }

  if (binding.status === 'CONTESTED') {
    throw new Error(`Holder DID '${holderDid}' is contested and cannot receive new credentials`);
  }

  throw new Error(`Holder DID '${holderDid}' is not active and cannot receive new credentials`);
}

function assertIssuerCapability(issuerDid: string, credentialType: string): void {
  if (!getFeatureFlag('FEATURE_SD_JWT_ISSUER')) {
    throw new Error('SD-JWT issuance is disabled');
  }

  const capability = checkCapability(issuerDid, credentialType);
  if (capability.granted) {
    return;
  }

  if (capability.revokedAt) {
    throw new Error(
      `Issuer '${issuerDid}' capability for '${credentialType}' was revoked at ${capability.revokedAt}`,
    );
  }

  throw new Error(`Issuer '${issuerDid}' is missing capability '${credentialType}'`);
}

async function createIssuanceAuditEvent(input: {
  credentialId: string;
  issuerDid: string;
  holderDid: string;
  credentialType: string;
  kid: string;
  claimDigests: Record<string, string>;
  disclosureDigests: string[];
  issuedAt: string;
  expiresAt: string;
}): Promise<string> {
  const metadata = {
    issuerDid: input.issuerDid,
    holderDid: input.holderDid,
    holderBindingHash: sha256Hex(input.holderDid),
    credentialType: input.credentialType,
    kid: input.kid,
    claimDigests: input.claimDigests,
    disclosureDigests: input.disclosureDigests,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    format: SD_JWT_FORMAT,
  };

  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: 'SD_JWT_ISSUED',
      hash: sha256ForPayload({
        credentialId: input.credentialId,
        ...metadata,
      }),
      referenceId: input.credentialId,
      metadata,
    },
  });

  return auditEvent.id;
}

export async function issueSdJwt(
  holderDid: string,
  claims: SdJwtClaim[],
  opts?: {
    expiresInSeconds?: number;
    type?: string;
    issuerDid?: string;
    kid?: string;
  },
): Promise<IssuedSdJwt> {
  const issuerDid = opts?.issuerDid ?? ISSUER_DID;
  const credentialType = opts?.type ?? DEFAULT_CREDENTIAL_TYPE;

  assertIssuerCapability(issuerDid, credentialType);
  await assertHolderDidEligible(holderDid);

  const { privateKey, kid } = await getOrCreateKey('ES256', {
    issuerDid,
    ...(opts?.kid ? { kid: opts.kid } : {}),
  });

  const now = Math.floor(Date.now() / 1_000);
  const expiresIn = opts?.expiresInSeconds ?? 365 * 24 * 3600;
  const exp = now + expiresIn;

  const disclosures: string[] = [];
  const disclosureDigests: string[] = [];
  const visibleClaims: Record<string, unknown> = {};

  for (const claim of claims) {
    if (claim.disclosed) {
      visibleClaims[claim.key] = claim.value;
      continue;
    }

    const salt = base64url(randomBytes(32));
    const disclosure = generateDisclosure(salt, claim.key, claim.value);
    disclosures.push(disclosure);
    disclosureDigests.push(sha256b64url(disclosure));
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

  if (disclosureDigests.length > 0) {
    payload._sd = disclosureDigests;
    payload._sd_alg = 'sha-256';
  }

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid, typ: SD_JWT_FORMAT })
    .sign(privateKey);

  const compact = disclosures.length > 0
    ? `${jwt}~${disclosures.join('~')}~`
    : jwt;

  const issuedAt = new Date(now * 1_000).toISOString();
  const expiresAt = new Date(exp * 1_000).toISOString();
  const claimDigests = buildClaimDigests(claims);

  const receipt = await recordIssuanceReceipt({
    credentialId,
    issuerDid,
    holderDid,
    credentialType,
    compact,
    issuedAt,
    expiresAt,
  });

  const auditEventId = await createIssuanceAuditEvent({
    credentialId,
    issuerDid,
    holderDid,
    credentialType,
    kid,
    claimDigests,
    disclosureDigests,
    issuedAt,
    expiresAt,
  });

  await persistIssuedCredentialRecord({
    credentialId,
    issuerDid,
    holderDid,
    credentialType,
    format: SD_JWT_FORMAT,
    kid,
    claimDigests,
    disclosureDigests,
    holderBindingHash: sha256ForPayload({ issuerDid, holderDid }),
    receiptId: receipt.receiptId,
    auditEventId,
    issuedAt,
    expiresAt,
  });

  log('info', 'sd_jwt_issued', {
    credentialId,
    holderDid,
    issuerDid,
    credentialType,
    kid,
    disclosureCount: disclosures.length,
    receiptId: receipt.receiptId,
    auditEventId,
  });

  return {
    compact,
    disclosures,
    kid,
    issuedAt,
    expiresAt,
    credentialId,
    receiptId: receipt.receiptId,
    auditEventId,
  };
}

export async function verifySdJwt(
  compact: string,
  disclosures: string[],
): Promise<{ valid: boolean; claims: Record<string, unknown>; errors: string[] }> {
  const errors: string[] = [];
  const claims: Record<string, unknown> = {};

  try {
    const parts = compact.split('~').filter(Boolean);
    const jwt = parts[0];
    const embeddedDisclosures = parts.slice(1);
    const allDisclosures = [...new Set([...embeddedDisclosures, ...disclosures])];

    const header = JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString()) as {
      kid?: string;
      alg?: string;
    };
    const keyEntry = header.kid ? await getKeyByKid(header.kid) : null;

    if (!keyEntry) {
      errors.push(`No key found for kid: ${header.kid ?? 'unknown'}`);
      return { valid: false, claims, errors };
    }

    const publicKey = await importJWK(
      keyEntry.publicKeyJwk as unknown as Parameters<typeof importJWK>[0],
      'ES256',
    );
    const { payload } = await jwtVerify(jwt, publicKey);

    for (const [key, value] of Object.entries(payload)) {
      if (!['iss', 'sub', 'iat', 'exp', 'jti', '_sd', '_sd_alg', 'type'].includes(key)) {
        claims[key] = value;
      }
    }

    if (payload.sub) {
      claims.sub = payload.sub;
    }

    if (payload.type) {
      claims.type = payload.type;
    }

    const sdHashes = (payload._sd as string[]) ?? [];
    for (const disclosure of allDisclosures) {
      const digest = sha256b64url(disclosure);
      if (!sdHashes.includes(digest)) {
        continue;
      }

      try {
        const decoded = JSON.parse(Buffer.from(disclosure, 'base64url').toString()) as [
          string,
          string,
          unknown,
        ];
        claims[decoded[1]] = decoded[2];
      } catch {
        errors.push(`Failed to decode disclosure: ${disclosure.slice(0, 20)}…`);
      }
    }

    return { valid: errors.length === 0, claims, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'JWT verification failed');
    return { valid: false, claims, errors };
  }
}

export { getIssuedCredentialRecord };
