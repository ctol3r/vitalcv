import { z } from 'zod';
import { PecosEnrollmentType } from './PECOSProvider.js';

export enum PecosLifecycleStatus {
  PENDING = 'PENDING',
  ENROLLED = 'ENROLLED',
  REVALIDATION_DUE = 'REVALIDATION_DUE',
  DEACTIVATED = 'DEACTIVATED',
}

export enum PecosStatusSource {
  CMS = 'CMS',
  SYSTEM = 'SYSTEM',
  MANUAL = 'MANUAL',
}

const dateLike = z.union([z.date(), z.string(), z.number()]);

export const PecosLifecycleEventSchema = z.object({
  status: z.nativeEnum(PecosLifecycleStatus),
  occurredAt: dateLike.transform((value) => coerceDate(value)),
  source: z.nativeEnum(PecosStatusSource).default(PecosStatusSource.CMS),
  note: z.string().max(500).optional(),
});

export const PecosLifecycleHistorySchema = z.array(PecosLifecycleEventSchema);

export const PecosEnrollmentSchema = z.object({
  clinicianId: z.string().min(1),
  enrollmentType: z.nativeEnum(PecosEnrollmentType),
  statuses: PecosLifecycleHistorySchema.min(1),
  lastCheckedAt: dateLike.nullish().transform((value) => toDate(value)),
  revalidationDueAt: dateLike.nullish().transform((value) => toDate(value)),
});

export type PecosLifecycleEvent = z.infer<typeof PecosLifecycleEventSchema>;
export type PecosLifecycleHistory = z.infer<typeof PecosLifecycleHistorySchema>;
export type PecosEnrollmentInput = z.infer<typeof PecosEnrollmentSchema>;

export function parsePecosEnrollment(data: unknown): PecosEnrollmentInput {
  return PecosEnrollmentSchema.parse(data);
}

export function toDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function coerceDate(value: unknown): Date {
  const result = toDate(value);
  if (!result) {
    throw new Error('Invalid date value for PECOS lifecycle event');
  }
  return result;
}

export function sortLifecycleHistory(history: PecosLifecycleHistory): PecosLifecycleHistory {
  return [...history].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

export function appendLifecycleEvent(
  history: PecosLifecycleHistory,
  event: PecosLifecycleEvent
): PecosLifecycleHistory {
  const normalized = sortLifecycleHistory(history);
  const existingIndex = normalized.findIndex(
    (entry) =>
      entry.status === event.status && entry.occurredAt.getTime() === event.occurredAt.getTime()
  );

  if (existingIndex >= 0) {
    normalized[existingIndex] = {
      ...normalized[existingIndex],
      source: event.source ?? normalized[existingIndex].source,
      note: event.note ?? normalized[existingIndex].note,
    };
    return normalized;
  }

  return sortLifecycleHistory([...normalized, event]);
}

export function getCurrentLifecycleStatus(
  history: PecosLifecycleHistory
): PecosLifecycleStatus | null {
  if (!history.length) return null;
  return sortLifecycleHistory(history).at(-1)?.status ?? null;
}
