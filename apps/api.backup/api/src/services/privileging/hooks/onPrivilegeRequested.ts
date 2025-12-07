/**
 * B148B-HOOK-001: Hook: create Notification on PrivilegeRequest creation (to OrgAdmin)
 * When clinician requests privileges, create notification for demo OrgAdmin user(s)
 * with type='PRIVILEGE_REQUESTED' and payload {clinicianName, privilegeSetName}
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../events';

const prisma = new PrismaClient();

export interface PrivilegeRequestedEvent {
  privilegeRequestId: string;
  orgId: string;
  clinicianDid: string;
  privilegeSetId: string;
}

/**
 * Handle privilege request creation - notify org admins
 */
export async function onPrivilegeRequested(
  event: PrivilegeRequestedEvent
): Promise<void> {
  try {
    // Fetch privilege request details
    const privilegeRequest = await prisma.privilegeRequest.findUnique({
      where: { id: event.privilegeRequestId },
      include: {
        privilegeSet: true,
      },
    });

    if (!privilegeRequest) {
      console.error(
        `[onPrivilegeRequested] Privilege request not found: ${event.privilegeRequestId}`
      );
      return;
    }

    // Get clinician name (try to find user by DID)
    let clinicianName: string | undefined;
    try {
      const user = await prisma.user.findFirst({
        where: { did: event.clinicianDid },
        select: { name: true },
      });
      clinicianName = user?.name;
    } catch (error) {
      console.warn(
        `[onPrivilegeRequested] Could not fetch clinician name for DID: ${event.clinicianDid}`
      );
    }

    await eventBus.publish('PrivilegeRequested', {
      privilegeRequestId: event.privilegeRequestId,
      orgId: event.orgId,
      clinicianDid: event.clinicianDid,
      privilegeSetId: event.privilegeSetId,
      privilegeSetName: privilegeRequest.privilegeSet.name,
      clinicianName,
    });

    console.log(
      `[onPrivilegeRequested] Published PrivilegeRequested for ${event.privilegeRequestId}`
    );
  } catch (error) {
    console.error('[onPrivilegeRequested] Error:', error);
    // Don't throw - hooks should not fail the main operation
  }
}

