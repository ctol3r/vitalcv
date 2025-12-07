import { z } from 'zod';

export const EHR_SYSTEMS = ['epic', 'cerner', 'meditech'] as const;
export type EhrSystemType = (typeof EHR_SYSTEMS)[number];

export const EhrSynchronizationStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;

export type EhrSynchronizationStatusType = (typeof EhrSynchronizationStatus)[keyof typeof EhrSynchronizationStatus];

export const EhrSynchronizationSchema = z.object({
  id: z.string().cuid(),
  clinicianId: z.string().min(1, 'clinicianId is required'),
  privilegeCode: z.string().min(1, 'privilegeCode is required'),
  ehrSystem: z.enum(EHR_SYSTEMS),
  status: z.enum([
    EhrSynchronizationStatus.PENDING,
    EhrSynchronizationStatus.SYNCED,
    EhrSynchronizationStatus.FAILED,
    EhrSynchronizationStatus.RETRYING,
  ]),
  attemptCount: z.number().int().nonnegative().default(0),
  lastAttemptAt: z.date().optional().nullable(),
  error: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EhrSynchronizationRecord = z.infer<typeof EhrSynchronizationSchema>;

export const CreateEhrSynchronizationSchema = EhrSynchronizationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  attemptCount: true,
  status: true,
}).extend({
  status: z
    .enum([EhrSynchronizationStatus.PENDING, EhrSynchronizationStatus.RETRYING])
    .default(EhrSynchronizationStatus.PENDING),
  attemptCount: z.number().int().nonnegative().default(0),
});

export type CreateEhrSynchronizationInput = z.infer<typeof CreateEhrSynchronizationSchema>;

export const UpdateEhrSynchronizationSchema = EhrSynchronizationSchema.pick({
  status: true,
  error: true,
  metadata: true,
}).extend({
  lastAttemptAt: z.date().optional(),
  attemptCount: z.number().int().nonnegative().optional(),
});

export type UpdateEhrSynchronizationInput = z.infer<typeof UpdateEhrSynchronizationSchema>;

const statusTransitions: Record<EhrSynchronizationStatusType, EhrSynchronizationStatusType[]> = {
  [EhrSynchronizationStatus.PENDING]: [
    EhrSynchronizationStatus.RETRYING,
    EhrSynchronizationStatus.SYNCED,
    EhrSynchronizationStatus.FAILED,
  ],
  [EhrSynchronizationStatus.RETRYING]: [
    EhrSynchronizationStatus.RETRYING,
    EhrSynchronizationStatus.SYNCED,
    EhrSynchronizationStatus.FAILED,
  ],
  [EhrSynchronizationStatus.FAILED]: [EhrSynchronizationStatus.RETRYING],
  [EhrSynchronizationStatus.SYNCED]: [],
};

export function canTransitionSynchronizationStatus(
  current: EhrSynchronizationStatusType,
  next: EhrSynchronizationStatusType
): { allowed: boolean; reason?: string } {
  const allowedNext = statusTransitions[current] ?? [];
  if (allowedNext.includes(next)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot transition EHRSynchronization from ${current} to ${next}`,
  };
}

export const DEFAULT_BACKOFF_BASE_MS = 1000;
export const DEFAULT_BACKOFF_MAX_MS = 5 * 60 * 1000;

export function calculateBackoffDelayMs(
  attemptCount: number,
  { baseMs = DEFAULT_BACKOFF_BASE_MS, maxMs = DEFAULT_BACKOFF_MAX_MS }: { baseMs?: number; maxMs?: number } = {}
): number {
  const safeAttempt = Math.max(0, attemptCount);
  const delay = baseMs * 2 ** safeAttempt;
  return Math.min(delay, maxMs);
}

export function shouldRetrySynchronization(
  record: Pick<EhrSynchronizationRecord, 'status' | 'attemptCount'>,
  maxAttempts: number
): boolean {
  if (record.status === EhrSynchronizationStatus.SYNCED) {
    return false;
  }
  if (record.status === EhrSynchronizationStatus.FAILED && record.attemptCount >= maxAttempts) {
    return false;
  }
  return record.attemptCount < maxAttempts;
}

export function serializeEhrSynchronization(record: EhrSynchronizationRecord) {
  return {
    id: record.id,
    clinicianId: record.clinicianId,
    privilegeCode: record.privilegeCode,
    ehrSystem: record.ehrSystem,
    status: record.status,
    attemptCount: record.attemptCount,
    lastAttemptAt: record.lastAttemptAt?.toISOString(),
    error: record.error ?? undefined,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * B189B-EHR-006: EHRSynchronization domain model
 *
 * Tracks outbound privilege sync attempts to downstream EHRs (Epic, Cerner, Meditech).
 * Provides validation schemas, status helpers, and retry/backoff utilities used by the worker.
 */

import { z } from 'zod';

export const EHR_SYSTEMS = ['epic', 'cerner', 'meditech'] as const;
export type EhrSystemType = (typeof EHR_SYSTEMS)[number];

export const EhrSynchronizationStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;

export type EhrSynchronizationStatusType = (typeof EhrSynchronizationStatus)[keyof typeof EhrSynchronizationStatus];

export const EhrSynchronizationSchema = z.object({
  id: z.string().cuid(),
  clinicianId: z.string().min(1, 'clinicianId is required'),
  privilegeCode: z.string().min(1, 'privilegeCode is required'),
  ehrSystem: z.enum(EHR_SYSTEMS),
  status: z.enum([
    EhrSynchronizationStatus.PENDING,
    EhrSynchronizationStatus.SYNCED,
    EhrSynchronizationStatus.FAILED,
    EhrSynchronizationStatus.RETRYING,
  ]),
  attemptCount: z.number().int().nonnegative().default(0),
  lastAttemptAt: z.date().optional().nullable(),
  error: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EhrSynchronizationRecord = z.infer<typeof EhrSynchronizationSchema>;

export const CreateEhrSynchronizationSchema = EhrSynchronizationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  attemptCount: true,
  status: true,
}).extend({
  status: z
    .enum([
      EhrSynchronizationStatus.PENDING,
      EhrSynchronizationStatus.RETRYING,
    ])
    .default(EhrSynchronizationStatus.PENDING),
  attemptCount: z.number().int().nonnegative().default(0),
});

export type CreateEhrSynchronizationInput = z.infer<typeof CreateEhrSynchronizationSchema>;

export const UpdateEhrSynchronizationSchema = EhrSynchronizationSchema.pick({
  status: true,
  error: true,
  metadata: true,
}).extend({
  lastAttemptAt: z.date().optional(),
  attemptCount: z.number().int().nonnegative().optional(),
});

export type UpdateEhrSynchronizationInput = z.infer<typeof UpdateEhrSynchronizationSchema>;

const statusTransitions: Record<EhrSynchronizationStatusType, EhrSynchronizationStatusType[]> = {
  [EhrSynchronizationStatus.PENDING]: [
    EhrSynchronizationStatus.RETRYING,
    EhrSynchronizationStatus.SYNCED,
    EhrSynchronizationStatus.FAILED,
  ],
  [EhrSynchronizationStatus.RETRYING]: [
    EhrSynchronizationStatus.RETRYING,
    EhrSynchronizationStatus.SYNCED,
    EhrSynchronizationStatus.FAILED,
  ],
  [EhrSynchronizationStatus.FAILED]: [EhrSynchronizationStatus.RETRYING],
  [EhrSynchronizationStatus.SYNCED]: [],
};

export function canTransitionSynchronizationStatus(
  current: EhrSynchronizationStatusType,
  next: EhrSynchronizationStatusType
): { allowed: boolean; reason?: string } {
  const allowedNext = statusTransitions[current] ?? [];
  if (allowedNext.includes(next)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot transition EHRSynchronization from ${current} to ${next}`,
  };
}

export const DEFAULT_BACKOFF_BASE_MS = 1000;
export const DEFAULT_BACKOFF_MAX_MS = 5 * 60 * 1000; // 5 minutes

export function calculateBackoffDelayMs(
  attemptCount: number,
  { baseMs = DEFAULT_BACKOFF_BASE_MS, maxMs = DEFAULT_BACKOFF_MAX_MS }: { baseMs?: number; maxMs?: number } = {}
): number {
  const safeAttempt = Math.max(0, attemptCount);
  const delay = baseMs * 2 ** safeAttempt;
  return Math.min(delay, maxMs);
}

export function shouldRetrySynchronization(
  record: Pick<EhrSynchronizationRecord, 'status' | 'attemptCount'>,
  maxAttempts: number
): boolean {
  if (record.status === EhrSynchronizationStatus.SYNCED) {
    return false;
  }
  if (record.status === EhrSynchronizationStatus.FAILED && record.attemptCount >= maxAttempts) {
    return false;
  }
  return record.attemptCount < maxAttempts;
}

export function serializeEhrSynchronization(record: EhrSynchronizationRecord) {
  return {
    id: record.id,
    clinicianId: record.clinicianId,
    privilegeCode: record.privilegeCode,
    ehrSystem: record.ehrSystem,
    status: record.status,
    attemptCount: record.attemptCount,
    lastAttemptAt: record.lastAttemptAt?.toISOString(),
    error: record.error ?? undefined,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}


