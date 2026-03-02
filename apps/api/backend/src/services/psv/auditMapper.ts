/**
 * auditMapper.ts — Wave 39.1: PSV Orchestration Completion
 *
 * NCQA-compliant audit provenance layer for Primary Source Verification.
 *
 * DESIGN
 * ──────
 * Each PSV connector (NPPES, NPDB, StateBoard) returns a raw JSON payload.
 * This module:
 *   1. Canonicalises each payload with RFC 8785-style JSON serialisation.
 *   2. Computes a deterministic SHA-256 hash over (connectorName + npi +
 *      retrievedAt + rawPayload) — the "evidence hash".
 *   3. Writes one AuditEvent row per evidence item into the Prisma ledger.
 *   4. Computes an aggregate hash binding all connector results together.
 *
 * The Wave 35 merkleBatcher (anchorWorker) runs every 5 minutes. It scans
 * all AuditEvent rows where `anchored = false`, builds a Merkle tree, stamps
 * every row with `merkleRoot`, and logs the root for public transparency.
 * This gives NCQA auditors a cryptographic proof-of-existence for every
 * primary-source response — without any direct coupling to the batcher here.
 *
 * NCQA STANDARD 10.12 — Primary Source Verification
 * ────────────────────────────────────────────────────
 * The hash chain produced by this module satisfies the mathematical proof
 * requirement: if any bit of the raw payload was altered after retrieval,
 * the evidence hash will not match the anchored Merkle leaf.
 */

import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { sha256ForPayload, sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Structured output from a single PSV connector run.
 * Connectors produce this; auditMapper consumes it.
 */
export interface ConnectorEvidence {
  /** Human-readable connector name: "NPPES" | "NPDB" | "STATE_BOARD" */
  connectorName: string;
  /** 10-digit NPI that was verified. */
  npi: string;
  /** Raw JSON payload returned by the primary source. */
  rawPayload: unknown;
  /** ISO 8601 timestamp of when the payload was retrieved. */
  retrievedAt: string;
  /** Optional organisation UUID for multi-tenant partitioning. */
  organizationId?: string;
}

/** Persistent audit record returned to the orchestrator. */
export interface AuditRecord {
  auditEventId: string;
  /** SHA-256 of (connectorName + npi + retrievedAt + rawPayload). */
  hash: string;
  connectorName: string;
  npi: string;
  retrievedAt: string;
}

// ── Hashing helpers ────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 evidence hash for a single connector result.
 *
 * The hash covers all four semantic dimensions of the evidence:
 *   - *Who* fetched it  (connectorName)
 *   - *Who* it is about (npi)
 *   - *When* it was fetched (retrievedAt)
 *   - *What* was returned (rawPayload, canonicalised)
 *
 * This means two identical payloads retrieved at different times produce
 * different hashes — preserving temporal provenance.
 */
export function hashEvidence(e: ConnectorEvidence): string {
  return sha256ForPayload({
    connector:   e.connectorName,
    npi:         e.npi,
    retrievedAt: e.retrievedAt,
    payload:     e.rawPayload,
  });
}

/**
 * Compute an aggregate hash binding all connector evidence for a single
 * PSV run.  Individual leaf hashes are sorted before hashing so the result
 * is independent of connector execution order.
 *
 * @param evidence  All connector results for one verification run.
 * @returns         Single SHA-256 hex string representing the full run.
 */
export function buildAggregateEvidenceHash(evidence: ConnectorEvidence[]): string {
  const leafHashes = evidence.map(hashEvidence).sort();
  return sha256Hex(leafHashes.join('|'));
}

// ── Ledger submission ──────────────────────────────────────────────────────

/**
 * Write one AuditEvent per connector evidence item to the Prisma ledger.
 *
 * All rows are written with `anchored: false` so the Wave 35 merkleBatcher
 * will include them in the next batch anchor cycle, producing a Merkle root
 * that can be verified independently by any auditor.
 *
 * Throws immediately if any individual write fails — the caller (orchestrator)
 * should treat a partial audit trail as a fatal error and abort the run.
 *
 * @param evidence   All connector results for this verification run.
 * @param requestId  Correlation ID for the enclosing VerificationRequest.
 * @returns          Persisted audit records (eventId + hash per connector).
 */
export async function submitEvidenceToAuditLedger(
  evidence:  ConnectorEvidence[],
  requestId: string,
): Promise<AuditRecord[]> {
  const records: AuditRecord[] = [];

  for (const e of evidence) {
    const hash = hashEvidence(e);

    const event = await prisma.auditEvent.create({
      data: {
        id:             randomUUID(),
        type:           'VERIFICATION_COMPLETED',
        hash,
        referenceId:    requestId,
        clinicianId:    e.npi,
        organizationId: e.organizationId ?? null,
        anchored:       false,
        metadata: {
          connector:   e.connectorName,
          retrievedAt: e.retrievedAt,
          requestId,
          payloadKeys: typeof e.rawPayload === 'object' && e.rawPayload !== null
            ? Object.keys(e.rawPayload as Record<string, unknown>).length
            : 0,
        },
      },
    });

    records.push({
      auditEventId:  event.id,
      hash:          event.hash,
      connectorName: e.connectorName,
      npi:           e.npi,
      retrievedAt:   e.retrievedAt,
    });

    log('info', 'psv_audit_event_created', {
      auditEventId:  event.id,
      connector:     e.connectorName,
      npi_prefix:    e.npi.slice(0, 4) + '····',
      requestId,
    });
  }

  return records;
}

/**
 * Record a single VERIFICATION_REQUESTED event at the start of a PSV run.
 * This anchors the intent before any connector is called, giving auditors a
 * full before-and-after chain.
 *
 * @param npi        Clinician NPI being verified.
 * @param requestId  Unique ID for the verification run.
 * @param sources    Connector names planned for this run.
 */
export async function recordVerificationRequested(
  npi:        string,
  requestId:  string,
  sources:    string[],
): Promise<string> {
  const hash = sha256ForPayload({
    type:      'VERIFICATION_REQUESTED',
    npi,
    requestId,
    sources:   sources.sort(),
    timestamp: new Date().toISOString(),
  });

  const event = await prisma.auditEvent.create({
    data: {
      id:          randomUUID(),
      type:        'VERIFICATION_REQUESTED',
      hash,
      referenceId: requestId,
      clinicianId: npi,
      anchored:    false,
      metadata:    { requestId, sources },
    },
  });

  log('info', 'psv_verification_requested', {
    auditEventId: event.id,
    npi_prefix:   npi.slice(0, 4) + '····',
    requestId,
    sources,
  });

  return event.id;
}
