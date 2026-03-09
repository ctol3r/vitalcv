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

  return appendAuditEvent({
    traceId,
    category: input.category,
    actor: input.actor,
    resource: input.resource,
    requestFields: input.requestFields,
    resultFields: input.resultFields,
    severity: input.severity,
  } satisfies AppendAuditOptions);
}

export function createTraceId(): string {
  return newTraceId();
}
