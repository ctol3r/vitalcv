/**
 * B148B-HOOK-002: Hook: Notification+email when PrivilegeRequest approved/denied
 * On approve/deny, create notification for clinician & enqueueEmail(toClinician,'privilege_review',payload);
 * stub email sender logs message
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../events';

const prisma = new PrismaClient();

export interface PrivilegeReviewedEvent {
  privilegeRequestId: string;
  orgId: string;
  clinicianDid: string;
  status: 'APPROVED' | 'DENIED';
  privilegeSetName: string;
  reviewerDid?: string;
  reviewNotes?: string;
}

/**
 * Handle privilege request review - notify clinician and send email
 */
export async function onPrivilegeReviewed(
  event: PrivilegeReviewedEvent
): Promise<void> {
  try {
    // Get clinician user ID (try to find user by DID)
    let clinicianUserId: string | undefined;
    let clinicianEmail: string | undefined;

    try {
      const user = await prisma.user.findFirst({
        where: { did: event.clinicianDid },
        select: { id: true, email: true },
      });
      clinicianUserId = user?.id;
      clinicianEmail = user?.email;
    } catch (error) {
      console.warn(
        `[onPrivilegeReviewed] Could not fetch clinician user for DID: ${event.clinicianDid}`
      );
    }

    const eventPayload = {
      privilegeRequestId: event.privilegeRequestId,
      orgId: event.orgId,
      clinicianDid: event.clinicianDid,
      privilegeSetName: event.privilegeSetName,
      reviewerDid: event.reviewerDid,
      reviewNotes: event.reviewNotes,
      clinicianUserId,
      clinicianEmail,
    };

    if (event.status === 'APPROVED') {
      await eventBus.publish('PrivilegeApproved', {
        ...eventPayload,
        status: 'APPROVED',
      });
    } else {
      await eventBus.publish('PrivilegeDenied', {
        ...eventPayload,
        status: 'DENIED',
      });
    }

    console.log(
      `[onPrivilegeReviewed] Published ${event.status} for ${event.privilegeRequestId}`
    );
  } catch (error) {
    console.error('[onPrivilegeReviewed] Error:', error);
    // Don't throw - hooks should not fail the main operation
  }
}

