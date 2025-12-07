import { prisma } from '@/lib/prisma';
import type { HarmonizedSanction } from './harmonization';

export interface PropagationTarget {
  orgId: string;
  orgName: string;
  notificationMethod: 'instant' | 'batch' | 'webhook';
}

/**
 * Propagate sanctions to connected employers instantly
 */
export async function propagateSanctionsToOrgs(
  clinicianId: string,
  sanctions: HarmonizedSanction[],
): Promise<PropagationTarget[]> {
  const targets: PropagationTarget[] = [];

  // Find all organizations where clinician is employed or has privileges
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: {
      clinicianId,
      eventType: { in: ['onboarded', 'privileged'] },
    },
    select: {
      employerId: true,
      metadata: true,
    },
    distinct: ['employerId'],
  });

  for (const event of hiringEvents) {
    const orgId = event.employerId;
    const orgName = (event.metadata?.orgName as string) ?? 'Unknown Organization';

    // Send notification (mock - would integrate with notification service)
    await notifyOrganization(orgId, clinicianId, sanctions);

    targets.push({
      orgId,
      orgName,
      notificationMethod: 'instant',
    });
  }

  return targets;
}

async function notifyOrganization(
  orgId: string,
  clinicianId: string,
  sanctions: HarmonizedSanction[],
): Promise<void> {
  // Mock implementation - would send webhook, email, or push notification
  console.log(`[safety-exchange] Notifying org ${orgId} about sanctions for clinician ${clinicianId}`);
}

