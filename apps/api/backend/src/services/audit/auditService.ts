import type { AuditCategory, AuditEntry, AuditSeverity, AppendAuditOptions } from './auditLedger';
import { appendAuditEvent, newTraceId } from './auditLedger';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';

export interface AnalyticsEventInput {
  type: string;
  referenceId?: string;
  clinicianId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

export async function emitAnalyticsEvent({
  type,
  referenceId,
  clinicianId,
  organizationId,
  metadata = {},
}: AnalyticsEventInput): Promise<void> {
  try {
    const hash = sha256ForPayload({
      type,
      referenceId: referenceId ?? null,
      clinicianId: clinicianId ?? null,
      organizationId: organizationId ?? null,
      metadata,
    });

    await prisma.auditEvent.create({
      data: {
        type,
        hash,
        referenceId,
        clinicianId,
        organizationId,
        metadata: JSON.parse(JSON.stringify(metadata)),
      },
    });
  } catch (error) {
    log('warn', 'analytics.emit_failed', {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface StructuredAuditEventInput {
  traceId?: string;
  category: AuditCategory | AuditCategory[];
  actor: string;
  resource: string;
  requestFields?: Record<string, unknown>;
  resultFields?: Record<string, unknown>;
  severity?: AuditSeverity;
}

export function emitAuditEvent(input: StructuredAuditEventInput): AuditEntry {
  const traceId = input.traceId ?? newTraceId();

  const entry = appendAuditEvent({
    traceId,
    category: input.category,
    actor: input.actor,
    resource: input.resource,
    requestFields: input.requestFields,
    resultFields: input.resultFields,
    severity: input.severity,
  } satisfies AppendAuditOptions);

  // Dual-write to Postgres for durability across process restarts.
  // Fire-and-forget: callers receive the synchronous in-memory entry immediately.
  // On DB failure: log CRITICAL but do not throw — do not break callers.
  // For the 5 canonical non-repudiation paths, use emitDurableAuditEvent()
  // which awaits the DB write before returning.
  void prisma.auditEvent.create({
    data: {
      id: entry.eventId,
      type: Array.isArray(entry.category) ? entry.category.join(',') : String(entry.category),
      hash: entry.receiptHash,
      referenceId: entry.resource,
      clinicianId: entry.actor,
      anchored: false,
      metadata: JSON.parse(JSON.stringify({
        traceId: entry.traceId,
        category: entry.category,
        actor: entry.actor,
        resource: entry.resource,
        requestFields: entry.requestFields,
        resultFields: entry.resultFields,
        severity: entry.severity,
      })),
    },
  }).catch((error: unknown) => {
    log('error', 'audit_ledger_persist_failed', {
      eventId: entry.eventId,
      traceId: entry.traceId,
      severity: 'CRITICAL',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return entry;
}

export function createTraceId(): string {
  return newTraceId();
}

/**
 * requireAuditBeforeResponse — enforces the audit-before-2xx contract for the
 * 5 canonical non-repudiation events in the VitalCV wedge:
 *
 *   1. NPI_INGESTED        — POST /api/ingest/:npi  (ingestOrchestrator.ts)
 *   2. PASSPORT_SHARED     — POST /api/share        (passportEntity.ts)
 *   3. EMPLOYER_REVIEW_ACCEPTED — POST /api/employer-review/:entityId/accept (employerReviewActions.ts)
 *      This entry previously named EMPLOYER_ACCEPTANCE_CREATED for BOTH this
 *      route and POST /api/hiring/accept. Both halves were wrong: this route
 *      has always emitted EMPLOYER_REVIEW_ACCEPTED, and the hiring route was
 *      the type's only emitter — with nothing reading it — until VCD-01e closed
 *      it. Corrected 2026-08-11 to describe what is actually emitted.
 *   5. START_ATTESTED      — POST /api/hiring/start  (hiring.ts)
 *                          — POST /api/employer-review/:entityId/confirm-start (employerActions.ts)
 *
 * Usage: await requireAuditBeforeResponse(prisma, { type, hash, referenceId, clinicianId, metadata })
 *
 * On DB failure: throws — this is intentional. If the audit cannot be written,
 * the mutation must not be committed. The caller should not return 2xx.
 */
export async function requireAuditBeforeResponse(
  db: any,
  input: {
    type: string;
    hash: string;
    referenceId: string;
    clinicianId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.auditEvent.create({
    data: {
      type:        input.type,
      hash:        input.hash,
      referenceId: input.referenceId,
      clinicianId: input.clinicianId,
      anchored:    false,
      metadata:    input.metadata ?? {},
    },
  });
}
