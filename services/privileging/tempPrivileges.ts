const log = getServiceLogger('privileging/tempPrivileges');
/**
 * B135A-PRIV-003: Temporary Privilege Rules
 *
 * Rules and validation for temporary/emergency privileges:
 * - Maximum duration: 120 days
 * - Requires emergency criteria justification
 * - Auto-expires on temporaryEndDate
 * - Status automatically reverts to EXPIRED
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export const MAX_TEMPORARY_DAYS = 120;

export interface TemporaryPrivilegeRequest {
  orgId: string;
  clinicianDid: string;
  privilegeSetId: string;
  emergencyReason: string;
  requestedDurationDays: number;
  evidenceIds?: string[];
  evidenceBundle?: any;
}

export interface TemporaryPrivilegeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate temporary privilege request
 */
export function validateTemporaryPrivilegeRequest(
  request: TemporaryPrivilegeRequest
): TemporaryPrivilegeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: Duration must not exceed 120 days
  if (request.requestedDurationDays > MAX_TEMPORARY_DAYS) {
    errors.push(`Requested duration (${request.requestedDurationDays} days) exceeds maximum allowed (${MAX_TEMPORARY_DAYS} days)`);
  }

  // Rule 2: Duration must be positive
  if (request.requestedDurationDays <= 0) {
    errors.push('Requested duration must be greater than 0 days');
  }

  // Rule 3: Emergency reason must be provided and non-empty
  if (!request.emergencyReason || request.emergencyReason.trim().length === 0) {
    errors.push('Emergency reason is required for temporary privileges');
  }

  // Rule 4: Emergency reason should be substantive (at least 20 characters)
  if (request.emergencyReason && request.emergencyReason.trim().length < 20) {
    warnings.push('Emergency reason should provide detailed justification (at least 20 characters)');
  }

  // Rule 5: Warn if duration is very long
  if (request.requestedDurationDays > 90) {
    warnings.push(`Duration of ${request.requestedDurationDays} days is close to maximum. Consider full privilege application if ongoing need.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate temporary privilege end date
 */
export function calculateTemporaryEndDate(startDate: Date, durationDays: number): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Math.min(durationDays, MAX_TEMPORARY_DAYS));
  return endDate;
}

/**
 * Check if temporary privileges should be expired
 * Called by scheduled job to auto-expire temporary privileges
 */
export async function expireOverdueTemporaryPrivileges(): Promise<number> {
  const now = new Date();

  // Find all active temporary privileges past their end date
  const result = await prisma.privilegeGranted.updateMany({
    where: {
      isTemporary: true,
      status: 'ACTIVE',
      temporaryEndDate: {
        lte: now
      }
    },
    data: {
      status: 'EXPIRED',
      updatedAt: now
    }
  });

  log.info(`[TempPrivileges] Expired ${result.count} temporary privileges`);

  return result.count;
}

/**
 * Get temporary privileges expiring soon (within days)
 */
export async function getExpiringTemporaryPrivileges(withinDays: number = 7): Promise<any[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + withinDays);

  const expiring = await prisma.privilegeGranted.findMany({
    where: {
      isTemporary: true,
      status: 'ACTIVE',
      temporaryEndDate: {
        gte: now,
        lte: futureDate
      }
    },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true
        }
      }
    },
    orderBy: {
      temporaryEndDate: 'asc'
    }
  });

  return expiring;
}

/**
 * Check for emergency criteria (can be extended based on organizational needs)
 */
export interface EmergencyCriteria {
  hospitalDisasterMode?: boolean;
  naturalDisaster?: boolean;
  pandemicEmergency?: boolean;
  criticalStaffShortage?: boolean;
  specificEmergencyType?: string;
}

export function validateEmergencyCriteria(
  emergencyReason: string,
  criteria?: EmergencyCriteria
): boolean {
  // If specific criteria provided, at least one must be true
  if (criteria) {
    const hasEmergencyCriteria =
      criteria.hospitalDisasterMode ||
      criteria.naturalDisaster ||
      criteria.pandemicEmergency ||
      criteria.criticalStaffShortage ||
      (criteria.specificEmergencyType && criteria.specificEmergencyType.length > 0);

    return hasEmergencyCriteria;
  }

  // Otherwise, just require non-empty reason
  return emergencyReason && emergencyReason.trim().length >= 20;
}

