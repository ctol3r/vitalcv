/**
 * @vitalcv/audit-receipts
 *
 * Audit receipt generation and verification with JWS signing
 */

import { SignJWT, jwtVerify, importJWK, exportJWK, generateKeyPair, type KeyLike } from 'jose';

export type EventType = 'CREDENTIAL_ISSUED' | 'CREDENTIAL_VERIFIED' | 'CREDENTIAL_REVOKED';
export type ActorType = 'issuer' | 'verifier' | 'system';
export type TrustOutcome = 'VALID' | 'REVOKED' | 'EXPIRED' | 'INVALID_SIGNATURE' | 'UNCHECKABLE' | 'MALFORMED';

export interface Actor {
  type: ActorType;
  id: string;
  ip?: string;
  user_agent?: string;
}

export interface Subject {
  credential_id: string;
  holder_did?: string;
  issuer_did: string;
}

export interface Signature {
  jws: string;
  alg: 'EdDSA' | 'ES256';
  kid: string;
}

export interface AuditReceipt {
  receipt_id: string;
  event_type: EventType;
  timestamp: string;
  actor: Actor;
  subject: Subject;
  outcome: TrustOutcome;
  metadata: Record<string, unknown>;
  signature: Signature;
}

/**
 * Generate a new audit receipt with JWS signature
 */
export async function createReceipt(
  event_type: EventType,
  actor: Actor,
  subject: Subject,
  outcome: TrustOutcome,
  metadata: Record<string, unknown> = {},
  signingKey?: KeyLike
): Promise<AuditReceipt> {
  const receipt_id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Generate or use provided signing key
  let key: KeyLike;
  let kid: string;

  if (signingKey) {
    key = signingKey;
    kid = 'provided-key';
  } else {
    const { privateKey } = await generateKeyPair('EdDSA');
    key = privateKey;
    const jwk = await exportJWK(key);
    kid = jwk.kid || 'generated-key';
  }

  // Create receipt payload (without signature)
  const payload = {
    receipt_id,
    event_type,
    timestamp,
    actor,
    subject,
    outcome,
    metadata,
  };

  // Sign the payload
  const jws = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA', kid })
    .setIssuedAt()
    .sign(key);

  // Create complete receipt
  const receipt: AuditReceipt = {
    ...payload,
    signature: {
      jws,
      alg: 'EdDSA',
      kid,
    },
  };

  // Freeze to ensure immutability
  return Object.freeze(receipt);
}

/**
 * Verify an audit receipt's JWS signature
 */
export async function verifyReceipt(
  receipt: AuditReceipt,
  publicKey: KeyLike
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(receipt.signature.jws, publicKey);

    // Verify payload matches receipt
    return (
      payload.receipt_id === receipt.receipt_id &&
      payload.event_type === receipt.event_type &&
      payload.timestamp === receipt.timestamp
    );
  } catch (error) {
    return false;
  }
}

/**
 * Generate a key pair for testing
 */
export async function generateTestKeyPair(): Promise<{ privateKey: KeyLike; publicKey: KeyLike }> {
  return await generateKeyPair('EdDSA');
}
