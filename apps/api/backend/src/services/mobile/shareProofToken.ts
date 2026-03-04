import { importPKCS8, SignJWT } from 'jose';
import { log } from '../../obs/logger';
import { sha256Hex } from '../../utils/deterministic';

type SigningKey = Awaited<ReturnType<typeof importPKCS8>>;

export type ShareProofTokenClaims = {
  npi: string;
  start_ready: boolean;
  crs_score: number;
  crs_band: 'GREEN' | 'YELLOW' | 'RED';
};

export type ShareProofTokenInput = {
  claims: ShareProofTokenClaims;
  expiresInSeconds: number;
  now?: Date;
};

const ALG = 'ES256' as const;
const KID = 'mobile-share-key-2026-03';
const ISSUER = 'vitalcv';
const AUDIENCE = 'vitalcv-mobile-share';

let privateKeyCache: SigningKey | null = null;

function getPrivateKeyPem(): string {
  const configured =
    process.env.MOBILE_SHARE_SIGNING_KEY?.trim() ||
    process.env.PSV_SIGNING_KEY?.trim() ||
    process.env.VCV_PRIVATE_KEY?.trim() ||
    '';

  if (!configured) {
    throw new Error('Share-proof signing key is not configured');
  }

  return Buffer.from(configured, 'base64').toString('utf-8');
}

async function resolvePrivateKey(): Promise<SigningKey> {
  if (privateKeyCache) {
    return privateKeyCache;
  }

  try {
    privateKeyCache = await importPKCS8(getPrivateKeyPem(), ALG);
    return privateKeyCache;
  } catch (error) {
    log('error', 'share_proof_signing_key_import_failed', {
      event: 'share_proof_signing_key_import_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Unable to initialize share-proof signing key');
  }
}

function toSafeExpirySeconds(input: number): number {
  const max = 900;
  const min = 60;
  const parsed = Number.isFinite(input) ? Math.floor(input) : min;
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

export async function signShareProofToken(input: ShareProofTokenInput): Promise<string> {
  const privateKey = await resolvePrivateKey();
  const now = input.now ?? new Date();
  const expiresInSeconds = toSafeExpirySeconds(input.expiresInSeconds);
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + expiresInSeconds;

  const tokenId = sha256Hex(
    `${input.claims.npi}:${input.claims.crs_score}:${issuedAt}:${expiresAt}:${Math.random().toString(16).slice(2)}`,
  );

  return new SignJWT({
    npi: input.claims.npi,
    start_ready: input.claims.start_ready,
    crs_score: input.claims.crs_score,
    crs_band: input.claims.crs_band,
  })
    .setProtectedHeader({ alg: ALG, kid: KID, typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(`npi:${input.claims.npi}`)
    .setJti(tokenId)
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

export function resetShareProofTokenKeyCache(): void {
  privateKeyCache = null;
}
