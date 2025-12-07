import { prisma } from '@/lib/prisma';

export interface DeploymentMatch {
  clinicianId: string;
  demandId: string;
  matchScore: number;
  reasons: string[];
}

/**
 * Match clinicians to demand spikes
 */
export async function matchCliniciansToDemand(
  demandId: string,
  specialty: string,
  region: string,
): Promise<DeploymentMatch[]> {
  // Query clinicians with matching specialty and region
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: {
      eventType: 'onboarded',
      metadata: {
        path: ['specialty'],
        equals: specialty,
      },
    },
    take: 50,
  });

  const matches: DeploymentMatch[] = [];

  for (const event of hiringEvents) {
    const clinicianId = event.clinicianId;
    const readiness = await calculateReadiness(clinicianId);
    const travelReadiness = await calculateTravelReadiness(clinicianId);

    const matchScore = (readiness + travelReadiness) / 2;

    if (matchScore > 0.7) {
      matches.push({
        clinicianId,
        demandId,
        matchScore,
        reasons: [
          `Readiness score: ${(readiness * 100).toFixed(0)}%`,
          `Travel readiness: ${(travelReadiness * 100).toFixed(0)}%`,
        ],
      });
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function calculateReadiness(clinicianId: string): Promise<number> {
  // Mock - would calculate based on credentials, licenses, etc.
  return 0.8;
}

async function calculateTravelReadiness(clinicianId: string): Promise<number> {
  // Mock - would check mobility passport, compact status, etc.
  return 0.75;
}

