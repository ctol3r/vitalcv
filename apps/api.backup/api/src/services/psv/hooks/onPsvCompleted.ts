/**
 * B148B-HOOK-005: Hook: Notification on PSV run completion (to clinician & org)
 * After runPsv(clinicianId), send notification to clinician ('PSV passed/failed')
 * and to org admin with summary result; uses isFresh + sanction flag
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../events';

const prisma = new PrismaClient();

export interface PsvCompletedEvent {
  clinicianId: string; // NPI or DID
  clinicianDid?: string;
  orgId?: string;
  isFresh: boolean; // Whether this is a fresh PSV run
  passed: boolean; // Whether PSV passed
  hasSanctions: boolean; // Whether sanctions were found
  summary?: Record<string, any>; // PSV summary results
}

/**
 * Handle PSV completion - notify clinician and org admin
 */
export async function onPsvCompleted(event: PsvCompletedEvent): Promise<void> {
  try {
    // Get clinician user ID and DID
    let clinicianUserId: string | undefined;
    let clinicianDid: string | undefined;

    try {
      // Try to find by DID first
      if (event.clinicianDid) {
        const userByDid = await prisma.user.findFirst({
          where: { did: event.clinicianDid },
          select: { id: true, did: true },
        });
        if (userByDid) {
          clinicianUserId = userByDid.id;
          clinicianDid = userByDid.did;
        }
      }

      // If not found, try to find by NPI claim
      if (!clinicianUserId) {
        const npiClaim = await prisma.npiClaim.findUnique({
          where: { npi: event.clinicianId },
          include: {
            user: {
              select: { id: true, did: true },
            },
          },
        });
        if (npiClaim) {
          clinicianUserId = npiClaim.user.id;
          clinicianDid = npiClaim.user.did || undefined;
        }
      }
    } catch (error) {
      console.warn(
        `[onPsvCompleted] Could not fetch clinician user for ID: ${event.clinicianId}`
      );
    }

    // Use provided DID or clinicianId as fallback
    const notificationUserId = clinicianUserId || event.clinicianDid || event.clinicianId;
    const finalClinicianDid = event.clinicianDid || clinicianDid;

    // Determine PSV status message
    const status = event.passed
      ? event.hasSanctions
        ? 'PSV_PASSED_WITH_WARNINGS'
        : 'PSV_PASSED'
      : 'PSV_FAILED';

    await eventBus.publish('PSVCompleted', {
      clinicianId: event.clinicianId,
      clinicianDid: finalClinicianDid,
      notificationUserId,
      orgId: event.orgId,
      isFresh: event.isFresh,
      passed: event.passed,
      hasSanctions: event.hasSanctions,
      summary: event.summary,
      status,
    });

    console.log(
      `[onPsvCompleted] Published PSVCompleted for clinician ${notificationUserId}`
    );
  } catch (error) {
    console.error('[onPsvCompleted] Error:', error);
    // Don't throw - hooks should not fail the main operation
  }
}

