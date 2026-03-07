/**
 * operationRegistry.ts — Wave 132: Coordination & Cleanup Layer
 *
 * In-memory registry tracking in-flight trust operations with idempotency keys.
 * No Prisma dependency — intentionally ephemeral; survives a single process lifecycle.
 */

import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OperationType =
  | 'REVOCATION'
  | 'ISSUANCE'
  | 'INGESTION'
  | 'FEDERATION_SYNC'
  | 'GRAPH_REBUILD';

export type OperationStatus = 'pending' | 'running' | 'done' | 'failed';

export interface TrustOperation {
  id: string;
  type: OperationType;
  entityId: string;
  idempotencyKey: string;
  status: OperationStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const ops = new Map<string, TrustOperation>();           // id → op
const keyIndex = new Map<string, string>();              // idempotencyKey → id

function makeId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Register a new operation. Returns existing operation if idempotencyKey is known.
 */
export function registerOperation(
  type: OperationType,
  entityId: string,
  idempotencyKey: string,
): TrustOperation {
  const existingId = keyIndex.get(idempotencyKey);
  if (existingId) {
    const existing = ops.get(existingId);
    if (existing) {
      log('info', 'coordination_idempotent_hit', { type, entityId, idempotencyKey, existingId });
      return existing;
    }
  }

  const op: TrustOperation = {
    id: makeId(),
    type,
    entityId,
    idempotencyKey,
    status: 'pending',
    startedAt: new Date(),
  };

  ops.set(op.id, op);
  keyIndex.set(idempotencyKey, op.id);
  log('info', 'coordination_op_registered', { id: op.id, type, entityId });
  return op;
}

/** Update fields on an existing operation. */
export function updateOperation(id: string, patch: Partial<TrustOperation>): void {
  const op = ops.get(id);
  if (!op) return;
  Object.assign(op, patch);
  if (patch.status === 'done' || patch.status === 'failed') {
    op.completedAt = new Date();
  }
  log('info', 'coordination_op_updated', { id, status: op.status });
}

export function getOperation(id: string): TrustOperation | undefined {
  return ops.get(id);
}

export function listPending(): TrustOperation[] {
  return [...ops.values()].filter((o) => o.status === 'pending' || o.status === 'running');
}

export function listAll(): TrustOperation[] {
  return [...ops.values()];
}

/**
 * Remove done/failed operations older than threshold (default 24h).
 * Returns count removed.
 */
export function cleanupCompleted(olderThanMs = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  for (const [id, op] of ops) {
    if ((op.status === 'done' || op.status === 'failed') && op.startedAt.getTime() < cutoff) {
      keyIndex.delete(op.idempotencyKey);
      ops.delete(id);
      removed++;
    }
  }
  log('info', 'coordination_cleanup', { removed, cutoffMs: olderThanMs });
  return removed;
}

export function getStats(): Record<OperationStatus, number> {
  const stats: Record<OperationStatus, number> = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const op of ops.values()) stats[op.status]++;
  return stats;
}
