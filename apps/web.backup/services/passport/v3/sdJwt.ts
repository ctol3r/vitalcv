import { createNestedDisclosures, canonicalizeJSON } from 'backend/src/lib/sdjwt';
import { sign } from '@packages/domain-identity';
import { computeBundleHash } from '../models/PassportBundle';
import type { DeviceBindingContext } from './types';

const PASSPORT_SIGNING_KEY =
  process.env.PASSPORT_SIGNING_KEY || process.env.ISSUER_SECRET_KEY || '';

if (!PASSPORT_SIGNING_KEY) {
  // Fail fast during module load to make misconfiguration obvious in dev/test.
  console.warn(
    '[passport][sdJwt] PASSPORT_SIGNING_KEY (or ISSUER_SECRET_KEY) is not configured. SD-JWT issuance will throw.',
  );
}

export interface IssueSdJwtOptions {
  issuerDid: string;
  holderDid: string;
  passportId: string;
  credentialId: string;
  domain: string;
  selectiveClaims?: string[];
  deviceBinding?: DeviceBindingContext;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IssuedSdJwt {
  token: string;
  disclosures: string[];
  payload: Record<string, unknown>;
  hash: string;
}

export async function issueSdJwt(
  claims: Record<string, unknown>,
  options: IssueSdJwtOptions,
): Promise<IssuedSdJwt> {
  if (!PASSPORT_SIGNING_KEY) {
    throw new Error('PASSPORT_SIGNING_KEY (or ISSUER_SECRET_KEY) is not configured');
  }

  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const [payloadWithoutHash, disclosures] = createNestedDisclosures(claims, {
    selectiveClaims: options.selectiveClaims,
  });

  const basePayload: Record<string, unknown> = {
    ...payloadWithoutHash,
    iss: options.issuerDid,
    sub: options.holderDid,
    nbf: issuedAtSeconds,
    iat: issuedAtSeconds,
    jti: options.credentialId,
    passport_id: options.passportId,
    credential_domain: options.domain,
    cnf: options.deviceBinding?.dpopJkt ? { jkt: options.deviceBinding.dpopJkt } : undefined,
    exp: options.expiresAt ? Math.floor(new Date(options.expiresAt).getTime() / 1000) : undefined,
    metadata: normalizeMetadata(options.metadata),
  };

  const disclosureList = disclosures.map((entry) => entry.disclosure).sort();
  const canonicalForHash = canonicalizeJSON({
    payload: basePayload,
    disclosures: disclosureList,
  });
  const credentialHash = computeBundleHash(Buffer.from(canonicalForHash, 'utf-8'));

  const payload = {
    ...basePayload,
    credential_hash: credentialHash,
  };

  const header = {
    alg: 'EdDSA',
    typ: 'vc+sd-jwt',
    kid: `${options.issuerDid}#passport-v3`,
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signed = await sign(signingInput, PASSPORT_SIGNING_KEY);
  const signatureB64 = base64urlEncode(Buffer.from(signed.signature, 'hex').toString('binary'));

  return {
    token: `${headerB64}.${payloadB64}.${signatureB64}`,
    disclosures: disclosureList,
    payload,
    hash: credentialHash,
  };
}

export function computeCredentialHashFromPayload(
  payload: Record<string, unknown>,
  disclosures: string[],
): string {
  const { credential_hash: _ignored, ...rest } = payload;
  const canonical = canonicalizeJSON({
    payload: rest,
    disclosures: [...disclosures].sort(),
  });
  return computeBundleHash(Buffer.from(canonical, 'utf-8'));
}

function base64urlEncode(value: string): string {
  return Buffer.from(value, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) {
    return undefined;
  }
  return Object.entries(metadata).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value as unknown;
    }
    return acc;
  }, {});
}

