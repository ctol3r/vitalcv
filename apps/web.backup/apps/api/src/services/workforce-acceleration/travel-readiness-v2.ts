import { prisma } from '@/lib/prisma';

export interface TravelReadinessScore {
  clinicianId: string;
  score: number;
  factors: {
    mobilityPassport: number;
    privileges: number;
    activeLicenses: number;
  };
  readyStates: string[];
}

/**
 * Clinician travel-readiness score v2 - incorporates mobility passport, privileges, active licenses
 */
export async function calculateTravelReadinessV2(
  clinicianId: string,
): Promise<TravelReadinessScore> {
  // Check mobility passport
  const mobilityPassport = await prisma.mobilityPassport.findUnique({
    where: { clinicianId },
  });

  const mobilityScore = mobilityPassport ? 0.4 : 0.1;

  // Check privileges
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId, eventType: 'privileged' },
  });

  const privilegesScore = Math.min(0.3, hiringEvents.length * 0.1);

  // Check active licenses (mock - would query actual licenses)
  const activeLicensesScore = 0.3; // Assume active

  const totalScore = mobilityScore + privilegesScore + activeLicensesScore;
  const readyStates = mobilityPassport?.statesEligible ?? [];

  return {
    clinicianId,
    score: totalScore,
    factors: {
      mobilityPassport: mobilityScore,
      privileges: privilegesScore,
      activeLicenses: activeLicensesScore,
    },
    readyStates,
  };
}

