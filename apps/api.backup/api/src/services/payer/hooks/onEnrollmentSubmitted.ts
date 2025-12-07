/**
 * B148B-HOOK-004: Hook: Notification on PayerEnrollmentLite submit (to clinician)
 * On submit, create notification for clinician with type='PAYER_ENROLLMENT_SUBMITTED'
 * and payload {payerName}; unit test verifies row created
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../events';

const prisma = new PrismaClient();

export interface EnrollmentSubmittedEvent {
  enrollmentId: string;
  clinicianDid: string;
  payerId: string;
  orgId?: string;
}

/**
 * Handle payer enrollment submission - notify clinician
 */
export async function onEnrollmentSubmitted(
  event: EnrollmentSubmittedEvent
): Promise<void> {
  try {
    // Fetch enrollment and payer details
    const enrollment = await prisma.payerEnrollment.findUnique({
      where: { id: event.enrollmentId },
      include: {
        payer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!enrollment) {
      console.error(
        `[onEnrollmentSubmitted] Enrollment not found: ${event.enrollmentId}`
      );
      return;
    }

    // Get clinician user ID (try to find user by DID)
    let clinicianUserId: string | undefined;

    try {
      const user = await prisma.user.findFirst({
        where: { did: event.clinicianDid },
        select: { id: true },
      });
      clinicianUserId = user?.id;
    } catch (error) {
      console.warn(
        `[onEnrollmentSubmitted] Could not fetch clinician user for DID: ${event.clinicianDid}`
      );
    }

    const notificationUserId = clinicianUserId || event.clinicianDid;

    await eventBus.publish('PayerSubmitted', {
      enrollmentId: event.enrollmentId,
      clinicianDid: event.clinicianDid,
      payerId: event.payerId,
      payerName: enrollment.payer.name,
      orgId: event.orgId || enrollment.orgId || undefined,
      notificationUserId,
    });

    console.log(
      `[onEnrollmentSubmitted] Published PayerSubmitted for enrollment ${event.enrollmentId}`
    );
  } catch (error) {
    console.error('[onEnrollmentSubmitted] Error:', error);
    // Don't throw - hooks should not fail the main operation
  }
}

