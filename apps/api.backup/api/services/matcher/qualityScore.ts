const log = getServiceLogger('matcher/qualityScore');
/**
 * B145B-AN-002: Match quality score computation
 *
 * Computes match quality scores for job-clinician pairings based on:
 * 1. Distance (geographic proximity)
 * 2. Specialty fit (taxonomy matching)
 * 3. Compact eligibility (multi-state license compacts)
 *
 * Score formula:
 *   Quality Score = (distance_score * 0.3) + (specialty_score * 0.5) + (compact_score * 0.2)
 *
 * Where:
 * - distance_score: 0-100, higher for closer proximity
 * - specialty_score: 0-100, based on specialty match precision
 * - compact_score: 0-100, based on license compact eligibility
 *
 * The service logs feature contributions for model training and analytics.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

// Weight configuration for score components
export const SCORE_WEIGHTS = {
  DISTANCE: 0.3,
  SPECIALTY: 0.5,
  COMPACT: 0.2,
};

// Distance tiers (in miles)
const DISTANCE_TIERS = {
  LOCAL: { max: 25, score: 100 },
  REGIONAL: { max: 100, score: 80 },
  MULTI_STATE: { max: 500, score: 50 },
  NATIONAL: { max: Infinity, score: 20 },
  TELEHEALTH: { score: 100 }, // Remote work gets max distance score
};

export interface ClinicianProfile {
  did: string;
  npi?: string;
  specialty: string;
  licenseStates: string[];
  homeLocation?: {
    lat: number;
    lng: number;
    state: string;
  };
  compacts?: {
    imlc?: boolean;
    psypact?: boolean;
    counselingCompact?: boolean;
  };
}

export interface JobRequirements {
  jobId: string;
  specialty: string;
  requiredStates: string[];
  location?: {
    lat: number;
    lng: number;
    state: string;
    city?: string;
  };
  modality: 'in-person' | 'telehealth' | 'hybrid';
  compacts?: {
    imlcAllowed?: boolean;
    psypactAllowed?: boolean;
    counselingCompactAllowed?: boolean;
  };
}

export interface QualityScore {
  overallScore: number;
  distanceScore: number;
  specialtyScore: number;
  compactScore: number;
  features: {
    distanceMiles?: number;
    specialtyMatch: string;
    compactEligibility: string[];
    licenseStateMatch: boolean;
  };
  breakdown: {
    distance: {
      value: number;
      weight: number;
      contribution: number;
    };
    specialty: {
      value: number;
      weight: number;
      contribution: number;
    };
    compact: {
      value: number;
      weight: number;
      contribution: number;
    };
  };
}

/**
 * Calculate Haversine distance between two coordinates
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Compute distance score (0-100)
 */
export function computeDistanceScore(
  clinician: ClinicianProfile,
  job: JobRequirements
): { score: number; distanceMiles?: number } {
  // Telehealth jobs get maximum distance score
  if (job.modality === 'telehealth') {
    return { score: DISTANCE_TIERS.TELEHEALTH.score };
  }

  // If either location is missing, use neutral score
  if (!clinician.homeLocation || !job.location) {
    return { score: 50 }; // Neutral score when location is unknown
  }

  const distanceMiles = calculateDistance(
    clinician.homeLocation.lat,
    clinician.homeLocation.lng,
    job.location.lat,
    job.location.lng
  );

  let score: number;
  if (distanceMiles <= DISTANCE_TIERS.LOCAL.max) {
    score = DISTANCE_TIERS.LOCAL.score;
  } else if (distanceMiles <= DISTANCE_TIERS.REGIONAL.max) {
    score = DISTANCE_TIERS.REGIONAL.score;
  } else if (distanceMiles <= DISTANCE_TIERS.MULTI_STATE.max) {
    score = DISTANCE_TIERS.MULTI_STATE.score;
  } else {
    score = DISTANCE_TIERS.NATIONAL.score;
  }

  return { score, distanceMiles };
}

/**
 * Compute specialty fit score (0-100)
 *
 * Uses taxonomy code matching:
 * - Exact match: 100
 * - Same category (first 4 chars): 80
 * - Same group (first 2 chars): 50
 * - No match: 0
 */
export function computeSpecialtyScore(
  clinicianSpecialty: string,
  jobSpecialty: string
): { score: number; match: string } {
  if (!clinicianSpecialty || !jobSpecialty) {
    return { score: 0, match: 'none' };
  }

  if (clinicianSpecialty === jobSpecialty) {
    return { score: 100, match: 'exact' };
  }

  // Check category match (first 4 characters of taxonomy code)
  if (
    clinicianSpecialty.substring(0, 4) === jobSpecialty.substring(0, 4)
  ) {
    return { score: 80, match: 'category' };
  }

  // Check group match (first 2 characters)
  if (
    clinicianSpecialty.substring(0, 2) === jobSpecialty.substring(0, 2)
  ) {
    return { score: 50, match: 'group' };
  }

  return { score: 0, match: 'none' };
}

/**
 * Compute compact eligibility score (0-100)
 *
 * Checks if clinician can work in required states via compacts
 */
export function computeCompactScore(
  clinician: ClinicianProfile,
  job: JobRequirements
): { score: number; eligibility: string[] } {
  const eligibleCompacts: string[] = [];
  let hasDirectLicense = false;

  // Check for direct license match
  for (const requiredState of job.requiredStates) {
    if (clinician.licenseStates.includes(requiredState)) {
      hasDirectLicense = true;
      eligibleCompacts.push('direct_license');
      break;
    }
  }

  // Check compact eligibility
  if (job.compacts?.imlcAllowed && clinician.compacts?.imlc) {
    eligibleCompacts.push('imlc');
  }

  if (job.compacts?.psypactAllowed && clinician.compacts?.psypact) {
    eligibleCompacts.push('psypact');
  }

  if (
    job.compacts?.counselingCompactAllowed &&
    clinician.compacts?.counselingCompact
  ) {
    eligibleCompacts.push('counseling_compact');
  }

  // Score calculation
  if (hasDirectLicense) {
    return { score: 100, eligibility: eligibleCompacts };
  } else if (eligibleCompacts.length > 0) {
    // Compact eligible but no direct license
    return { score: 80, eligibility: eligibleCompacts };
  } else {
    // No eligibility
    return { score: 0, eligibility: [] };
  }
}

/**
 * Compute overall match quality score
 */
export function computeQualityScore(
  clinician: ClinicianProfile,
  job: JobRequirements
): QualityScore {
  // Compute component scores
  const distanceResult = computeDistanceScore(clinician, job);
  const specialtyResult = computeSpecialtyScore(
    clinician.specialty,
    job.specialty
  );
  const compactResult = computeCompactScore(clinician, job);

  // Calculate weighted overall score
  const distanceContribution =
    distanceResult.score * SCORE_WEIGHTS.DISTANCE;
  const specialtyContribution =
    specialtyResult.score * SCORE_WEIGHTS.SPECIALTY;
  const compactContribution = compactResult.score * SCORE_WEIGHTS.COMPACT;

  const overallScore =
    distanceContribution + specialtyContribution + compactContribution;

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    distanceScore: distanceResult.score,
    specialtyScore: specialtyResult.score,
    compactScore: compactResult.score,
    features: {
      distanceMiles: distanceResult.distanceMiles,
      specialtyMatch: specialtyResult.match,
      compactEligibility: compactResult.eligibility,
      licenseStateMatch: compactResult.eligibility.includes('direct_license'),
    },
    breakdown: {
      distance: {
        value: distanceResult.score,
        weight: SCORE_WEIGHTS.DISTANCE,
        contribution: distanceContribution,
      },
      specialty: {
        value: specialtyResult.score,
        weight: SCORE_WEIGHTS.SPECIALTY,
        contribution: specialtyContribution,
      },
      compact: {
        value: compactResult.score,
        weight: SCORE_WEIGHTS.COMPACT,
        contribution: compactContribution,
      },
    },
  };
}

/**
 * Log quality score for analytics and model training
 */
export async function logQualityScore(
  clinicianDid: string,
  jobId: string,
  score: QualityScore
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        type: 'match.quality_score',
        subjectNpi: null,
        userId: null,
        data: {
          clinicianDid,
          jobId,
          score: score.overallScore,
          features: score.features,
          breakdown: score.breakdown,
        },
      },
    });
  } catch (error) {
    log.error('Failed to log quality score:', error);
    // Don't throw - logging failures shouldn't break matching
  }
}

/**
 * Batch compute quality scores for multiple clinician-job pairs
 */
export async function batchComputeQualityScores(
  clinicians: ClinicianProfile[],
  job: JobRequirements
): Promise<Array<{ clinicianDid: string; score: QualityScore }>> {
  const results = clinicians.map((clinician) => ({
    clinicianDid: clinician.did,
    score: computeQualityScore(clinician, job),
  }));

  // Sort by overall score descending
  results.sort((a, b) => b.score.overallScore - a.score.overallScore);

  return results;
}

/**
 * Get recommended jobs for a clinician based on quality scores
 */
export async function getRecommendedJobs(
  clinicianDid: string,
  limit: number = 10
): Promise<Array<{ jobId: string; score: QualityScore }>> {
  // Fetch clinician profile
  const user = await prisma.user.findFirst({
    where: { did: clinicianDid },
    include: {
      npiClaims: true,
    },
  });

  if (!user) {
    throw new Error(`Clinician not found: ${clinicianDid}`);
  }

  // Extract clinician profile
  const clinicianProfile: ClinicianProfile = {
    did: user.did!,
    npi: user.npiClaims[0]?.npi,
    specialty: (user.metadata as any)?.specialty || '',
    licenseStates: (user.metadata as any)?.licenseStates || [],
    homeLocation: (user.metadata as any)?.homeLocation,
    compacts: (user.metadata as any)?.compacts,
  };

  // Fetch active jobs
  const activeJobs = await prisma.jobPosting.findMany({
    where: { status: 'active' },
    take: 100, // Fetch more than needed for scoring
  });

  // Compute scores for all active jobs
  const scoredJobs = activeJobs.map((job) => {
    const jobReq: JobRequirements = {
      jobId: job.id,
      specialty: job.specialty,
      requiredStates: job.requiredStates,
      location: job.location as any,
      modality: job.modality as any,
      compacts: {
        imlcAllowed: job.imlcAllowed,
        psypactAllowed: job.psypactAllowed,
        counselingCompactAllowed: job.counselingCompactAllowed,
      },
    };

    return {
      jobId: job.id,
      score: computeQualityScore(clinicianProfile, jobReq),
    };
  });

  // Sort by score and return top N
  scoredJobs.sort((a, b) => b.score.overallScore - a.score.overallScore);
  return scoredJobs.slice(0, limit);
}

// Export types and functions
export type {
  ClinicianProfile as MatchClinicianProfile,
  JobRequirements as MatchJobRequirements,
};

