/**
 * S72-STRETCH-B-002: OPPE Schedule Model
 *
 * Model for customizing Ongoing Professional Practice Evaluation (OPPE) review frequency.
 * Allows organizations to set custom review intervals per clinician (default 12 months).
 */

import { z } from 'zod';

/**
 * Schema for creating a new OPPE schedule
 */
export const CreateOPPEScheduleSchema = z.object({
  clinicianId: z.string().min(1, 'Clinician ID is required'),
  orgId: z.string().min(1, 'Organization ID is required'),
  frequencyMonths: z.number().int().positive().min(1).max(36).default(12),
  nextReviewAt: z.coerce.date().optional().nullable(),
});

export type CreateOPPEScheduleInput = z.infer<typeof CreateOPPEScheduleSchema>;

/**
 * Schema for updating an OPPE schedule
 */
export const UpdateOPPEScheduleSchema = z.object({
  frequencyMonths: z.number().int().positive().min(1).max(36).optional(),
  nextReviewAt: z.coerce.date().optional().nullable(),
});

export type UpdateOPPEScheduleInput = z.infer<typeof UpdateOPPEScheduleSchema>;

/**
 * Schema for querying OPPE schedules
 */
export const QueryOPPEScheduleSchema = z.object({
  clinicianId: z.string().optional(),
  orgId: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type QueryOPPEScheduleInput = z.infer<typeof QueryOPPEScheduleSchema>;

/**
 * Serialize OPPE schedule for API response
 */
export function serializeOPPESchedule(schedule: any) {
  return {
    id: schedule.id,
    clinicianId: schedule.clinicianId,
    orgId: schedule.orgId,
    frequencyMonths: schedule.frequencyMonths,
    nextReviewAt: schedule.nextReviewAt?.toISOString() || null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

/**
 * Calculate next review date based on frequency
 */
export function calculateNextReviewDate(
  lastReviewDate: Date,
  frequencyMonths: number
): Date {
  const nextDate = new Date(lastReviewDate);
  nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
  return nextDate;
}

/**
 * Check if OPPE review is due
 */
export function isOPPEReviewDue(nextReviewAt: Date | null | undefined): boolean {
  if (!nextReviewAt) {
    return false;
  }
  return new Date(nextReviewAt) <= new Date();
}

/**
 * Get days until next review
 */
export function getDaysUntilNextReview(nextReviewAt: Date | null | undefined): number | null {
  if (!nextReviewAt) {
    return null;
  }
  const now = new Date();
  const diffMs = nextReviewAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Validate frequency months
 */
export function validateFrequencyMonths(frequencyMonths: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (frequencyMonths < 1) {
    errors.push('Frequency must be at least 1 month');
  }

  if (frequencyMonths > 36) {
    errors.push('Frequency cannot exceed 36 months (3 years)');
  }

  // Common OPPE frequencies (informational)
  const commonFrequencies = [3, 6, 12, 18, 24];
  if (!commonFrequencies.includes(frequencyMonths)) {
    // Not an error, just a warning could be logged
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

