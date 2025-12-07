const log = getServiceLogger('payer/pecosPoller');
/**
 * S72-STRETCH-C-001: PECOS status polling stub with realistic status codes
 *
 * Polls fake PECOS API; status ∈ {PENDING, APPROVED, DENIED, REVALIDATION_DUE};
 * updates PayerEnrollmentLite; logs changes.
 */

import { PrismaClient } from '@prisma/client';
import { getPecosStatus, type PecosEnrollmentStatus } from './pecosClient.js';
import {
import { getServiceLogger } from '../logging/serviceLogger';
  logEvidenceEvent,
  EvidenceEventType,
  EvidenceSource,
  EvidenceResult,
} from '../audit/payerEnrollmentEvents.js';

const prisma = new PrismaClient();

export interface PecosPollResult {
  enrollmentId: string;
  success: boolean;
  statusChanged: boolean;
  oldStatus: string | null;
  newStatus: string | null;
  error?: string;
  lastCheckedAt: Date;
}

export interface PecosPollOptions {
  enrollmentId?: string;
  npi?: string;
  forcePoll?: boolean; // Force poll even if recently checked
}

/**
 * Polls PECOS API for enrollment status and updates PayerEnrollment record
 *
 * @param options - Poll options (enrollmentId or npi)
 * @returns Poll result with status change information
 */
export async function pollPecosStatus(
  options: PecosPollOptions
): Promise<PecosPollResult> {
  const { enrollmentId, npi, forcePoll = false } = options;

  if (!enrollmentId && !npi) {
    return {
      enrollmentId: '',
      success: false,
      statusChanged: false,
      oldStatus: null,
      newStatus: null,
      error: 'Either enrollmentId or npi is required',
      lastCheckedAt: new Date(),
    };
  }

  try {
    // Find enrollment record
    const enrollment = await prisma.payerEnrollment.findFirst({
      where: enrollmentId
        ? { id: enrollmentId }
        : {
            // If only NPI provided, we'd need to join with clinician/NPI mapping
            // For now, assume enrollmentId is provided
            id: enrollmentId || '',
          },
      include: {
        payer: {
          select: {
            id: true,
            payerId: true,
            name: true,
            requiresPecos: true,
          },
        },
      },
    });

    if (!enrollment) {
      return {
        enrollmentId: enrollmentId || '',
        success: false,
        statusChanged: false,
        oldStatus: null,
        newStatus: null,
        error: 'Enrollment not found',
        lastCheckedAt: new Date(),
      };
    }

    // Skip if recently checked (within last hour) unless forcePoll
    if (!forcePoll && enrollment.lastCheckedAt) {
      const hoursSinceCheck =
        (Date.now() - enrollment.lastCheckedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCheck < 1) {
        return {
          enrollmentId: enrollment.id,
          success: true,
          statusChanged: false,
          oldStatus: enrollment.pecosStatus || null,
          newStatus: enrollment.pecosStatus || null,
          lastCheckedAt: enrollment.lastCheckedAt,
        };
      }
    }

    // Poll PECOS API
    const pecosResult = await getPecosStatus({
      enrollmentId: enrollment.pecosEnrollmentId || undefined,
      npi: npi || undefined,
    });

    if (!pecosResult.success || !pecosResult.status) {
      return {
        enrollmentId: enrollment.id,
        success: false,
        statusChanged: false,
        oldStatus: enrollment.pecosStatus || null,
        newStatus: enrollment.pecosStatus || null,
        error: pecosResult.error || 'PECOS API error',
        lastCheckedAt: new Date(),
      };
    }

    const pecosStatus = pecosResult.status;
    const oldStatus = enrollment.pecosStatus;
    const newStatus = mapPecosStatusToEnrollmentStatus(pecosStatus.status);

    // Check if status changed
    const statusChanged = oldStatus !== newStatus;

    // Update enrollment record
    const updateData: any = {
      lastCheckedAt: new Date(),
      pecosStatus: newStatus,
    };

    // Update pecosEnrollmentId if not set
    if (!enrollment.pecosEnrollmentId && pecosStatus.pecosEnrollmentId) {
      updateData.pecosEnrollmentId = pecosStatus.pecosEnrollmentId;
    }

    // Update revalidationDueAt if provided
    if (pecosStatus.revalidationDueDate) {
      updateData.revalidationDueAt = new Date(pecosStatus.revalidationDueDate);
    }

    // Update enrollment status if PECOS status changed
    if (statusChanged) {
      // Map PECOS status to enrollment status
      if (newStatus === 'APPROVED' && enrollment.status === 'SUBMITTED') {
        updateData.status = 'APPROVED';
        updateData.approvedAt = new Date();
      } else if (newStatus === 'DENIED' && enrollment.status === 'SUBMITTED') {
        updateData.status = 'DENIED';
      } else if (newStatus === 'REVALIDATION_DUE' && enrollment.status === 'APPROVED') {
        // Keep APPROVED but note revalidation is due
        // Status remains APPROVED but metadata will show revalidation needed
      }
    }

    await prisma.payerEnrollment.update({
      where: { id: enrollment.id },
      data: updateData,
    });

    // Log status change event
    if (statusChanged) {
      await logEvidenceEvent({
        enrollmentId: enrollment.id,
        eventType: EvidenceEventType.PECOS_CHECK,
        source: EvidenceSource.PECOS,
        result:
          newStatus === 'APPROVED'
            ? EvidenceResult.PASS
            : newStatus === 'DENIED'
              ? EvidenceResult.FAIL
              : EvidenceResult.WARNING,
        metadata: {
          oldStatus,
          newStatus,
          pecosEnrollmentId: pecosStatus.pecosEnrollmentId,
          enrollmentType: pecosStatus.enrollmentType,
          revalidationDueDate: pecosStatus.revalidationDueDate,
          effectiveDate: pecosStatus.effectiveDate,
          expirationDate: pecosStatus.expirationDate,
        },
      });

      log.info(
        `[PecosPoller] Status changed for enrollment ${enrollment.id}: ${oldStatus} → ${newStatus}`
      );
    } else {
      // Log regular check (no change)
      await logEvidenceEvent({
        enrollmentId: enrollment.id,
        eventType: EvidenceEventType.PECOS_CHECK,
        source: EvidenceSource.PECOS,
        result: newStatus === 'APPROVED' ? EvidenceResult.PASS : EvidenceResult.WARNING,
        metadata: {
          status: newStatus,
          pecosEnrollmentId: pecosStatus.pecosEnrollmentId,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    return {
      enrollmentId: enrollment.id,
      success: true,
      statusChanged,
      oldStatus,
      newStatus,
      lastCheckedAt: new Date(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`[PecosPoller] Error polling PECOS status: ${errorMsg}`);
    return {
      enrollmentId: enrollmentId || '',
      success: false,
      statusChanged: false,
      oldStatus: null,
      newStatus: null,
      error: errorMsg,
      lastCheckedAt: new Date(),
    };
  }
}

/**
 * Maps PECOS status to enrollment status string
 *
 * @param pecosStatus - PECOS status from API
 * @returns Enrollment status string
 */
function mapPecosStatusToEnrollmentStatus(
  pecosStatus: PecosEnrollmentStatus['status']
): string {
  switch (pecosStatus) {
    case 'APPROVED':
      return 'APPROVED';
    case 'DENIED':
      return 'DENIED';
    case 'REVALIDATION_DUE':
      return 'REVALIDATION_DUE';
    case 'PENDING':
    case 'IN_REVIEW':
      return 'PENDING';
    case 'REVOKED':
    case 'DEACTIVATED':
      return 'DENIED';
    default:
      return 'PENDING';
  }
}

/**
 * Polls PECOS status for multiple enrollments
 *
 * @param enrollmentIds - Array of enrollment IDs to poll
 * @returns Array of poll results
 */
export async function pollPecosStatusBatch(
  enrollmentIds: string[]
): Promise<PecosPollResult[]> {
  const results = await Promise.all(
    enrollmentIds.map((id) => pollPecosStatus({ enrollmentId: id }))
  );
  return results;
}

/**
 * Polls all enrollments that require PECOS and haven't been checked recently
 *
 * @param maxEnrollments - Maximum number of enrollments to poll (default: 100)
 * @returns Summary of polling results
 */
export async function pollAllPecosEnrollments(
  maxEnrollments: number = 100
): Promise<{
  success: boolean;
  totalPolled: number;
  statusChanged: number;
  errors: number;
  results: PecosPollResult[];
}> {
  try {
    // Find enrollments that require PECOS and haven't been checked in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const enrollments = await prisma.payerEnrollment.findMany({
      where: {
        payer: {
          requiresPecos: true,
        },
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: oneHourAgo } },
        ],
        status: {
          in: ['SUBMITTED', 'APPROVED'],
        },
      },
      take: maxEnrollments,
      select: {
        id: true,
        pecosEnrollmentId: true,
      },
    });

    log.info(`[PecosPoller] Polling ${enrollments.length} enrollments...`);

    const results = await pollPecosStatusBatch(enrollments.map((e) => e.id));

    const statusChanged = results.filter((r) => r.statusChanged).length;
    const errors = results.filter((r) => !r.success).length;

    log.info(
      `[PecosPoller] Completed: ${results.length} polled, ${statusChanged} changed, ${errors} errors`
    );

    return {
      success: errors === 0,
      totalPolled: results.length,
      statusChanged,
      errors,
      results,
    };
  } catch (error) {
    log.error(`[PecosPoller] Batch polling error: ${error}`);
    return {
      success: false,
      totalPolled: 0,
      statusChanged: 0,
      errors: 1,
      results: [],
    };
  }
}

