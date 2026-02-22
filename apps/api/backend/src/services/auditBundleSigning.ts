import { importPKCS8, importSPKI, SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { log } from '../obs/logger';
import { getConfiguredIssuerDid } from '../utils/issuerDid';

type SigningKey = Awaited<ReturnType<typeof importPKCS8>>;

type PublicSigningKey = Awaited<ReturnType<typeof importSPKI>>;

const ALG = 'ES256' as const;
const KID = 'audit-bundle-key-2026-01';
const ISSUER = 'vitalcv';

export interface AuditBundleSignaturePayload extends JWTPayload {
  bundle_hash: string;
  bundle_id: string;
  artifact_id: string;
  hash_algorithm: 'SHA-256';
}

export interface AuditBundleSignInput {
  bundleHash: string;
  bundleId: string;
  artifactId: string;
  issuedAt?: string;
}

let privateKeyCache: SigningKey | null = null;
let publicKeyCache: PublicSigningKey | null = null;

function getPrivateKeyPem(): string {
  const signingKeyB64 = process.env.AUDIT_BUNDLE_SIGNING_KEY?.trim();
  const fallbackKeyB64 = process.env.PSV_SIGNING_KEY?.trim() || process.env.VCV_PRIVATE_KEY?.trim();
  const selected = signingKeyB64 ?? fallbackKeyB64;

  if (!selected) {
    throw new Error('Audit bundle signing key not configured');
  }

  return Buffer.from(selected, 'base64').toString('utf-8');
}

function getPublicKeyPem(): string {
  const publicKeyB64 = process.env.AUDIT_BUNDLE_PUBLIC_KEY?.trim();
  const fallbackKeyB64 = process.env.PSV_PUBLIC_KEY?.trim() || process.env.VCV_PUBLIC_KEY?.trim();
  const selected = publicKeyB64 ?? fallbackKeyB64;

  if (!selected) {
    throw new Error('Audit bundle public key not configured');
  }

  return Buffer.from(selected, 'base64').toString('utf-8');
}

async function resolvePrivateKey(): Promise<SigningKey> {
  if (privateKeyCache) {
    return privateKeyCache;
  }

  try {
    privateKeyCache = await importPKCS8(getPrivateKeyPem(), ALG);
    return privateKeyCache;
  } catch (error) {
    log('error', 'audit_bundle_signing_key_import_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw new Error('Failed to import audit bundle signing key');
  }
}

async function resolvePublicKey(): Promise<PublicSigningKey> {
  if (publicKeyCache) {
    return publicKeyCache;
  }

  try {
    publicKeyCache = await importSPKI(getPublicKeyPem(), ALG);
    return publicKeyCache;
  } catch (error) {
    log('error', 'audit_bundle_public_key_import_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw new Error('Failed to import audit bundle public key');
  }
}

function toIssuedAt(issuedAt?: string): Date {
  if (!issuedAt) {
    return new Date();
  }

  const parsed = new Date(issuedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('issuedAt must be an ISO timestamp');
  }

  return parsed;
}

export async function signAuditBundleHash(input: AuditBundleSignInput): Promise<string> {
  const privateKey = await resolvePrivateKey();

  return new SignJWT({
    bundle_hash: input.bundleHash,
    bundle_id: input.bundleId,
    artifact_id: input.artifactId,
    hash_algorithm: 'SHA-256',
  })
    .setProtectedHeader({ alg: ALG, kid: KID, typ: 'JWT' })
    .setIssuedAt(toIssuedAt(input.issuedAt))
    .setIssuer(ISSUER)
    .sign(privateKey);
}

export async function verifyAuditBundleSignature(jwt: string): Promise<AuditBundleSignaturePayload> {
  const publicKey = await resolvePublicKey();
  const { payload } = await jwtVerify(jwt, publicKey, {
    algorithms: [ALG],
    issuer: ISSUER,
  });

  return {
    ...payload,
    bundle_hash: String(payload.bundle_hash),
    bundle_id: String(payload.bundle_id),
    artifact_id: String(payload.artifact_id),
    hash_algorithm: 'SHA-256',
  };
}

export function resetAuditBundleSigningCache(): void {
  privateKeyCache = null;
  publicKeyCache = null;
}

export function getAuditBundleSigningIssuer(): string {
  return getConfiguredIssuerDid() || ISSUER;
}
