import { matchCliniciansToDemand } from './deployment';
import { calculateTravelReadinessV2 } from './travel-readiness-v2';

export interface SurgeMatch {
  clinicianId: string;
  demandId: string;
  matchScore: number;
  estimatedArrival: string;
  ready: boolean;
}

/**
 * Instant-match for emergency needs
 */
export async function autoMatchSurgeStaffing(
  demandId: string,
  specialty: string,
  region: string,
  urgency: 'low' | 'medium' | 'high' | 'critical',
): Promise<SurgeMatch[]> {
  const matches = await matchCliniciansToDemand(demandId, specialty, region);

  const surgeMatches: SurgeMatch[] = [];

  for (const match of matches) {
    const travelReadiness = await calculateTravelReadinessV2(match.clinicianId);

    // High urgency requires high travel readiness
    const ready =
      urgency === 'critical'
        ? travelReadiness.score > 0.8
        : urgency === 'high'
          ? travelReadiness.score > 0.7
          : travelReadiness.score > 0.6;

    if (ready) {
      // Estimate arrival time based on travel readiness
      const estimatedArrival = new Date();
      estimatedArrival.setHours(estimatedArrival.getHours() + (urgency === 'critical' ? 24 : 48));

      surgeMatches.push({
        clinicianId: match.clinicianId,
        demandId: match.demandId,
        matchScore: match.matchScore,
        estimatedArrival: estimatedArrival.toISOString(),
        ready: true,
      });
    }
  }

  return surgeMatches.sort((a, b) => b.matchScore - a.matchScore);
}

