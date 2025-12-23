import crypto from 'crypto';

export interface AuditEvent {
  eventType: string;
  actor?: string | number | null;
  subjectId?: string | number | null;
  metadata?: Record<string, unknown>;
  timestamp?: string | Date;
}

export interface AuditEventRecord extends AuditEvent {
  eventId: string;
  timestamp: string;
}

export async function logAuditEvent(event: AuditEvent): Promise<AuditEventRecord> {
  const timestamp =
    typeof event.timestamp === 'string'
      ? new Date(event.timestamp).toISOString()
      : (event.timestamp ?? new Date()).toISOString();

  const record: AuditEventRecord = {
    ...event,
    eventId: crypto.randomUUID(),
    actor: event.actor ?? null,
    subjectId: event.subjectId ?? null,
    metadata: event.metadata ?? {},
    timestamp,
  };

  // TODO: route to immutable audit sink (e.g., SIEM + append-only log)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ channel: 'audit', ...record }));

  return record;
}
