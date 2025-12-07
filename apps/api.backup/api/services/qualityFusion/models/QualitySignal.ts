import { z } from 'zod';

export const QUALITY_SIGNAL_TYPES = [
  'LOW_VOLUME',
  'EXCESSIVE_VARIANCE',
  'COMPLICATION_SPIKE',
  'OPPE_LOW',
  'FPPE_FAILURE',
  'EHR_PRIVILEGE_MISMATCH',
  'PAYER_DENIAL_SPIKE',
  'PECOS_CONFLICT',
  'LICENSE_DRIFT',
  'BOARD_DRIFT',
] as const;

export const QualitySignalTypeSchema = z.enum(QUALITY_SIGNAL_TYPES);
export type QualitySignalType = z.infer<typeof QualitySignalTypeSchema>;

export const QUALITY_SIGNAL_SEVERITIES = ['LOW', 'MED', 'HIGH', 'CRITICAL'] as const;
export const QualitySignalSeveritySchema = z.enum(QUALITY_SIGNAL_SEVERITIES);
export type QualitySignalSeverity = z.infer<typeof QualitySignalSeveritySchema>;

export const QualitySignalDetailsSchema = z
  .object({
    summary: z.string().optional(),
    metric: z.string().optional(),
    observedValue: z.number().optional(),
    expectedValue: z.number().optional(),
    threshold: z.number().optional(),
    unit: z.string().optional(),
    sampleSize: z.number().int().nonnegative().optional(),
    windowStart: z.string().datetime().optional(),
    windowEnd: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
    evidence: z
      .array(
        z.object({
          label: z.string(),
          value: z.union([z.number(), z.string()]),
          threshold: z.number().optional(),
        })
      )
      .optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown());

export const QualitySignalSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  signalType: QualitySignalTypeSchema,
  severity: QualitySignalSeveritySchema,
  timestamp: z.coerce.date().default(() => new Date()),
  details: QualitySignalDetailsSchema.default({}),
  source: z.string().optional(),
});

export type CreateQualitySignalInput = z.input<typeof QualitySignalSchema>;
export type QualitySignal = z.infer<typeof QualitySignalSchema>;

const SEVERITY_ORDER: Record<QualitySignalSeverity, number> = {
  LOW: 0,
  MED: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function createQualitySignal(input: CreateQualitySignalInput): QualitySignal {
  return QualitySignalSchema.parse(input);
}

export function compareSignalSeverity(a: QualitySignalSeverity, b: QualitySignalSeverity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function maxSignalSeverity(
  ...values: QualitySignalSeverity[]
): QualitySignalSeverity | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((highest, current) =>
    SEVERITY_ORDER[current] > SEVERITY_ORDER[highest] ? current : highest
  );
}

export function summarizeQualitySignal(signal: QualitySignal): string {
  if (typeof signal.details?.summary === 'string' && signal.details.summary.trim().length > 0) {
    return signal.details.summary;
  }
  return `${signal.signalType} (${signal.severity}) detected at ${signal.timestamp.toISOString()}`;
}

