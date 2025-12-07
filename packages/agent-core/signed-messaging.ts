/**
 * B128A-SIGN-017: Agent signed messaging
 * Ed25519 detached signatures with headers {agentId, pou, role, nonce, ts}
 */

import { generateKeyPair, exportJWK, importJWK, SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';

export interface AgentMessageHeaders {
  agentId: string;
  pou: string; // Purpose of use
  role: string; // Agent role
  nonce: string; // One-time nonce for replay protection
  ts: string; // Timestamp (ISO 8601)
  messageHash: string; // SHA-256 hash of message content
}

export interface SignedAgentMessage {
  headers: AgentMessageHeaders;
  message: string;
  signature: string; // Ed25519 detached signature
  publicKey: string; // Agent's public key for verification
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  agentId: string;
  messageHash: string;
  pou: string;
  role: string;
  verified: boolean;
  error?: string;
}

// Audit ledger (in production, use database)
const auditLedger: AuditEntry[] = [];

/**
 * B128A-SIGN-017: Generate Ed25519 key pair for agent
 */
export async function generateAgentKeyPair(): Promise<{
  privateKey: any;
  publicKey: any;
  publicKeyJWK: string;
}> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const publicKeyJWK = await exportJWK(publicKey);

  return {
    privateKey,
    publicKey,
    publicKeyJWK: JSON.stringify(publicKeyJWK),
  };
}

/**
 * B128A-SIGN-017: Compute SHA-256 hash of message
 */
export function computeMessageHash(message: string): string {
  return createHash('sha256').update(message).digest('hex');
}

/**
 * B128A-SIGN-017: Generate nonce for replay protection
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * B128A-SIGN-017: Sign agent message with Ed25519
 * Creates detached signature with required headers
 */
export async function signAgentMessage(
  message: string,
  agentId: string,
  pou: string,
  role: string,
  privateKey: any
): Promise<SignedAgentMessage> {
  // B128A-SIGN-017: Generate headers
  const headers: AgentMessageHeaders = {
    agentId,
    pou,
    role,
    nonce: generateNonce(),
    ts: new Date().toISOString(),
    messageHash: computeMessageHash(message),
  };

  // B128A-SIGN-017: Create detached signature using Ed25519
  // Sign the combination of headers + message
  const payload = JSON.stringify({ ...headers, message });

  const signature = await new SignJWT({ payload })
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(privateKey);

  // Export public key for verification
  const publicKey = await exportJWK(privateKey);
  const publicKeyStr = JSON.stringify(publicKey);

  // B128A-SIGN-017: Audit entry persisted to ledger
  auditLedger.push({
    timestamp: headers.ts,
    event: 'AGENT_MESSAGE_SIGNED',
    agentId,
    messageHash: headers.messageHash,
    pou,
    role,
    verified: true,
  });

  return {
    headers,
    message,
    signature,
    publicKey: publicKeyStr,
  };
}

/**
 * B128A-SIGN-017: Verify agent message signature
 */
export async function verifyAgentMessage(
  signedMessage: SignedAgentMessage
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { headers, message, signature, publicKey } = signedMessage;

    // B128A-SIGN-017: Verify headers are present
    if (!headers.agentId || !headers.pou || !headers.role || !headers.nonce || !headers.ts) {
      return { valid: false, error: 'Missing required headers' };
    }

    // Verify message hash matches
    const computedHash = computeMessageHash(message);
    if (computedHash !== headers.messageHash) {
      return { valid: false, error: 'Message hash mismatch' };
    }

    // Verify timestamp is recent (within 5 minutes)
    const messageTime = new Date(headers.ts).getTime();
    const now = Date.now();
    const age = (now - messageTime) / 1000; // Age in seconds

    if (age > 300) {
      // 5 minutes
      return { valid: false, error: 'Message timestamp too old (>5 minutes)' };
    }

    if (age < -60) {
      // 1 minute in future tolerance
      return { valid: false, error: 'Message timestamp in future' };
    }

    // B128A-SIGN-017: Verify Ed25519 signature
    const publicKeyJWK = JSON.parse(publicKey);
    const publicKeyObj = await importJWK(publicKeyJWK, 'EdDSA');

    const payload = JSON.stringify({ ...headers, message });
    const verified = await jwtVerify(signature, publicKeyObj, {
      algorithms: ['EdDSA'],
    });

    // B128A-SIGN-017: Audit entry persisted to ledger
    auditLedger.push({
      timestamp: new Date().toISOString(),
      event: 'AGENT_MESSAGE_VERIFIED',
      agentId: headers.agentId,
      messageHash: headers.messageHash,
      pou: headers.pou,
      role: headers.role,
      verified: true,
    });

    return { valid: true };
  } catch (error) {
    // Verification failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    auditLedger.push({
      timestamp: new Date().toISOString(),
      event: 'AGENT_MESSAGE_VERIFICATION_FAILED',
      agentId: signedMessage.headers.agentId,
      messageHash: signedMessage.headers.messageHash,
      pou: signedMessage.headers.pou,
      role: signedMessage.headers.role,
      verified: false,
      error: errorMessage,
    });

    return { valid: false, error: errorMessage };
  }
}

/**
 * Get audit ledger entries
 */
export function getAuditLedger(limit: number = 100): AuditEntry[] {
  return auditLedger.slice(-limit);
}

/**
 * Clear audit ledger (for testing)
 */
export function clearAuditLedger(): void {
  auditLedger.length = 0;
}

/**
 * B128A-SIGN-017: Example usage
 */
export async function exampleAgentMessaging(): Promise<void> {
  // Generate agent key pair
  const { privateKey, publicKeyJWK } = await generateAgentKeyPair();

  // Sign message
  const message = 'Request patient authorization for treatment';
  const signedMessage = await signAgentMessage(
    message,
    'agent-123',
    'TREATMENT',
    'clinical-assistant',
    privateKey
  );

  console.log('Signed message:', signedMessage);

  // Verify message
  const verification = await verifyAgentMessage(signedMessage);

  console.log('Verification result:', verification);
}

