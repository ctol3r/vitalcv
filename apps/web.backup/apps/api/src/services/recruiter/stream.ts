import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';

export const RECRUITER_STREAM_EVENTS = ['screening.action', 'proof.request', 'match.ready'] as const;
export type RecruiterEventType = (typeof RECRUITER_STREAM_EVENTS)[number];

export interface RecruiterEventPayload {
  clinicianId: string;
  orgId?: string | null;
  actor?: string;
  traceId?: string;
  payload?: Record<string, unknown>;
}

export interface RecruiterEvent extends RecruiterEventPayload {
  id: string;
  type: RecruiterEventType;
  createdAt: string;
}

export type RecruiterEventListener = (event: RecruiterEvent) => void;

const log = getServiceLogger('api/services/recruiter/stream');
const emitter = new EventEmitter();
const BUFFER_LIMIT = 250;
const WILDCARD = '*';

const history: RecruiterEvent[] = [];

emitter.setMaxListeners(50);

export function publishRecruiterEvent(
  type: RecruiterEventType,
  event: RecruiterEventPayload,
): RecruiterEvent {
  const record: RecruiterEvent = {
    id: randomUUID(),
    type,
    clinicianId: event.clinicianId,
    orgId: event.orgId ?? null,
    actor: event.actor ?? 'system',
    traceId: event.traceId ?? randomUUID(),
    payload: event.payload ?? {},
    createdAt: new Date().toISOString(),
  };

  history.unshift(record);
  if (history.length > BUFFER_LIMIT) {
    history.pop();
  }

  emitter.emit(type, record);
  emitter.emit(WILDCARD, record);

  log.info('Recruiter event published', {
    type,
    clinicianId: record.clinicianId,
    orgId: record.orgId,
    traceId: record.traceId,
  });

  return record;
}

export function subscribeRecruiterEvents(
  listener: RecruiterEventListener,
  topic: RecruiterEventType | typeof WILDCARD = WILDCARD,
): () => void {
  emitter.on(topic, listener as (...args: any[]) => void);
  return () => emitter.off(topic, listener as (...args: any[]) => void);
}

export function listRecruiterEvents(filter: {
  type?: RecruiterEventType;
  clinicianId?: string;
  limit?: number;
} = {}): RecruiterEvent[] {
  const results = history.filter((event) => {
    if (filter.type && event.type !== filter.type) {
      return false;
    }
    if (filter.clinicianId && event.clinicianId !== filter.clinicianId) {
      return false;
    }
    return true;
  });

  if (filter.limit && filter.limit > 0) {
    return results.slice(0, filter.limit);
  }
  return results;
}

export function getRecruiterEventStats(): Record<RecruiterEventType, number> {
  return RECRUITER_STREAM_EVENTS.reduce(
    (acc, type) => ({
      ...acc,
      [type]: history.filter((event) => event.type === type).length,
    }),
    {} as Record<RecruiterEventType, number>,
  );
}

export function clearRecruiterEvents(): void {
  history.splice(0, history.length);
}









