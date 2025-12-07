import { randomUUID } from 'crypto';
import type { StreamEvent, StreamTopic, StreamEventType } from './types';

export interface DeadLetterRecord {
  id: string;
  subscriptionId: string;
  endpoint: string;
  topic: StreamTopic;
  eventType: StreamEventType;
  eventId: string;
  failureReason: string;
  attempts: number;
  failedAt: string;
  payloadHash: string;
  lastError?: string;
}

const MAX_DEAD_LETTER = Number(process.env.STREAM_DLQ_MAX ?? 250);
const deadLetterQueue: DeadLetterRecord[] = [];

export function recordDeadLetter(input: Omit<DeadLetterRecord, 'id' | 'failedAt'> & { failedAt?: string }): DeadLetterRecord {
  const record: DeadLetterRecord = {
    ...input,
    id: randomUUID(),
    failedAt: input.failedAt ?? new Date().toISOString(),
  };

  deadLetterQueue.unshift(record);
  if (deadLetterQueue.length > MAX_DEAD_LETTER) {
    deadLetterQueue.pop();
  }

  return record;
}

export function listDeadLetters(limit = 25): DeadLetterRecord[] {
  if (limit <= 0) {
    return [];
  }
  return deadLetterQueue.slice(0, limit);
}

export function getDeadLetterSize(): number {
  return deadLetterQueue.length;
}

export function buildDeadLetterPayload(event: StreamEvent): string {
  return event.chainAnchor?.hash ?? event.id;
}









