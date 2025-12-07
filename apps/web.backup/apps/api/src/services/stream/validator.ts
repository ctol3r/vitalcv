import type { StreamEvent } from './types';

export interface StreamValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateStreamEvent(event: StreamEvent): StreamValidationResult {
  const errors: string[] = [];

  if (!event.eventType || typeof event.eventType !== 'string') {
    errors.push('eventType missing');
  }

  if (!event.payload || typeof event.payload !== 'object') {
    errors.push('payload missing');
  }

  if (!event.chainAnchor || typeof event.chainAnchor !== 'object') {
    errors.push('chainAnchor missing');
  } else {
    if (!event.chainAnchor.hash) {
      errors.push('chainAnchor.hash missing');
    }
    if (!event.chainAnchor.network) {
      errors.push('chainAnchor.network missing');
    }
    if (!event.chainAnchor.anchoredAt) {
      errors.push('chainAnchor.anchoredAt missing');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidStreamEvent(event: StreamEvent): void {
  const result = validateStreamEvent(event);
  if (!result.valid) {
    const message = result.errors.join(', ');
    throw new Error(`Invalid stream event: ${message}`);
  }
}









