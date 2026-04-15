/**
 * eventWriter.ts — thin, fire-and-forget audit-event sink.
 *
 * Wraps prisma.auditEvent.create with try/catch so any caller can emit
 * an audit event without:
 *   - blocking the caller's flow (we await but never throw)
 *   - having to think about the existing AuditEvent column shape
 *   - duplicating the npi-prefix log format
 *
 * Maps the canonical event envelope onto the existing AuditEvent
 * model:
 *   eventType    → type
 *   subjectNpi   → clinicianId
 *   referenceId  → referenceId
 *   timestamp    → createdAt (Prisma default if omitted)
 *   inputsHash + outputsHash + extra metadata → metadata JSON (the
 *     required `hash` column is set to outputsHash, falling back to
 *     inputsHash, then to a placeholder so the chain row is never
 *     written without a digest)
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export interface AuditEventInput {
  eventType: string;
  subjectNpi?: string | null;
  referenceId?: string | null;
  organizationId?: string | null;
  /** Actor id — read from req.auth when available. Optional so unauth'd
   *  paths (e.g. webhooks, background jobs) can still emit events. */
  actorId?: string | null;
  timestamp?: Date;
  inputsHash?: string | null;
  outputsHash?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logEvent(input: AuditEventInput): Promise<void> {
  const eventType = input.eventType?.trim();
  if (!eventType) {
    log('warn', 'audit_event_missing_type');
    return;
  }

  const hash =
    input.outputsHash?.trim() ||
    input.inputsHash?.trim() ||
    'no-digest';

  const metadata = {
    ...(input.metadata ?? {}),
    inputsHash: input.inputsHash ?? null,
    outputsHash: input.outputsHash ?? null,
  };

  try {
    await prisma.auditEvent.create({
      data: {
        type: eventType,
        hash,
        clinicianId: input.subjectNpi ?? null,
        referenceId: input.referenceId ?? null,
        organizationId: input.organizationId ?? null,
        actorId: input.actorId ?? null,
        metadata: metadata as never,
        ...(input.timestamp ? { createdAt: input.timestamp } : {}),
      },
    });
  } catch (error) {
    // Swallow — audit writes must never block the caller.
    log('warn', 'audit_event_write_failed', {
      type: eventType,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
