import { z } from 'zod';
import { normalizePrivilegeCode } from '../../privileging/models/PrivilegeMatrix.js';

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

export const PRIVILEGE_SAFETY_SEVERITIES = ['LOW', 'MED', 'HIGH', 'CRITICAL'] as const;
export const PrivilegeSafetySeveritySchema = z.enum(PRIVILEGE_SAFETY_SEVERITIES);
export type PrivilegeSafetySeverity = z.infer<typeof PrivilegeSafetySeveritySchema>;

export const PRIVILEGE_SAFETY_ACTIONS = ['monitor', 'alert', 'restrict', 'suspend'] as const;
export type PrivilegeSafetyAction = (typeof PRIVILEGE_SAFETY_ACTIONS)[number];

export const ALL_PRIVILEGES_TOKEN = '*ALL_PRIVILEGES*';

export const PrivilegeSafetySignalSchema = z
  .object({
    clinicianId: z.string().min(1, 'clinicianId is required'),
    signalType: PrivilegeSafetySignalTypeSchema,
    severity: PrivilegeSafetySeveritySchema,
    privilegeCodes: z.array(z.string().min(1)).default([]),
    summary: z.string().min(1, 'summary is required'),
    source: z.string().min(1, 'source is required'),
    sourceEventId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    triggeredAt: z.coerce.date().default(() => new Date()),
    recommendedAction: z.enum(PRIVILEGE_SAFETY_ACTIONS).optional(),
  })
  .strict();

export type CreatePrivilegeSafetySignalInput = z.input<typeof PrivilegeSafetySignalSchema>;
export type PrivilegeSafetySignal = z.infer<typeof PrivilegeSafetySignalSchema>;

const SEVERITY_ORDER: Record<PrivilegeSafetySeverity, number> = {
  LOW: 0,
  MED: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function createPrivilegeSafetySignal(
  input: CreatePrivilegeSafetySignalInput
): PrivilegeSafetySignal {
  const parsed = PrivilegeSafetySignalSchema.parse(input);
  return {
    ...parsed,
    privilegeCodes: ensurePrivilegeCodes(parsed.privilegeCodes),
  };
}

export function ensurePrivilegeCodes(codes?: string[]): string[] {
  if (!codes || codes.length === 0) {
    return [ALL_PRIVILEGES_TOKEN];
  }

  const normalized = Array.from(
    new Set(
      codes
        .map((code) => code.trim())
        .filter((code): code is string => code.length > 0)
        .map((code) => {
          try {
            return normalizePrivilegeCode(code);
          } catch {
            return code.toUpperCase();
          }
        })
    )
  );

  return normalized.length > 0 ? normalized : [ALL_PRIVILEGES_TOKEN];
}

export function compareSafetySeverity(
  a: PrivilegeSafetySeverity,
  b: PrivilegeSafetySeverity
): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export interface PrivilegeSafetySignalSnapshot {
  clinicianId: string;
  signalType: PrivilegeSafetySignalType;
  severity: PrivilegeSafetySeverity;
  detectedAt: Date;
}

