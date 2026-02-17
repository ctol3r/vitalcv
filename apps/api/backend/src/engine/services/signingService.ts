import { createSign, createVerify, createPublicKey, createPrivateKey, KeyObject } from 'crypto';

const ALG_NAME = 'ES256';
const SIGN_ALG = 'SHA256';
let cachedPrivateKey: KeyObject | null = null;
let cachedPublicKey: KeyObject | null = null;
let cachedKid: string | null = null;

export interface SigningResult {
  signature: string;
  publicKeyId: string;
  signedAt: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

function getPrivateKey(): KeyObject {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = normalizePem(getRequiredEnv('PSV_SIGNING_PRIVATE_KEY'));
  cachedPrivateKey = createPrivateKey({ key: pem, format: 'pem', type: 'pkcs8' });
  return cachedPrivateKey;
}

function getPublicKey(): KeyObject {
  if (cachedPublicKey) return cachedPublicKey;
  const pem = normalizePem(getRequiredEnv('PSV_SIGNING_PUBLIC_KEY'));
  cachedPublicKey = createPublicKey({ key: pem, format: 'pem', type: 'spki' });
  return cachedPublicKey;
}

function getKid(): string {
  if (cachedKid) return cachedKid;
  cachedKid = process.env['PSV_SIGNING_KID'] || 'vitalcv-psv-key-1';
  return cachedKid;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign a payload using ES256 (ECDSA P-256 + SHA-256).
 * Returns a JWS Compact Serialization string.
 */
export async function signArtifact(payload: string): Promise<SigningResult> {
  const privateKey = getPrivateKey();
  const kid = getKid();

  const header = { alg: ALG_NAME, kid };
  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signer = createSign(SIGN_ALG);
  signer.update(signingInput);
  const derSig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  const signatureB64 = base64url(derSig);

  const jws = `${signingInput}.${signatureB64}`;

  return {
    signature: jws,
    publicKeyId: kid,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verify a JWS compact serialization against the configured public key.
 */
export function verifySignature(jws: string): { valid: boolean; payload: string } {
  const parts = jws.split('.');
  if (parts.length !== 3) {
    return { valid: false, payload: '' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  const sigBuf = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  const publicKey = getPublicKey();
  const verifier = createVerify(SIGN_ALG);
  verifier.update(signingInput);
  const valid = verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, sigBuf);

  const payload = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

  return { valid, payload };
}

/**
 * Export the public key as a JWKS document.
 */
export function getJwks(): { keys: Record<string, unknown>[] } {
  const publicKey = getPublicKey();
  const kid = getKid();
  const jwk = publicKey.export({ format: 'jwk' });

  return {
    keys: [
      {
        ...jwk,
        kid,
        alg: ALG_NAME,
        use: 'sig',
      },
    ],
  };
}

export function _resetKeyCache(): void {
  cachedPrivateKey = null;
  cachedPublicKey = null;
  cachedKid = null;
}
