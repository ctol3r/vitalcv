import { JWK } from 'jose';
import { getSecret, vaultClient, VaultClientError } from '../security/vaultClient';

type SigningKeyStatus = 'active' | 'inactive';

type SigningKeyStatus = 'active' | 'inactive';

interface RawSigningKey {
  kid?: string;
  status?: SigningKeyStatus;
  publicJwk: JWK;
  privateJwk?: JWK;
  createdAt?: string;
  rotatedAt?: string;
}

interface SigningKeySecretPayload {
  activeKid: string;
  keys: RawSigningKey[] | Record<string, RawSigningKey>;
  version?: string | number;
  updatedAt?: string;
}

interface RawSigningKeyEntry {
  kid?: string;
  value: RawSigningKey;
}

export interface SigningKeyRecord {
  kid: string;
  status: SigningKeyStatus;
  publicJwk: JWK;
  privateJwk?: JWK;
  createdAt?: string;
  rotatedAt?: string;
}

export interface SigningKeySnapshot {
  activeKid: string;
  keys: SigningKeyRecord[];
  version: string;
  fetchedAt: number;
  source: 'vault' | 'env';
}

const SIGNING_KEY_SECRET_PATH = process.env.VAULT_SIGNING_KEY_PATH || 'crypto/signing/issuer';
const CACHE_TTL_MS = Number(process.env.SIGNING_KEY_CACHE_TTL_MS || 5 * 60 * 1000);

let cache: SigningKeySnapshot | null = null;
let inflight: Promise<SigningKeySnapshot> | null = null;

class SigningKeyProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SigningKeyProviderError';
  }
}

function cloneJwk(jwk: JWK): JWK {
  return JSON.parse(JSON.stringify(jwk));
}

function resolveAlgorithm(jwk: JWK, fallback?: string): string | undefined {
  if (jwk.alg) return jwk.alg;
  if (fallback) return fallback;
  if (jwk.kty === 'OKP') return 'EdDSA';
  if (jwk.kty === 'EC') return 'ES256';
  return undefined;
}

function normalizeRecord(raw: RawSigningKey, fallbackKid: string, defaultStatus: SigningKeyStatus): SigningKeyRecord {
  if (!raw.publicJwk) {
    throw new SigningKeyProviderError('Signing key payload missing publicJwk');
  }

  const kid = raw.kid || raw.publicJwk.kid || fallbackKid;
  const status: SigningKeyStatus = raw.status || defaultStatus;
  const alg = resolveAlgorithm(raw.publicJwk, raw.privateJwk?.alg);

  const publicJwk: JWK = {
    ...cloneJwk(raw.publicJwk),
    kid,
    use: raw.publicJwk.use || 'sig',
    alg,
  };

  const privateJwk = raw.privateJwk
    ? {
        ...cloneJwk(raw.privateJwk),
        kid: raw.privateJwk.kid || kid,
        use: raw.privateJwk.use || 'sig',
        alg: raw.privateJwk.alg || publicJwk.alg,
      }
    : undefined;

  return {
    kid,
    status,
    publicJwk,
    privateJwk,
    createdAt: raw.createdAt,
    rotatedAt: raw.rotatedAt,
  };
}

function normalizeSecretPayload(payload: SigningKeySecretPayload): SigningKeyRecord[] {
  const entries: RawSigningKeyEntry[] = [];
  if (Array.isArray(payload.keys)) {
    entries.push(...payload.keys.map(key => ({ kid: key.kid, value: key })));
  } else if (payload.keys) {
    entries.push(
      ...Object.entries(payload.keys).map(([kid, value]) => ({
        kid,
        value,
      }))
    );
  }

  return entries.map(({ kid, value }) => {
    const normalized = normalizeRecord(value, kid || payload.activeKid, value.status || 'inactive');
    if (normalized.kid === payload.activeKid) {
      normalized.status = 'active';
    }
    return normalized;
  });
}

function computeVersion(payload: SigningKeySecretPayload, keys: SigningKeyRecord[]): string {
  if (payload.version !== undefined) return String(payload.version);
  if (payload.updatedAt) return payload.updatedAt;
  const kidSum = keys.map(k => `${k.kid}:${k.status}`).join(',');
  return `${payload.activeKid}:${kidSum}`;
}

function ensureActiveKey(snapshot: SigningKeySnapshot): SigningKeyRecord {
  const active = snapshot.keys.find(key => key.kid === snapshot.activeKid);
  if (!active) {
    throw new SigningKeyProviderError(`Active signing key ${snapshot.activeKid} missing from Vault payload`);
  }
  if (!active.privateJwk) {
    throw new SigningKeyProviderError(`Active signing key ${snapshot.activeKid} is missing private component`);
  }
  return active;
}

async function loadFromVault(): Promise<SigningKeySnapshot | null> {
  if (!vaultClient.isEnabled()) {
    return null;
  }

  try {
    const payload = await getSecret<SigningKeySecretPayload>(SIGNING_KEY_SECRET_PATH);
    if (!payload?.activeKid) {
      throw new SigningKeyProviderError(
        `Vault secret ${SIGNING_KEY_SECRET_PATH} missing activeKid field`
      );
    }

    const keys = normalizeSecretPayload(payload);
    if (keys.length === 0) {
      throw new SigningKeyProviderError(
        `Vault secret ${SIGNING_KEY_SECRET_PATH} does not contain any signing keys`
      );
    }

    return {
      activeKid: payload.activeKid,
      keys,
      version: computeVersion(payload, keys),
      fetchedAt: Date.now(),
      source: 'vault',
    };
  } catch (error) {
    if (error instanceof VaultClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function loadFromEnv(): SigningKeySnapshot | null {
  const envKey = process.env.VC_SIGNING_KEY_JWK;
  if (!envKey) {
    return null;
  }

  try {
    const parsed = JSON.parse(envKey) as JWK;
  const kid = parsed.kid || `env-key-${Date.now()}`;
    const publicJwk = cloneJwk(parsed);
    delete (publicJwk as any).d;

    const record: SigningKeyRecord = {
      kid,
      status: 'active',
      publicJwk: {
        ...publicJwk,
        kid,
        use: publicJwk.use || 'sig',
        alg: resolveAlgorithm(publicJwk, parsed.alg) || 'EdDSA',
      },
      privateJwk: {
        ...cloneJwk(parsed),
        kid,
        use: parsed.use || 'sig',
        alg: resolveAlgorithm(parsed, publicJwk.alg) || 'EdDSA',
      },
      createdAt: new Date().toISOString(),
    };

    return {
      activeKid: kid,
      keys: [record],
      version: `env-${kid}`,
      fetchedAt: Date.now(),
      source: 'env',
    };
  } catch (error) {
    throw new SigningKeyProviderError(
      `Failed to parse VC_SIGNING_KEY_JWK. Ensure it is a valid JWK string. ${error instanceof Error ? error.message : ''}`
    );
  }
}

async function loadSnapshot(): Promise<SigningKeySnapshot> {
  const fromVault = await loadFromVault();
  if (fromVault) {
    ensureActiveKey(fromVault);
    return fromVault;
  }

  const fromEnv = loadFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  throw new SigningKeyProviderError(
    `No signing keys available. Populate Vault secret ${SIGNING_KEY_SECRET_PATH} or set VC_SIGNING_KEY_JWK for development.`
  );
}

export async function getSigningKeySnapshot(options?: { forceRefresh?: boolean }): Promise<SigningKeySnapshot> {
  const now = Date.now();
  if (!options?.forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  if (!inflight) {
    inflight = loadSnapshot().finally(() => {
      inflight = null;
    });
  }

  cache = await inflight;
  return cache;
}

export async function refreshSigningKeyCache(): Promise<SigningKeySnapshot> {
  cache = await loadSnapshot();
  return cache;
}

export async function getActiveSigningKey(): Promise<{ kid: string; jwk: JWK }> {
  const snapshot = await getSigningKeySnapshot();
  const active = ensureActiveKey(snapshot);
  return { kid: active.kid, jwk: active.privateJwk as JWK };
}

export interface PublicJwkWithStatus extends JWK {
  status: SigningKeyStatus;
  rotatedAt?: string;
  createdAt?: string;
}

export async function getPublicJwksPayload(): Promise<{ keys: PublicJwkWithStatus[]; version: string }> {
  const snapshot = await getSigningKeySnapshot();
  return {
    keys: snapshot.keys.map(key => ({
      ...cloneJwk(key.publicJwk),
      kid: key.publicJwk.kid || key.kid,
      status: key.status,
      rotatedAt: key.rotatedAt,
      createdAt: key.createdAt,
      use: key.publicJwk.use || 'sig',
      alg: key.publicJwk.alg || key.privateJwk?.alg || resolveAlgorithm(key.publicJwk, key.privateJwk?.alg) || 'EdDSA',
    })),
    version: snapshot.version,
  };
}

export function resetSigningKeyCache(): void {
  cache = null;
  inflight = null;
}

