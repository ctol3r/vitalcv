import { createHash } from 'node:crypto';

type SigningKeyMaterial = {
  kid: string;
  alg: 'ES256';
  privateJwk: EcSigningJwk;
  publicJwk: EcSigningJwkPublic;
};

type EcSigningJwk = {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  d: string;
  alg: 'ES256';
  use: 'sig';
  kid?: string;
};

type EcSigningJwkPublic = {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  alg: 'ES256';
  use: 'sig';
  kid?: string;
};

let cachedSigningKey: SigningKeyMaterial | null = null;

function normalizeSigningKey(raw: unknown): EcSigningJwk {
  if (!raw || typeof raw !== 'object') {
    throw new Error('ISSUER_SIGNING_JWK must be a JSON object.');
  }

  const key = raw as Record<string, unknown>;
  if (key.kty !== 'EC' || key.crv !== 'P-256') {
    throw new Error('ISSUER_SIGNING_JWK must be an EC P-256 key.');
  }
  if (typeof key.x !== 'string' || typeof key.y !== 'string' || typeof key.d !== 'string') {
    throw new Error('ISSUER_SIGNING_JWK must include x, y, and d parameters.');
  }

  const alg = key.alg === undefined ? 'ES256' : String(key.alg);
  if (alg !== 'ES256') {
    throw new Error('ISSUER_SIGNING_JWK must use ES256.');
  }

  const use = key.use === undefined ? 'sig' : String(key.use);
  if (use !== 'sig') {
    throw new Error('ISSUER_SIGNING_JWK must set use = sig.');
  }

  return {
    kty: 'EC',
    crv: 'P-256',
    x: String(key.x),
    y: String(key.y),
    d: String(key.d),
    alg: 'ES256',
    use: 'sig',
    kid: typeof key.kid === 'string' && key.kid.trim().length > 0 ? key.kid.trim() : undefined,
  };
}

function readSigningKeyRaw(): string {
  if (process.env.ISSUER_SIGNING_JWK && process.env.ISSUER_SIGNING_JWK.trim().length > 0) {
    return process.env.ISSUER_SIGNING_JWK.trim();
  }

  if (process.env.SIGNING_KEY_JWK && process.env.SIGNING_KEY_JWK.trim().length > 0) {
    return process.env.SIGNING_KEY_JWK.trim();
  }

  return '';
}

function buildKid(jwk: EcSigningJwk): string {
  const normalized = `${jwk.kty}|${jwk.crv}|${jwk.x}|${jwk.y}|${jwk.d}`;
  return createHash('sha256').update(normalized).digest('hex');
}

export function parseSigningKeyFingerprint(jwk: EcSigningJwkPublic | EcSigningJwk): string {
  return createHash('sha256')
    .update(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }))
    .digest('hex');
}

export function isSigningKeyConfigured(): boolean {
  try {
    const raw = readSigningKeyRaw();
    if (!raw || raw.trim().length === 0) {
      return false;
    }
    normalizeSigningKey(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

export function isES256SigningKeyConfigured(): boolean {
  if (!isSigningKeyConfigured()) {
    return false;
  }
  return true;
}

export function getSigningKeyMaterial(): SigningKeyMaterial {
  if (cachedSigningKey) {
    return cachedSigningKey;
  }

  const raw = readSigningKeyRaw();
  if (!raw || raw.trim().length === 0) {
    throw new Error('ISSUER_SIGNING_JWK is required for signing VC payloads.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ISSUER_SIGNING_JWK is not valid JSON.');
  }

  const privateJwk = normalizeSigningKey(parsed);
  const publicJwk: EcSigningJwkPublic = {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    alg: 'ES256',
    use: 'sig',
    kid: privateJwk.kid,
  };

  if (!privateJwk.kid) {
    privateJwk.kid = buildKid(privateJwk);
    publicJwk.kid = privateJwk.kid;
  }

  cachedSigningKey = {
    kid: privateJwk.kid,
    alg: 'ES256',
    privateJwk,
    publicJwk,
  };
  return cachedSigningKey;
}

export function getPublicSigningJwk(): EcSigningJwkPublic {
  return { ...getSigningKeyMaterial().publicJwk };
}
