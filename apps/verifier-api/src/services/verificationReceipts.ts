import crypto from 'crypto';
import { SignJWT, importJWK, generateKeyPair, JWK, KeyLike } from 'jose';

export interface VerificationReceiptPayload {
  receiptId: string;
  credentialId: string;
  verifiedBy: string;
  timestamp: string;
  vcHash: string;
  matchScore?: number;
}

export interface StoredVerificationReceipt {
  id: string;
  payload: VerificationReceiptPayload;
  jwt: string;
  createdAt: string;
}

const receiptStore = new Map<string, StoredVerificationReceipt>();

interface SigningKey {
  key: KeyLike;
  alg: string;
  kid?: string;
}

let cachedSigningKey: SigningKey | null = null;

function parseReceiptSigningJwk(raw?: string): JWK | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as JWK;
    }
  } catch (error) {
    console.warn('[VerificationReceipt] Invalid RECEIPT_SIGNING_JWK:', error);
  }
  return null;
}

async function resolveSigningKey(): Promise<SigningKey> {
  if (cachedSigningKey) return cachedSigningKey;

  const jwk = parseReceiptSigningJwk(process.env.RECEIPT_SIGNING_JWK);
  if (jwk) {
    const alg = jwk.alg || process.env.RECEIPT_SIGNING_ALG || 'ES256';
    const key = await importJWK(jwk, alg);
    cachedSigningKey = { key, alg, kid: jwk.kid };
    return cachedSigningKey;
  }

  console.warn('[VerificationReceipt] RECEIPT_SIGNING_JWK not set. Generating ephemeral signing key.');
  const { privateKey } = await generateKeyPair('ES256');
  cachedSigningKey = { key: privateKey, alg: 'ES256' };
  return cachedSigningKey;
}

export function hashCredential(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function createVerificationReceipt(payload: Omit<VerificationReceiptPayload, 'receiptId' | 'timestamp'>): Promise<StoredVerificationReceipt> {
  const receiptId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const receiptPayload: VerificationReceiptPayload = {
    receiptId,
    timestamp,
    ...payload,
  };

  const signingKey = await resolveSigningKey();
  const jwt = await new SignJWT(receiptPayload)
    .setProtectedHeader({
      alg: signingKey.alg,
      kid: signingKey.kid,
      typ: 'JWT',
    })
    .setIssuedAt()
    .setSubject(receiptId)
    .sign(signingKey.key);

  const stored: StoredVerificationReceipt = {
    id: receiptId,
    payload: receiptPayload,
    jwt,
    createdAt: timestamp,
  };

  receiptStore.set(receiptId, stored);
  return stored;
}

export function getVerificationReceipt(id: string): StoredVerificationReceipt | null {
  return receiptStore.get(id) || null;
}

