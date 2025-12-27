import { EventEmitter } from 'events';
import { RenewalMethod } from '../models/CredentialLifecycle.js';

export type PulseEventType = 'RENEWAL_INSTRUCTIONS_AVAILABLE';

export interface RenewalInstructionsPulseEvent {
  type: 'RENEWAL_INSTRUCTIONS_AVAILABLE';
  credentialId: string;
  renewalAuthorityId?: string;
  renewalMethod: RenewalMethod;
  issuedAt: Date;
  metadata?: Record<string, unknown>;
}

export type PulseEvent = RenewalInstructionsPulseEvent;

const pulseEmitter = new EventEmitter();

/**
 * Emit a pulse event for downstream subscribers.
 */
export function emitPulse(event: PulseEvent): void {
  pulseEmitter.emit(event.type, event);
}

/**
 * Subscribe to pulse events.
 */
export function onPulse(
  eventType: PulseEventType,
  handler: (event: PulseEvent) => void
): () => void {
  pulseEmitter.on(eventType, handler);
  return () => pulseEmitter.off(eventType, handler);
}

export { pulseEmitter };

