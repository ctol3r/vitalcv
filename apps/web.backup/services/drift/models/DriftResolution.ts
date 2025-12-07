/**
 * B187A-DRIFT-003: DriftResolution model
 *
 * Persists how a drift event was handled, including resolution type,
 * actor, and optional notes.
 */

import { z } from 'zod';
import { JsonValueSchema } from './DriftEvent';

export const DRIFT_RESOLUTION_TYPES = ['MANUAL_OVERRIDE', 'DATA_CORRECTION', 'EXPIRED', 'NONE_NEEDED'] as const;

export type DriftResolutionType = (typeof DRIFT_RESOLUTION_TYPES)[number];

const DriftResolutionEnum = z.enum(DRIFT_RESOLUTION_TYPES);

export const DriftResolutionSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  resolutionType: DriftResolutionEnum,
  resolvedBy: z.string().min(1, 'resolvedBy is required'),
  resolvedAt: z.coerce.date(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
});

export type DriftResolutionInput = z.infer<typeof DriftResolutionSchema>;

export interface DriftResolutionRecord extends DriftResolutionInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export function validateDriftResolution(input: unknown): DriftResolutionInput {
  return DriftResolutionSchema.parse(input);
}

