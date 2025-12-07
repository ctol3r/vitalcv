import { createHash } from 'crypto';
import { importJWK, SignJWT } from 'jose';
import type { ProofEnvelope } from '../types';
import { getActiveSigningKey } from '../../identity/signingKeyProvider';

type CanonicalValue = string | number | boolean | null | Record<string, unknown> | CanonicalValue[];

function canonicalize(value: CanonicalValue): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry as CanonicalValue)).join(',')}]`;
  }

  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val as CanonicalValue)}`);

  return `{${entries.join(',')}}`;
}

function digestPayload(payload: unknown): string {
  const serialized = canonicalize(payload as CanonicalValue);
  return createHash('sha256').update(serialized).digest('base64url');
}

export interface BuildProofOptions<TPayload> {
  type: string;
  payload: TPayload;
  expiresInSeconds?: number;
  proofType?: string;
  referenceId?: string;
}

export async function buildSignedProof<TPayload>(
  options: BuildProofOptions<TPayload>
): Promise<ProofEnvelope<TPayload>> {
  const digest = digestPayload(options.payload);
  const { kid, jwk } = await getActiveSigningKey();
  const alg = jwk.alg ?? (jwk.kty === 'OKP' ? 'EdDSA' : 'ES256');
  const signer = await importJWK(jwk, alg);
  const issuedAt = new Date().toISOString();
  const ttlSeconds = options.expiresInSeconds ?? 2 * 60 * 60;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const jwt = await new SignJWT({
    hash: digest,
    type: options.type,
    reference: options.referenceId,
  })
    .setProtectedHeader({
      alg,
      kid,
      typ: options.proofType ?? 'NCI_PROOF',
    })
    .setIssuedAt()
    .setExpirationTime(Math.floor(new Date(expiresAt).getTime() / 1000))
    .sign(signer);

  return {
    type: options.type,
    issuedAt,
    expiresAt,
    payload: options.payload,
    digest: {
      algorithm: 'SHA-256',
      value: digest,
    },
    signature: {
      kid,
      alg,
      proof: jwt,
    },
  };
}

