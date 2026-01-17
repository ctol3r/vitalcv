import { createHash, randomBytes } from 'crypto';
import { calculateJwkThumbprint, exportJWK, generateKeyPair, JWK } from 'jose';

interface SigningKeyMaterial {
  kid: string;
  jwk: JWK;
}

export interface PublicJwkWithStatus extends JWK {
  kid?: string;
  x?: string;
  status?: 'active' | 'rotated';
  createdAt?: string;
  rotatedAt?: string;
}

export interface PublicJwksPayload {
  version: string;
  keys: PublicJwkWithStatus[];
}

let cachedKey: SigningKeyMaterial | null = null;

function buildKidFallback(): string {
  return `kid-${randomBytes(8).toString('hex')}`;
}

async function normalizeJwk(jwk: JWK): Promise<SigningKeyMaterial> {
  const alg = (jwk.alg as string) || 'EdDSA';
  const normalized: JWK = {
    ...jwk,
    alg,
    use: jwk.use || 'sig',
  };

  const kid = jwk.kid || (await calculateJwkThumbprint(normalized)) || buildKidFallback();
  normalized.kid = kid;

  return { kid, jwk: normalized };
}

function parseEnvJwk(): JWK | null {
  const raw = process.env.ISSUER_SIGNING_JWK;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as JWK;
  } catch (error) {
    throw new Error('ISSUER_SIGNING_JWK is not valid JSON');
  }
}

export async function getActiveSigningKey(): Promise<SigningKeyMaterial> {
  if (cachedKey) {
    return cachedKey;
  }

  const envKey = parseEnvJwk();
  if (envKey) {
    if (!('d' in envKey)) {
      throw new Error('ISSUER_SIGNING_JWK must include a private key parameter (d)');
    }
    cachedKey = await normalizeJwk(envKey);
    return cachedKey;
  }

  const { privateKey } = await generateKeyPair('EdDSA', { extractable: true });
  const jwk = await exportJWK(privateKey);
  const material = await normalizeJwk({
    ...jwk,
    alg: 'EdDSA',
  });
  cachedKey = material;
  return material;
}

export async function getPublicSigningJwk(): Promise<PublicJwkWithStatus> {
  const { jwk } = await getActiveSigningKey();
  const { d, ...publicJwk } = jwk as JWK & { d?: string };
  return {
    ...(publicJwk as JWK),
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

export async function getPublicJwksPayload(): Promise<PublicJwksPayload> {
  const publicJwk = await getPublicSigningJwk();
  const versionSource = publicJwk.kid || publicJwk.x || 'default';
  return {
    version: versionSource,
    keys: [publicJwk],
  };
}

export function getSigningKeyFingerprint(jwk: JWK): string {
  const serialized = JSON.stringify(jwk);
  return createHash('sha256').update(serialized).digest('hex');
}
