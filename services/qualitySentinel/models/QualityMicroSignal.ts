import { z } from 'zod';

export const QUALITY_MICRO_SIGNAL_TYPES = [
  'WEAK_OPPE_DRIFT',
  'MINOR_COMPLICATION_CLUSTER',
  'ENROLLMENT_DENIAL_MICROTREND',
  'EHR_MICROMISMATCH',
  'PATTERN_BREAK',
  'PRIVILEGE_UNUSUAL_USAGE',
  'RISK_ACCELERATION',
  'DRIFT_PRECURSOR',
] as const;

export const QualityMicroSignalTypeSchema = z.enum(QUALITY_MICRO_SIGNAL_TYPES);
export type QualityMicroSignalType = z.infer<typeof QualityMicroSignalTypeSchema>;

export const QUALITY_MICRO_SIGNAL_SEVERITIES = ['LOW', 'MEDIUM'] as const;
export const QualityMicroSignalSeveritySchema = z.enum(QUALITY_MICRO_SIGNAL_SEVERITIES);
export type QualityMicroSignalSeverity = z.infer<typeof QualityMicroSignalSeveritySchema>;

export const QualityMicroSignalDetailsSchema = z
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

export const QualityMicroSignalSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  signalType: QualityMicroSignalTypeSchema,
  severity: QualityMicroSignalSeveritySchema,
  timestamp: z.coerce.date().default(() => new Date()),
  details: QualityMicroSignalDetailsSchema.default({}),
  source: z.string().optional(),
});

export type CreateQualityMicroSignalInput = z.input<typeof QualityMicroSignalSchema>;
export type QualityMicroSignal = z.infer<typeof QualityMicroSignalSchema>;

const SEVERITY_ORDER: Record<QualityMicroSignalSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
};

export function createQualityMicroSignal(
  input: CreateQualityMicroSignalInput
): QualityMicroSignal {
  return QualityMicroSignalSchema.parse(input);
}

export function compareMicroSignalSeverity(
  a: QualityMicroSignalSeverity,
  b: QualityMicroSignalSeverity
): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function maxMicroSignalSeverity(
  ...values: QualityMicroSignalSeverity[]
): QualityMicroSignalSeverity | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((highest, current) =>
    SEVERITY_ORDER[current] > SEVERITY_ORDER[highest] ? current : highest
  );
}

export function summarizeQualityMicroSignal(signal: QualityMicroSignal): string {
  if (typeof signal.details?.summary === 'string' && signal.details.summary.trim().length > 0) {
    return signal.details.summary;
  }
  return `${signal.signalType} (${signal.severity}) detected at ${signal.timestamp.toISOString()}`;
}
