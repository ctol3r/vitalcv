/**
 * B127A-SIGN-017: Agent signed messaging with Ed25519
 *
 * Features:
 * - Ed25519 detached signatures
 * - Headers: {agentId, pou, role, nonce, ts}
 * - Persisted to audit ledger
 */

import { createHash, randomBytes } from 'crypto';
import * as ed from '@noble/ed25519';

/**
 * Agent message headers
 */
export interface AgentMessageHeaders {
  agentId: string;
  pou: 'TREATMENT' | 'OPERATIONS' | 'PAYMENT' | 'RESEARCH' | 'OTHER';
  role: 'coordinator' | 'specialist' | 'reviewer' | 'system';
  nonce: string; // Random nonce to prevent replay
  ts: string; // ISO 8601 timestamp
}

/**
 * Signed agent message
 */
export interface SignedAgentMessage {
  headers: AgentMessageHeaders;
  payload: any;
  signature: string; // Detached Ed25519 signature (hex)
  publicKey: string; // Agent's public key (hex)
}

/**
 * Audit ledger entry
 */
export interface AuditLedgerEntry {
  id: string;
  agentId: string;
  messageHash: string;
  signature: string;
  timestamp: Date;
  headers: AgentMessageHeaders;
  verified: boolean;
}

/**
 * In-memory audit ledger (in production, use database)
 */
const auditLedger: AuditLedgerEntry[] = [];

/**
 * Generate Ed25519 key pair for agent
 */
export async function generateAgentKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
  };
}

/**
 * Generate nonce
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Calculate message hash
 */
function calculateMessageHash(headers: AgentMessageHeaders, payload: any): string {
  const canonical = JSON.stringify({
    headers,
    payload,
  }, null, 0);

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Sign agent message with Ed25519 detached signature
 * B127A-SIGN-017: Ed25519 detached + headers {agentId,pou,role,nonce,ts}
 */
export async function signAgentMessage(
  headers: AgentMessageHeaders,
  payload: any,
  privateKey: string
): Promise<SignedAgentMessage> {
  // Validate required headers
  if (!headers.agentId || !headers.pou || !headers.role || !headers.nonce || !headers.ts) {
    throw new Error('Missing required headers: agentId, pou, role, nonce, ts');
  }

  // Calculate message hash
  const messageHash = calculateMessageHash(headers, payload);

  // Sign message hash with Ed25519
  const privateKeyBytes = Buffer.from(privateKey, 'hex');
  const messageHashBytes = Buffer.from(messageHash, 'hex');

  const signature = await ed.signAsync(messageHashBytes, privateKeyBytes);
  const publicKey = await ed.getPublicKeyAsync(privateKeyBytes);

  return {
    headers,
    payload,
    signature: Buffer.from(signature).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
  };
}

/**
 * Verify agent message signature
 */
export async function verifyAgentMessage(
  message: SignedAgentMessage
): Promise<{
  valid: boolean;
  messageHash: string;
  error?: string;
}> {
  try {
    // Validate required fields
    if (!message.headers || !message.payload || !message.signature || !message.publicKey) {
      return {
        valid: false,
        messageHash: '',
        error: 'Missing required fields in signed message',
      };
    }

    // Validate required headers
    if (!message.headers.agentId || !message.headers.pou || !message.headers.role ||
        !message.headers.nonce || !message.headers.ts) {
      return {
        valid: false,
        messageHash: '',
        error: 'Missing required headers: agentId, pou, role, nonce, ts',
      };
    }

    // Calculate message hash
    const messageHash = calculateMessageHash(message.headers, message.payload);

    // Verify Ed25519 signature
    const publicKeyBytes = Buffer.from(message.publicKey, 'hex');
    const signatureBytes = Buffer.from(message.signature, 'hex');
    const messageHashBytes = Buffer.from(messageHash, 'hex');

    const valid = await ed.verifyAsync(signatureBytes, messageHashBytes, publicKeyBytes);

    return {
      valid,
      messageHash,
      error: valid ? undefined : 'Signature verification failed',
    };
  } catch (error) {
    return {
      valid: false,
      messageHash: '',
      error: `Verification error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Persist signed message to audit ledger
 * B127A-SIGN-017: Signatures persisted to audit ledger
 */
export async function persistToAuditLedger(
  message: SignedAgentMessage
): Promise<{
  success: boolean;
  entryId: string;
  error?: string;
}> {
  try {
    // Verify message before persisting
    const verification = await verifyAgentMessage(message);

    if (!verification.valid) {
      return {
        success: false,
        entryId: '',
        error: `Cannot persist invalid message: ${verification.error}`,
      };
    }

    // Create audit entry
    const entryId = `audit-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const entry: AuditLedgerEntry = {
      id: entryId,
      agentId: message.headers.agentId,
      messageHash: verification.messageHash,
      signature: message.signature,
      timestamp: new Date(message.headers.ts),
      headers: message.headers,
      verified: true,
    };

    // Persist to ledger
    auditLedger.push(entry);

    console.log('[AUDIT LEDGER] Message persisted:', {
      entryId,
      agentId: message.headers.agentId,
      pou: message.headers.pou,
      role: message.headers.role,
      timestamp: message.headers.ts,
    });

    return {
      success: true,
      entryId,
    };
  } catch (error) {
    return {
      success: false,
      entryId: '',
      error: `Failed to persist to audit ledger: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Query audit ledger
 */
export function queryAuditLedger(filter?: {
  agentId?: string;
  pou?: string;
  role?: string;
  startDate?: Date;
  endDate?: Date;
}): AuditLedgerEntry[] {
  let results = [...auditLedger];

  if (filter?.agentId) {
    results = results.filter(e => e.agentId === filter.agentId);
  }

  if (filter?.pou) {
    results = results.filter(e => e.headers.pou === filter.pou);
  }

  if (filter?.role) {
    results = results.filter(e => e.headers.role === filter.role);
  }

  if (filter?.startDate) {
    results = results.filter(e => e.timestamp >= filter.startDate!);
  }

  if (filter?.endDate) {
    results = results.filter(e => e.timestamp <= filter.endDate!);
  }

  return results;
}

/**
 * Get audit ledger statistics
 */
export function getAuditLedgerStats(): {
  totalMessages: number;
  messagesByAgent: Record<string, number>;
  messagesByPoU: Record<string, number>;
  messagesByRole: Record<string, number>;
} {
  const messagesByAgent: Record<string, number> = {};
  const messagesByPoU: Record<string, number> = {};
  const messagesByRole: Record<string, number> = {};

  for (const entry of auditLedger) {
    messagesByAgent[entry.agentId] = (messagesByAgent[entry.agentId] || 0) + 1;
    messagesByPoU[entry.headers.pou] = (messagesByPoU[entry.headers.pou] || 0) + 1;
    messagesByRole[entry.headers.role] = (messagesByRole[entry.headers.role] || 0) + 1;
  }

  return {
    totalMessages: auditLedger.length,
    messagesByAgent,
    messagesByPoU,
    messagesByRole,
  };
}

/**
 * Clear audit ledger (for testing only)
 */
export function clearAuditLedger(): void {
  auditLedger.length = 0;
}

/**
 * Example usage
 */
export async function exampleAgentMessaging(): Promise<void> {
  // 1. Generate key pair for agent
  const { privateKey, publicKey } = await generateAgentKeyPair();
  console.log('Agent key pair generated');

  // 2. Create message headers
  const headers: AgentMessageHeaders = {
    agentId: 'agent-123',
    pou: 'TREATMENT',
    role: 'coordinator',
    nonce: generateNonce(),
    ts: new Date().toISOString(),
  };

  // 3. Sign message
  const payload = {
    action: 'credential_verification',
    providerId: 'provider-456',
    requestedFields: ['name', 'licenseNumber', 'specialty'],
  };

  const signedMessage = await signAgentMessage(headers, payload, privateKey);
  console.log('Message signed');

  // 4. Verify signature
  const verification = await verifyAgentMessage(signedMessage);
  console.log('Signature verified:', verification.valid);

  // 5. Persist to audit ledger
  const persistence = await persistToAuditLedger(signedMessage);
  console.log('Persisted to audit ledger:', persistence.entryId);

  // 6. Query audit ledger
  const entries = queryAuditLedger({ agentId: 'agent-123' });
  console.log('Audit ledger entries:', entries.length);
}

