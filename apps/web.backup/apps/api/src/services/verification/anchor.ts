import { randomUUID } from 'crypto';

export type VerificationStatus = 'valid' | 'invalid';

export interface VerificationEvent {
  id: string;
  nonce?: string;
  credentialIds: string[];
  status: VerificationStatus;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const MAX_EVENTS = 500;
const anchoredEvents: VerificationEvent[] = [];

export function anchorVerificationEvent(partial: Omit<VerificationEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): VerificationEvent {
  const event: VerificationEvent = {
    id: partial.id ?? randomUUID(),
    nonce: partial.nonce,
    credentialIds: partial.credentialIds,
    status: partial.status,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    metadata: partial.metadata,
  };

  anchoredEvents.push(event);
  if (anchoredEvents.length > MAX_EVENTS) {
    anchoredEvents.shift();
  }

  return event;
}

export function listVerificationEvents(limit = 50): VerificationEvent[] {
  return anchoredEvents.slice(-limit).reverse();
}











