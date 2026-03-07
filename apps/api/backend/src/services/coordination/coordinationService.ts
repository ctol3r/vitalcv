/**
 * coordinationService.ts — Wave 132
 *
 * Wraps revocation, ingestion, and federation sync with idempotency guards.
 * All operations are registered in operationRegistry before execution.
 */

import { log } from '../../obs/logger';
import {
  registerOperation,
  updateOperation,
  getStats,
  type TrustOperation,
} from './operationRegistry';
import { revokeCredential } from '../revocation/revocationRegistry';

// ── Revocation ────────────────────────────────────────────────────────────────

/**
 * Idempotency-guarded revocation.
 * If a revocation for this credentialId is already in-flight or done, returns existing op.
 */
export async function coordinateRevocation(
  credentialId: string,
  reason: string,
): Promise<TrustOperation> {
  const key = `revoke:${credentialId}`;
  const op = registerOperation('REVOCATION', credentialId, key);

  // Already handled — return immediately
  if (op.status === 'done' || op.status === 'running') return op;

  updateOperation(op.id, { status: 'running' });

  try {
    revokeCredential({ credentialId, reason, issuer: 'coordination-service' });
    updateOperation(op.id, { status: 'done' });
    log('info', 'coordination_revocation_done', { credentialId, opId: op.id });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown';
    updateOperation(op.id, { status: 'failed', error });
    log('error', 'coordination_revocation_failed', { credentialId, error });
  }

  return op;
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

/**
 * Idempotency-guarded NPI ingestion trigger.
 * Returns existing op if NPI is already being ingested.
 */
export async function coordinateIngestion(
  npi: string,
  _payload: unknown,
): Promise<TrustOperation> {
  const key = `ingest:${npi}:${Date.now().toString().slice(0, -3)}`; // 1-second bucket
  const op = registerOperation('INGESTION', npi, key);

  if (op.status === 'done' || op.status === 'running') return op;

  updateOperation(op.id, { status: 'running' });

  try {
    // Ingestion is handled by the ingest route; here we just track coordination
    // A real implementation would call sourceVerifier.run(npi)
    await Promise.resolve(); // placeholder
    updateOperation(op.id, { status: 'done' });
    log('info', 'coordination_ingestion_done', { npi, opId: op.id });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown';
    updateOperation(op.id, { status: 'failed', error });
    log('error', 'coordination_ingestion_failed', { npi, error });
  }

  return op;
}

// ── Federation Sync ───────────────────────────────────────────────────────────

/**
 * Idempotency-guarded federation sync.
 * Multiple triggers for the same networkId within a sync window collapse to one op.
 */
export async function coordinateFederationSync(networkId: string): Promise<TrustOperation> {
  // 5-minute sync window bucket
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const key = `federation:${networkId}:${bucket}`;
  const op = registerOperation('FEDERATION_SYNC', networkId, key);

  if (op.status === 'done' || op.status === 'running') return op;

  updateOperation(op.id, { status: 'running' });

  try {
    await Promise.resolve(); // placeholder — real impl calls federationService
    updateOperation(op.id, { status: 'done' });
    log('info', 'coordination_federation_done', { networkId, opId: op.id });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown';
    updateOperation(op.id, { status: 'failed', error });
  }

  return op;
}

// ── Status ────────────────────────────────────────────────────────────────────

export function getCoordinationStatus(): {
  pending: number;
  running: number;
  done: number;
  failed: number;
} {
  return getStats();
}
