/**
 * B187A-DRIFT-001: DriftEvent model
 *
 * Tracks credentialing drift signals for clinicians, including before/after
 * values, severity, and resolution timestamps.
 */

import { z } from 'zod';

export const DRIFT_TYPES = [
  'LICENSE_STATUS',
  'LICENSE_EXPIRY',
  'BOARD_STATUS',
  'DEA_STATUS',
  'NAME_MISMATCH',
  'TAXONOMY_DRIFT',
  'ADDRESS_DRIFT',
  'SPECIALTY_DRIFT',
  'PECOS_DRIFT',
  'MEDICAID_DRIFT',
  'NPPES_DRIFT',
  'COMPACT_STATUS_DRIFT',
] as const;

export const DRIFT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type DriftType = (typeof DRIFT_TYPES)[number];
export type DriftSeverity = (typeof DRIFT_SEVERITIES)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema)])
);

const DriftTypeEnum = z.enum(DRIFT_TYPES);
const DriftSeverityEnum = z.enum(DRIFT_SEVERITIES);

export const DriftEventSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  driftType: DriftTypeEnum,
  severity: DriftSeverityEnum,
  oldValue: JsonValueSchema.nullable(),
  newValue: JsonValueSchema.nullable(),
  detectedAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable().optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
});

export type DriftEventInput = z.infer<typeof DriftEventSchema>;

export interface DriftEventRecord extends Omit<DriftEventInput, 'resolvedAt'> {
  id: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function validateDriftEvent(input: unknown): DriftEventInput {
  return DriftEventSchema.parse(input);
}

export function isDriftResolved(event: Pick<DriftEventRecord, 'resolvedAt'>): boolean {
  return Boolean(event.resolvedAt);
}

