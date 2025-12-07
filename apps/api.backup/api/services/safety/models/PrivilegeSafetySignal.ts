import { z } from 'zod';

export const PRIVILEGE_SAFETY_SIGNAL_TYPES = [
  'LICENSE_RISK',
  'QUALITY_RISK',
  'EHR_MISMATCH',
  'COMPACT_ELIGIBILITY_LOSS',
  'PAYER_DENIAL_SPIKE',
  'OPPE_LOW',
  'FPPE_FAILURE',
  'DEA_EXPIRED',
  'BOARD_EXPIRED',
  'NPDB_FLAG',
] as const;

export const PrivilegeSafetySignalTypeSchema = z.enum(PRIVILEGE_SAFETY_SIGNAL_TYPES);
export type PrivilegeSafetySignalType = z.infer<typeof PrivilegeSafetySignalTypeSchema>;

export const SAFETY_SIGNAL_SEVERITIES = ['LOW', 'MED', 'HIGH', 'CRITICAL'] as const;
export const SafetySignalSeveritySchema = z.enum(SAFETY_SIGNAL_SEVERITIES);
export type SafetySignalSeverity = z.infer<typeof SafetySignalSeveritySchema>;

export const SafetySignalEvidenceSchema = z.object({
  field: z.string(),
  expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
  observed: z.union([z.string(), z.number(), z.boolean()]).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export type SafetySignalEvidence = z.infer<typeof SafetySignalEvidenceSchema>;

export const PrivilegeSafetySignalSchema = z
  .object({
    clinicianId: z.string().min(1, 'clinicianId is required'),
    orgId: z.string().min(1).optional(),
    privilegeCodes: z.array(z.string().min(1)).nonempty(),
    privilegeGrantedId: z.string().min(1).optional(),
    signalType: PrivilegeSafetySignalTypeSchema,
    severity: SafetySignalSeveritySchema,
    summary: z.string().min(1),
    source: z.string().min(1),
    detectedAt: z.coerce.date().default(() => new Date()),
    details: z.record(z.unknown()).optional(),
    evidence: z.array(SafetySignalEvidenceSchema).optional(),
    resolutionNotes: z.string().optional(),
    resolutionActor: z.string().optional(),
    resolvedAt: z.coerce.date().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export type CreatePrivilegeSafetySignalInput = z.input<typeof PrivilegeSafetySignalSchema>;
export type PrivilegeSafetySignal = z.infer<typeof PrivilegeSafetySignalSchema>;

const SEVERITY_ORDER: Record<SafetySignalSeverity, number> = {
  LOW: 0,
  MED: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function createPrivilegeSafetySignal(
  input: CreatePrivilegeSafetySignalInput
): PrivilegeSafetySignal {
  return PrivilegeSafetySignalSchema.parse(input);
}

export function compareSafetySeverity(
  a: SafetySignalSeverity,
  b: SafetySignalSeverity
): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function maxSafetySeverity(
  ...values: SafetySignalSeverity[]
): SafetySignalSeverity | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((highest, current) =>
    SEVERITY_ORDER[current] > SEVERITY_ORDER[highest] ? current : highest
  );
}

export function severityWeight(severity: SafetySignalSeverity): number {
  switch (severity) {
    case 'CRITICAL':
      return 100;
    case 'HIGH':
      return 50;
    case 'MED':
      return 20;
    default:
      return 5;
  }
}

export function isCriticalSafetySignal(signal: PrivilegeSafetySignal): boolean {
  return signal.severity === 'CRITICAL';
}

export function isResolvedSafetySignal(signal: PrivilegeSafetySignal): boolean {
  return Boolean(signal.resolvedAt);
}

