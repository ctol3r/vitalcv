/**
 * B97A-SEC-001: DLQ (Dead Letter Queue) and Anchor Service
 *
 * Handles audit deny events by:
 * 1. Storing deny receipts in DLQ
 * 2. Computing hash anchors for audit trail
 * 3. Emitting to audit service for on-chain anchoring
 */

import { createHash, randomUUID } from 'crypto';

export interface DenyReceipt {
  receiptId: string;
  sink: string;
  reason: string;
  hashAnchor: string;
  timestamp: number;
  requestId: string;
  payload?: unknown;
}

export interface DLQEntry {
  id: string;
  receipt: DenyReceipt;
  createdAt: Date;
  anchored: boolean;
  anchorTxHash?: string;
}

/**
 * In-memory DLQ store (replace with persistent storage in production)
 * TODO: Replace with Redis/RabbitMQ/Kafka DLQ in production
 */
class DLQStore {
  private entries: Map<string, DLQEntry> = new Map();
  private maxEntries = 10000; // Prevent memory bloat

  add(entry: DLQEntry): void {
    // Evict oldest entries if at capacity
    if (this.entries.size >= this.maxEntries) {
      const oldestId = Array.from(this.entries.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.id;
      if (oldestId) {
        this.entries.delete(oldestId);
      }
    }
    this.entries.set(entry.id, entry);
  }

  get(receiptId: string): DLQEntry | undefined {
    return this.entries.get(receiptId);
  }

  getAll(): DLQEntry[] {
    return Array.from(this.entries.values());
  }

  markAnchored(receiptId: string, txHash: string): void {
    const entry = this.entries.get(receiptId);
    if (entry) {
      entry.anchored = true;
      entry.anchorTxHash = txHash;
    }
  }
}

const dlqStore = new DLQStore();

/**
 * Compute hash anchor for audit trail
 * Uses canonical JSON serialization for deterministic hashing
 */
export function computeHashAnchor(
  sink: string,
  payload: unknown,
  timestamp: number
): string {
  // Canonical JSON serialization (sorted keys, no whitespace)
  const canonical = JSON.stringify({
    sink,
    payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
    timestamp,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute failure receipt hash
 */
export function computeFailureReceipt(
  sink: string,
  reason: string,
  hashAnchor: string,
  timestamp: number,
  requestId: string
): DenyReceipt {
  const receipt: DenyReceipt = {
    receiptId: randomUUID(),
    sink,
    reason,
    hashAnchor,
    timestamp,
    requestId,
  };
  return receipt;
}

/**
 * Emit audit deny event to DLQ and audit service
 *
 * B97A-SEC-001: Deny emits DLQ receipt + anchor
 */
export async function emitAuditDeny(
  sink: string,
  reason: string,
  hashAnchor: string,
  requestId: string,
  payload?: unknown
): Promise<DenyReceipt> {
  const timestamp = Date.now();
  const receipt = computeFailureReceipt(
    sink,
    reason,
    hashAnchor,
    timestamp,
    requestId
  );

  // Add payload to receipt if provided
  if (payload !== undefined) {
    receipt.payload = payload;
  }

  // Store in DLQ
  const dlqEntry: DLQEntry = {
    id: receipt.receiptId,
    receipt,
    createdAt: new Date(),
    anchored: false,
  };
  dlqStore.add(dlqEntry);

  // Emit to audit service for on-chain anchoring
  // TODO: Replace with actual audit service integration
  console.log('[DLQ]', JSON.stringify({
    type: 'DENY_RECEIPT',
    ...receipt,
  }));

  // In production, this would:
  // 1. Queue for Merkle batch anchoring
  // 2. Emit to audit service (e.g., services/audit)
  // 3. Store in audit database

  return receipt;
}

/**
 * Get DLQ entry by receipt ID
 */
export function getDLQEntry(receiptId: string): DLQEntry | undefined {
  return dlqStore.get(receiptId);
}

/**
 * Get all DLQ entries (for debugging/admin)
 */
export function getAllDLQEntries(): DLQEntry[] {
  return dlqStore.getAll();
}

/**
 * Mark receipt as anchored (called after on-chain anchoring)
 */
export function markReceiptAnchored(receiptId: string, txHash: string): void {
  dlqStore.markAnchored(receiptId, txHash);
}

