/**
 * B170C-OPPE-001: OPPEScheduleV2 model
 *
 * Adds metrics-aware scheduling for OPPE reviews so downstream jobs can
 * generate OPPECase rows and analytics dashboards.
 */

import { z } from 'zod';

export const MetricsConfigSchema = z
  .record(z.number().nonnegative(), {
    required_error: 'metricsConfig must be numeric key-value pairs',
  })
  .default({});

export const CreateOPPEScheduleV2Schema = z.object({
  clinicianId: z.string().min(1, 'Clinician ID is required'),
  orgId: z.string().min(1, 'Organization ID is required'),
  frequencyMonths: z.number().int().min(1).max(36).default(12),
  nextDueAt: z.coerce.date().optional(),
  metricsConfig: MetricsConfigSchema.optional(),
});

export type CreateOPPEScheduleV2Input = z.infer<typeof CreateOPPEScheduleV2Schema>;

export const UpdateOPPEScheduleV2Schema = z.object({
  frequencyMonths: z.number().int().min(1).max(36).optional(),
  nextDueAt: z.coerce.date().optional().nullable(),
  metricsConfig: MetricsConfigSchema.optional(),
});

export type UpdateOPPEScheduleV2Input = z.infer<typeof UpdateOPPEScheduleV2Schema>;

export function serializeOPPEScheduleV2(schedule: any) {
  return {
    id: schedule.id,
    clinicianId: schedule.clinicianId,
    orgId: schedule.orgId,
    frequencyMonths: schedule.frequencyMonths,
    nextDueAt: schedule.nextDueAt ? new Date(schedule.nextDueAt).toISOString() : null,
    metricsConfig: normalizeMetricsConfig(schedule.metricsConfig),
    lastCaseGeneratedAt: schedule.lastCaseGeneratedAt
      ? new Date(schedule.lastCaseGeneratedAt).toISOString()
      : null,
    createdAt: schedule.createdAt?.toISOString?.() ?? new Date(schedule.createdAt).toISOString(),
    updatedAt: schedule.updatedAt?.toISOString?.() ?? new Date(schedule.updatedAt).toISOString(),
  };
}

export function calculateNextDueAt(referenceDate: Date, frequencyMonths: number): Date {
  const base = new Date(referenceDate);
  const next = new Date(base);
  next.setMonth(next.getMonth() + frequencyMonths);
  return next;
}

export function getEvaluationWindow(
  nextDueAt: Date,
  frequencyMonths: number
): { periodEnd: Date; periodStart: Date } {
  const periodEnd = new Date(nextDueAt);
  const periodStart = new Date(nextDueAt);
  periodStart.setMonth(periodStart.getMonth() - frequencyMonths);
  return { periodEnd, periodStart };
}

export function isScheduleDue(
  schedule: { nextDueAt?: Date | string | null },
  asOf = new Date()
): boolean {
  if (!schedule.nextDueAt) return false;
  const due = new Date(schedule.nextDueAt);
  return due.getTime() <= asOf.getTime();
}

export function normalizeMetricsConfig(config: unknown): Record<string, number> {
  if (!config || typeof config !== 'object') {
    return {};
  }

  return Object.entries(config as Record<string, unknown>).reduce<Record<string, number>>(
    (acc, [key, value]) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        return acc;
      }
      acc[key] = numericValue;
      return acc;
    },
    {}
  );
}

export function mergeMetricsConfig(
  current: Record<string, number> | undefined,
  updates: Record<string, number> | undefined
): Record<string, number> {
  const base = normalizeMetricsConfig(current);
  const override = normalizeMetricsConfig(updates);
  return { ...base, ...override };
}
