/**
 * B197B-SAFETY-006: Privilege Safety State model + helpers
 *
 * Centralizes validation + helper utilities for the privilege safety ledger.
 * These helpers are shared by the restriction engine and trigger workflows.
 */

import { z } from 'zod';
import {
  PrivilegeDependencyType,
  PrivilegeSafetyStateValue,
  SafetySignalSeverity,
} from '@prisma/client';
import { normalizePrivilegeCode } from '../../privyDep/models/PrivilegeNode';

export const PRIVILEGE_SAFETY_STATE_VALUES = Object.freeze({
  FULL: PrivilegeSafetyStateValue.FULL,
  RESTRICTED: PrivilegeSafetyStateValue.RESTRICTED,
  HOLD: PrivilegeSafetyStateValue.HOLD,
  PENDING_REVIEW: PrivilegeSafetyStateValue.PENDING_REVIEW,
  SUSPENDED: PrivilegeSafetyStateValue.SUSPENDED,
});

export const SAFETY_SIGNAL_SEVERITY_ORDER: Record<SafetySignalSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export const PRIVILEGE_STATE_ORDER: Record<PrivilegeSafetyStateValue, number> = {
  [PrivilegeSafetyStateValue.FULL]: 0,
  [PrivilegeSafetyStateValue.PENDING_REVIEW]: 1,
  [PrivilegeSafetyStateValue.RESTRICTED]: 2,
  [PrivilegeSafetyStateValue.HOLD]: 3,
  [PrivilegeSafetyStateValue.SUSPENDED]: 4,
};

export function compareStateSeverity(
  a: PrivilegeSafetyStateValue,
  b: PrivilegeSafetyStateValue,
): number {
  return Math.sign(PRIVILEGE_STATE_ORDER[a] - PRIVILEGE_STATE_ORDER[b]);
}

export function compareSignalSeverity(a: SafetySignalSeverity, b: SafetySignalSeverity): number {
  return Math.sign(SAFETY_SIGNAL_SEVERITY_ORDER[a] - SAFETY_SIGNAL_SEVERITY_ORDER[b]);
}

export function isBlockingState(state: PrivilegeSafetyStateValue): boolean {
  return state !== PrivilegeSafetyStateValue.FULL;
}

export const DEFAULT_SEVERITY_STATE_MAP: Record<SafetySignalSeverity, PrivilegeSafetyStateValue> = {
  LOW: PrivilegeSafetyStateValue.FULL,
  MEDIUM: PrivilegeSafetyStateValue.PENDING_REVIEW,
  HIGH: PrivilegeSafetyStateValue.RESTRICTED,
  CRITICAL: PrivilegeSafetyStateValue.HOLD,
};

export function mapSeverityToState(
  severity: SafetySignalSeverity,
  overrides?: Partial<Record<SafetySignalSeverity, PrivilegeSafetyStateValue>>,
): PrivilegeSafetyStateValue {
  if (overrides?.[severity]) {
    return overrides[severity]!;
  }
  return DEFAULT_SEVERITY_STATE_MAP[severity];
}

export interface CascadeScopeEntry {
  originPrivilegeCode: string;
  dependencyType: PrivilegeDependencyType | 'CONFLICT';
  path: string[];
}

export interface SafetySignalDescriptor {
  id: string;
  privilegeCodes: string[];
  severity: SafetySignalSeverity;
  reasonCode: string;
  source: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  detectedAt?: Date;
}

export const PrivilegeSafetyStateSchema = z.object({
  id: z.string().optional(),
  privilegeGrantedId: z.string().optional().nullable(),
  clinicianId: z.string().min(1),
  orgId: z.string().min(1),
  privilegeCode: z
    .string()
    .min(3)
    .max(80)
    .transform((code) => normalizePrivilegeCode(code)),
  state: z.nativeEnum(PrivilegeSafetyStateValue),
  reasonCode: z.string().min(3).max(120),
  severity: z.nativeEnum(SafetySignalSeverity),
  source: z.string().min(3).max(160),
  signalIds: z.array(z.string().min(1)).default([]),
  cascadeScope: z.array(
    z.object({
      originPrivilegeCode: z.string().min(3).max(80),
      dependencyType: z.union([
        z.nativeEnum(PrivilegeDependencyType),
        z.literal('CONFLICT'),
      ]),
      path: z.array(z.string().min(3).max(80)).min(1),
    }),
  )
    .optional()
    .transform((scope) => (scope && scope.length > 0 ? scope : undefined)),
  metadata: z.record(z.any()).optional(),
  effectiveAt: z.coerce.date().default(() => new Date()),
  resolvedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type PrivilegeSafetyStateRecord = z.infer<typeof PrivilegeSafetyStateSchema>;

export const CreatePrivilegeSafetyStateSchema = PrivilegeSafetyStateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  signalIds: z.array(z.string().min(1)).default([]),
});

export type CreatePrivilegeSafetyStateInput = z.infer<typeof CreatePrivilegeSafetyStateSchema>;

export function buildPrivilegeSafetyState(
  candidate: CreatePrivilegeSafetyStateInput,
): CreatePrivilegeSafetyStateInput {
  const normalized = CreatePrivilegeSafetyStateSchema.parse(candidate);
  return normalized;
}

export function mergeSignalIds(existing: string[] = [], next: string[] = []): string[] {
  const merged = new Set([...existing, ...next].filter(Boolean));
  return Array.from(merged);
}

export function appendCascadeScope(
  existing: CascadeScopeEntry[] | undefined,
  next: CascadeScopeEntry | CascadeScopeEntry[] | undefined,
): CascadeScopeEntry[] | undefined {
  if (!next || (Array.isArray(next) && next.length === 0)) {
    return existing;
  }
  const entries = Array.isArray(next) ? next : [next];
  const current = existing ?? [];
  return [...current, ...entries];
}

