import crypto from 'crypto';

export interface AuditEventPayload {
  eventType: string;
  actor?: string | number | null;
  subjectId?: string | number | null;
  metadata?: Record<string, unknown>;
  timestamp?: string | Date;
}

export interface LoggedAuditEvent extends AuditEventPayload {
  eventId: string;
  timestamp: string;
}

export async function logAuditEvent(payload: AuditEventPayload): Promise<LoggedAuditEvent> {
  const timestamp =
    typeof payload.timestamp === 'string'
      ? new Date(payload.timestamp).toISOString()
      : (payload.timestamp ?? new Date()).toISOString();

  const event: LoggedAuditEvent = {
    ...payload,
    eventId: crypto.randomUUID(),
    timestamp,
    actor: payload.actor ?? null,
    subjectId: payload.subjectId ?? null,
    metadata: payload.metadata ?? {},
  };

  // TODO: Integrate with tamper-evident audit sink (e.g., append-only log, SIEM)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ channel: 'audit', ...event }));

  return event;
}
