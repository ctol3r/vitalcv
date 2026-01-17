/**
 * Ed25519 Cryptography Utilities
 * Tagged: cursor-batch-1101
 * Agent: CODEX • BACKEND • vitalcv
 *
 * Uses @noble/ed25519 for all Ed25519/EdDSA operations
 * Supports W3C VC signing, JWK export, and OIDC4VCI compliance
 */

import * as ed from '@noble/ed25519';

export interface Ed25519KeyPair {
  publicKey: string; // hex encoded
  secretKey: string; // hex encoded (keep secure!)
}

export interface SignedMessage {
  message: string;
  signature: string; // hex encoded
  publicKey: string; // hex encoded
  algorithm: 'Ed25519';
  timestamp: number;
}

export interface VerificationResult {
  valid: boolean;
  message?: string;
  publicKey?: string;
  timestamp?: number;
  error?: string;
}

export interface JWK {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string; // base64url encoded public key
  d?: string; // base64url encoded private key (only in private JWKs)
  use?: 'sig';
  kid?: string;
  alg?: 'EdDSA';
}

/**
 * Generate a new Ed25519 key pair
 */
export async function generateKeyPair(): Promise<Ed25519KeyPair> {
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);

  return {
    publicKey: Buffer.from(publicKey).toString('hex'),
    secretKey: Buffer.from(secretKey).toString('hex'),
  };
}

/**
 * Generate key pair from seed (deterministic)
 */
export async function generateKeyPairFromSeed(seed: Uint8Array): Promise<Ed25519KeyPair> {
  if (seed.length !== 32) {
    throw new Error('Seed must be exactly 32 bytes');
  }

  const secretKey = seed;
  const publicKey = await ed.getPublicKeyAsync(secretKey);

  return {
    publicKey: Buffer.from(publicKey).toString('hex'),
    secretKey: Buffer.from(secretKey).toString('hex'),
  };
}

/**
 * Sign a message with Ed25519
 */
export async function sign(message: string | object, secretKey: string): Promise<SignedMessage> {
  // Convert message to string if object
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  const messageBytes = Buffer.from(messageStr, 'utf-8');

  // Decode secret key from hex
  const secretKeyBytes = Buffer.from(secretKey, 'hex');

  if (secretKeyBytes.length !== 32) {
    throw new Error('Invalid Ed25519 secret key length (expected 32 bytes)');
  }

  // Sign the message
  const signatureBytes = await ed.signAsync(messageBytes, secretKeyBytes);

  // Derive public key from secret key
  const publicKeyBytes = await ed.getPublicKeyAsync(secretKeyBytes);

  return {
    message: messageStr,
    signature: Buffer.from(signatureBytes).toString('hex'),
    publicKey: Buffer.from(publicKeyBytes).toString('hex'),
    algorithm: 'Ed25519',
    timestamp: Date.now(),
  };
}

/**
 * Verify an Ed25519 signature
 */
export async function verify(signedMessage: SignedMessage): Promise<VerificationResult> {
  try {
    const { message, signature, publicKey } = signedMessage;

    // Decode inputs
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = Buffer.from(signature, 'hex');
    const publicKeyBytes = Buffer.from(publicKey, 'hex');

    // Verify signature
    const valid = await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);

    if (!valid) {
      return {
        valid: false,
        error: 'Signature verification failed',
      };
    }

    return {
      valid: true,
      message,
      publicKey,
      timestamp: signedMessage.timestamp,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Verification error',
    };
  }
}

/**
 * Verify a signature against a specific public key
 */
export async function verifyWithPublicKey(
  message: string | object,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const messageBytes = Buffer.from(messageStr, 'utf-8');
    const signatureBytes = Buffer.from(signature, 'hex');
    const publicKeyBytes = Buffer.from(publicKey, 'hex');

    return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Create a signed JWT-like token with Ed25519
 */
export interface Ed25519Token {
  header: {
    alg: 'EdDSA';
    typ: 'JWT';
  };
  payload: Record<string, any>;
  signature: string;
}

export async function createToken(
  payload: Record<string, any>,
  secretKey: string,
  expiresIn: number = 3600, // 1 hour default
): Promise<string> {
  const header = {
    alg: 'EdDSA' as const,
    typ: 'JWT' as const,
  };

  const tokenPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  // Create message to sign
  const message = JSON.stringify({
    header,
    payload: tokenPayload,
  });

  const signed = await sign(message, secretKey);

  // Encode as base64url (JWT format)
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(tokenPayload));
  const signatureB64 = base64urlEncode(Buffer.from(signed.signature, 'hex').toString('binary'));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verify and decode an Ed25519 JWT token
 */
export async function verifyToken(
  token: string,
  publicKey: string,
): Promise<{ valid: boolean; payload?: any; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode parts
    const header = JSON.parse(base64urlDecode(headerB64));
    const payload = JSON.parse(base64urlDecode(payloadB64));
    const signature = Buffer.from(base64urlDecode(signatureB64), 'binary').toString('hex');

    // Verify algorithm
    if (header.alg !== 'EdDSA') {
      return { valid: false, error: 'Invalid algorithm (expected EdDSA)' };
    }

    // Check expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token expired' };
    }

    // Verify signature
    const message = JSON.stringify({ header, payload });
    const valid = await verifyWithPublicKey(message, signature, publicKey);

    if (!valid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, payload };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Token verification failed' };
  }
}

/**
 * Base64url encoding (URL-safe base64 without padding)
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64url decoding
 */
function base64urlDecode(str: string): string {
  // Add padding
  str += '==='.slice((str.length + 3) % 4);
  // Replace URL-safe chars
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Sign a Verifiable Credential with Ed25519
 */
export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: Record<string, any>;
}

export interface SignedVerifiableCredential extends VerifiableCredential {
  proof: {
    type: 'Ed25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
  };
}

export async function signVerifiableCredential(
  credential: VerifiableCredential,
  secretKey: string,
  verificationMethod: string,
): Promise<SignedVerifiableCredential> {
  // Create canonical representation
  const canonical = JSON.stringify(credential);

  // Sign
  const signed = await sign(canonical, secretKey);

  return {
    ...credential,
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      verificationMethod,
      proofPurpose: 'assertionMethod',
      proofValue: signed.signature,
    },
  };
}

/**
 * Verify a signed Verifiable Credential
 */
export async function verifyVerifiableCredential(
  signedCredential: SignedVerifiableCredential,
  publicKey: string,
): Promise<VerificationResult> {
  try {
    const { proof, ...credential } = signedCredential;

    // Verify proof type
    if (proof.type !== 'Ed25519Signature2020') {
      return {
        valid: false,
        error: 'Invalid proof type (expected Ed25519Signature2020)',
      };
    }

    // Create canonical representation
    const canonical = JSON.stringify(credential);

    // Verify signature
    const valid = await verifyWithPublicKey(canonical, proof.proofValue, publicKey);

    return {
      valid,
      message: canonical,
      publicKey,
      error: valid ? undefined : 'Signature verification failed',
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Verification error',
    };
  }
}

/**
 * Convert Ed25519 key pair to JWK format
 */
export async function keyPairToJWK(
  keyPair: Ed25519KeyPair,
  kid?: string,
  includePrivate: boolean = false,
): Promise<JWK> {
  const publicKeyBytes = Buffer.from(keyPair.publicKey, 'hex');

  const jwk: JWK = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64urlEncode(Buffer.from(publicKeyBytes).toString('binary')),
    use: 'sig',
    alg: 'EdDSA',
  };

  if (kid) {
    jwk.kid = kid;
  }

  if (includePrivate) {
    const secretKeyBytes = Buffer.from(keyPair.secretKey, 'hex');
    jwk.d = base64urlEncode(Buffer.from(secretKeyBytes).toString('binary'));
  }

  return jwk;
}

/**
 * Import JWK to Ed25519 key pair
 */
export async function jwkToKeyPair(jwk: JWK): Promise<Ed25519KeyPair> {
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error('Invalid JWK: must be OKP/Ed25519');
  }

  const publicKey = Buffer.from(base64urlDecode(jwk.x), 'binary').toString('hex');

  if (!jwk.d) {
    throw new Error('JWK does not contain private key');
  }

  const secretKey = Buffer.from(base64urlDecode(jwk.d), 'binary').toString('hex');

  return { publicKey, secretKey };
}

/**
 * Get public JWK from public key hex
 */
export function publicKeyToJWK(publicKeyHex: string, kid?: string): JWK {
  const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');

  const jwk: JWK = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64urlEncode(Buffer.from(publicKeyBytes).toString('binary')),
    use: 'sig',
    alg: 'EdDSA',
  };

  if (kid) {
    jwk.kid = kid;
  }

  return jwk;
}

/**
 * Generate kid (Key ID) from public key
 * Uses first 8 bytes of the public key as a simple deterministic identifier
 */
export function generateKid(publicKeyHex: string): string {
  const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
  return publicKeyBytes.slice(0, 8).toString('hex');
}

export default {
  generateKeyPair,
  generateKeyPairFromSeed,
  sign,
  verify,
  verifyWithPublicKey,
  createToken,
  verifyToken,
  signVerifiableCredential,
  verifyVerifiableCredential,
  keyPairToJWK,
  jwkToKeyPair,
  publicKeyToJWK,
  generateKid,
};
