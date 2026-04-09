import { ApplicationStatus } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { randomUUID } from 'crypto';

export async function logApplicationTransition(
  applicationId: string,
  from: ApplicationStatus | null,
  to: ApplicationStatus,
  actorId: string,
) {
  const now = new Date();

  // Insert audit log
  await prisma.auditEvent.create({
    data: {
      type: 'status_change',
      hash: randomUUID(),
      referenceId: applicationId,
      clinicianId: actorId, // or clerkUserId
      metadata: {
        entity_type: 'application',
        action: 'status_change',
        from,
        to,
        timestamp: now
      },
    },
  });

  // Append to timeline
  const app = await prisma.application.findUnique({
    where: { id: applicationId }
  });

  if (app) {
    const currentTimeline = Array.isArray(app.timeline) ? app.timeline : [];
    currentTimeline.push({
      event: to,
      at: now.toISOString()
    });

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        timeline: currentTimeline as any
      }
    });
  }
}
