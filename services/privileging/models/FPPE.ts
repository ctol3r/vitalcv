/**
 * S72-STRETCH-B-001: FPPE Record Model
 *
 * Model for tracking Focused Professional Practice Evaluation (FPPE) records.
 * FPPE is the initial evaluation period for newly granted privileges.
 * Status flow: OPEN -> COMPLETED / CANCELLED
 */

import { z } from 'zod';
import {
  FPPE_STATUS_VALUES,
  type FPPEStatus as FPPEStatusContract,
} from '@domain-common/qualityContracts';

/**
 * Valid FPPE record statuses
 */
export const FPPEStatus = FPPE_STATUS_VALUES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as Record<FPPEStatusContract, FPPEStatusContract>
);

type _FppeStatusContractCheck = FPPEStatusContract extends (typeof FPPE_STATUS_VALUES)[number] ? true : never;
export type FPPEStatusType = FPPEStatusContract;

/**
 * Schema for creating a new FPPE record
 */
export const CreateFPPERecordSchema = z.object({
  privilegeGrantedId: z.string().min(1, 'Privilege Granted ID is required'),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  status: z.enum(FPPE_STATUS_VALUES).default('OPEN'),
  notes: z.string().optional().nullable(),
});

export type CreateFPPERecordInput = z.infer<typeof CreateFPPERecordSchema>;

/**
 * Schema for updating an FPPE record
 */
export const UpdateFPPERecordSchema = z.object({
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional().nullable(),
  status: z.enum(FPPE_STATUS_VALUES).optional(),
  notes: z.string().optional().nullable(),
});

export type UpdateFPPERecordInput = z.infer<typeof UpdateFPPERecordSchema>;

/**
 * Schema for querying FPPE records
 */
export const QueryFPPERecordSchema = z.object({
  privilegeGrantedId: z.string().optional(),
  status: z.enum(FPPE_STATUS_VALUES).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type QueryFPPERecordInput = z.infer<typeof QueryFPPERecordSchema>;

/**
 * Serialize FPPE record for API response
 */
export function serializeFPPERecord(record: any) {
  return {
    id: record.id,
    privilegeGrantedId: record.privilegeGrantedId,
    startAt: record.startAt?.toISOString(),
    endAt: record.endAt?.toISOString() || null,
    status: record.status,
    notes: record.notes || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    // Include related data if available
    privilegeGranted: record.privilegeGranted ? {
      id: record.privilegeGranted.id,
      status: record.privilegeGranted.status,
      clinicianDid: record.privilegeGranted.clinicianDid,
      orgId: record.privilegeGranted.orgId,
    } : undefined,
  };
}

/**
 * Validate that an FPPE record can transition to a new status
 */
export function canTransitionFPPEStatus(
  currentStatus: FPPEStatusType,
  newStatus: FPPEStatusType
): { allowed: boolean; reason?: string } {
  // Status transition rules
  const transitions: Record<FPPEStatusType, FPPEStatusType[]> = {
    OPEN: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [], // Terminal state
    CANCELLED: [], // Terminal state
  };

  const allowedTransitions = transitions[currentStatus];

  if (allowedTransitions.includes(newStatus)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
  };
}

/**
 * Get human-readable status description
 */
export function getFPPEStatusDescription(status: FPPEStatusType): string {
  const descriptions: Record<FPPEStatusType, string> = {
    OPEN: 'FPPE evaluation in progress',
    COMPLETED: 'FPPE evaluation completed successfully',
    CANCELLED: 'FPPE evaluation cancelled',
  };

  return descriptions[status];
}

/**
 * Validate FPPE dates
 */
export function validateFPPEDates(startAt: Date, endAt?: Date | null): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const now = new Date();

  // Start date should not be in the future (allow small buffer for clock skew)
  if (startAt > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
    errors.push('Start date cannot be more than 24 hours in the future');
  }

  // If end date is provided, it should be after start date
  if (endAt) {
    if (endAt <= startAt) {
      errors.push('End date must be after start date');
    }

    // End date should not be more than 2 years after start (typical FPPE period)
    const maxEndDate = new Date(startAt);
    maxEndDate.setFullYear(maxEndDate.getFullYear() + 2);
    if (endAt > maxEndDate) {
      errors.push('End date cannot be more than 2 years after start date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

