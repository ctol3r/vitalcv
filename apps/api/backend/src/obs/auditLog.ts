import { log } from './logger';

export interface AuditEvent {
  eventType: string;
  actor?: string | null;
  subjectId?: string | null;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Minimal audit sink for operational visibility.
 * Keeps payloads PII-free while preserving traceability fields.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const { eventType, actor, subjectId, metadata } = event;
  const timestamp = event.timestamp ?? new Date().toISOString();

  log('info', 'audit_event', {
    eventType,
    actor: actor ?? 'anonymous',
    subjectId: subjectId ?? null,
    metadata: metadata ?? {},
    timestamp,
  });
}
