/**
 * B148B-HOOK-003: Hook: Notification on Application created (to OrgAdmin)
 * When Application created, create notification for org admins with type='APPLICATION_SUBMITTED'
 * and payload {jobTitle, clinicianName? or id}
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../events';

const prisma = new PrismaClient();

export interface ApplicationCreatedEvent {
  applicationId: string;
  jobId: string;
  applicantDid: string;
  orgId?: string; // May be derived from job posting
}

/**
 * Handle application creation - notify org admins
 */
export async function onApplicationCreated(
  event: ApplicationCreatedEvent
): Promise<void> {
  try {
    // Fetch application and job details
    const application = await prisma.application.findUnique({
      where: { id: event.applicationId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            partnerId: true,
          },
        },
      },
    });

    if (!application) {
      console.error(
        `[onApplicationCreated] Application not found: ${event.applicationId}`
      );
      return;
    }

    // Get org ID from job posting's partnerId or use provided orgId
    const orgId = event.orgId || application.job.partnerId;

    if (!orgId) {
      console.warn(
        `[onApplicationCreated] No orgId found for application: ${event.applicationId}`
      );
      return;
    }

    // Get clinician name (try to find user by DID)
    let clinicianName: string | undefined;
    try {
      const user = await prisma.user.findFirst({
        where: { did: event.applicantDid },
        select: { name: true },
      });
      clinicianName = user?.name;
    } catch (error) {
      console.warn(
        `[onApplicationCreated] Could not fetch clinician name for DID: ${event.applicantDid}`
      );
    }

    await eventBus.publish('ApplicationSubmitted', {
      applicationId: event.applicationId,
      jobId: event.jobId,
      orgId,
      applicantDid: event.applicantDid,
      applicantName: clinicianName,
      jobTitle: application.job.title,
    });

    console.log(
      `[onApplicationCreated] Published ApplicationSubmitted for ${event.applicationId}`
    );
  } catch (error) {
    console.error('[onApplicationCreated] Error:', error);
    // Don't throw - hooks should not fail the main operation
  }
}

