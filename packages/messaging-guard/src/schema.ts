/**
 * STUB: Validation disabled for Wave 3.
 */

import type { ZodError } from 'zod';
import type { MessageEnvelope, SinkConfig } from './types';

export function validateMessageEnvelope(input: unknown): MessageEnvelope {
  return input as MessageEnvelope;
}

export function validateGuardConfig(
  input: SinkConfig & { environment?: string; requireAudience?: boolean }
): SinkConfig & { environment?: string; requireAudience?: boolean } {
  return input;
}

export function formatZodError(error: ZodError<unknown>): string {
  return String(error);
}
