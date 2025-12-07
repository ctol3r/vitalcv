/**
 * B132A-MATCH-007: Rule-based job matcher v1 (specialty + license state)
 *
 * Matches jobs where licenseState∈jobStates AND specialty≈jobSpecialty; unit tests
 */

import { JobMatchCriteria } from '../jobs/models/JobPosting';
import { MatchReason } from '../jobs/models/Application';

export interface JobCandidate {
  id: string;
  partnerId: string;
  title: string;
  specialty: string;
  requiredStates: string[];
  modality: 'in-person' | 'telehealth' | 'hybrid';
  location?: {
    city?: string;
    state: string;
    zip?: string;
    coords?: { lat: number; lng: number };
  };
  telehealth: boolean;
  imlcEligible: boolean;
  multiStateOk: boolean;
  compRangeMin?: number;
  compRangeMax?: number;
  status: 'active' | 'closed' | 'filled';
}

export interface MatchResult {
  jobId: string;
  score: number;
  rank?: number;
  reason: MatchReason;
  matched: boolean;
}

/**
 * Calculate specialty match score
 * Exact match = 1.0, similar specialty = 0.7, different = 0.0
 */
function calculateSpecialtyScore(
  candidateSpecialty: string,
  jobSpecialty: string
): { matched: boolean; score: number; details?: string } {
  // Exact match
  if (candidateSpecialty === jobSpecialty) {
    return { matched: true, score: 1.0, details: 'Exact specialty match' };
  }

  // Check for related specialties (simplified - in production use taxonomy mapping)
  const specialtyFamilies: { [key: string]: string[] } = {
    // Primary Care family
    'primary-care': ['207Q00000X', '208D00000X', '207R00000X'],
    // Emergency/Critical Care family
    'emergency': ['207P00000X', '207PE0004X', '207PC0000X'],
    // Cardiology family
    'cardiology': ['207RC0000X', '207RI0001X', '207RI0008X'],
  };

  for (const [family, specialties] of Object.entries(specialtyFamilies)) {
    if (specialties.includes(candidateSpecialty) && specialties.includes(jobSpecialty)) {
      return {
        matched: true,
        score: 0.7,
        details: `Related specialties in ${family} family`
      };
    }
  }

  return { matched: false, score: 0.0, details: 'No specialty match' };
}

/**
 * Calculate license state match
 * Checks direct state match, IMLC eligibility, and multi-state licenses
 */
function calculateLicenseStateMatch(
  criteria: JobMatchCriteria,
  job: JobCandidate
): { matched: boolean; states: string[]; method?: string } {
  const candidateStates = new Set(criteria.licenseStates);
  const requiredStates = new Set(job.requiredStates);

  // Direct state match
  const directMatches = Array.from(candidateStates).filter(state =>
    requiredStates.has(state)
  );

  if (directMatches.length > 0) {
    return {
      matched: true,
      states: directMatches,
      method: 'direct',
    };
  }

  // IMLC eligibility (if both candidate and job support it)
  if (criteria.imlcMember && job.imlcEligible) {
    // IMLC states (simplified list - in production use full IMLC compact states)
    const imlcStates = new Set([
      'AL', 'AZ', 'CO', 'DE', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA',
      'KS', 'KY', 'LA', 'MD', 'MI', 'MN', 'MS', 'MO', 'NE', 'NH',
      'NV', 'OH', 'OK', 'PA', 'SC', 'TN', 'TX', 'UT', 'VA', 'WA',
      'WV', 'WI', 'WY'
    ]);

    const imlcMatches = Array.from(requiredStates).filter(state =>
      imlcStates.has(state)
    );

    if (imlcMatches.length > 0) {
      return {
        matched: true,
        states: imlcMatches,
        method: 'imlc',
      };
    }
  }

  // Multi-state license match
  if (criteria.multiStateLicenses && job.multiStateOk) {
    const multiStateMatches = criteria.multiStateLicenses.filter(state =>
      requiredStates.has(state)
    );

    if (multiStateMatches.length > 0) {
      return {
        matched: true,
        states: multiStateMatches,
        method: 'multi-state',
      };
    }
  }

  return {
    matched: false,
    states: [],
  };
}

/**
 * Calculate telehealth eligibility
 */
function calculateTelehealthEligibility(
  criteria: JobMatchCriteria,
  job: JobCandidate
): { eligible: boolean; method?: string } {
  // Job doesn't require telehealth
  if (!job.telehealth && job.modality === 'in-person') {
    return { eligible: true, method: 'not-required' };
  }

  // Candidate has IMLC and job accepts IMLC
  if (criteria.imlcMember && job.imlcEligible) {
    return { eligible: true, method: 'imlc' };
  }

  // Candidate has multi-state licenses and job accepts them
  if (criteria.multiStateLicenses && job.multiStateOk) {
    const hasRequiredState = criteria.multiStateLicenses.some(state =>
      job.requiredStates.includes(state)
    );
    if (hasRequiredState) {
      return { eligible: true, method: 'multi-state' };
    }
  }

  // Candidate has direct license in required state
  const hasDirectLicense = criteria.licenseStates.some(state =>
    job.requiredStates.includes(state)
  );
  if (hasDirectLicense) {
    return { eligible: true, method: 'single-state' };
  }

  return { eligible: false };
}

/**
 * Calculate location proximity score (if location preference provided)
 */
function calculateLocationScore(
  criteria: JobMatchCriteria,
  job: JobCandidate
): number {
  // If no location preference, neutral score
  if (!criteria.location) {
    return 0.5;
  }

  // If job is remote/telehealth, location is less important
  if (job.modality === 'telehealth') {
    return 1.0;
  }

  // Same state = 1.0, different state = 0.3
  if (job.location && job.location.state === criteria.location.state) {
    return 1.0;
  }

  return 0.3;
}

/**
 * Match jobs based on criteria
 * Returns ranked list of matching jobs
 */
export function matchJobs(
  criteria: JobMatchCriteria,
  jobs: JobCandidate[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const job of jobs) {
    // Skip inactive jobs
    if (job.status !== 'active') {
      continue;
    }

    // Calculate specialty match
    const specialtyMatch = calculateSpecialtyScore(criteria.specialty, job.specialty);

    // Calculate license state match
    const licenseMatch = calculateLicenseStateMatch(criteria, job);

    // Must match on both specialty and license state
    if (!specialtyMatch.matched || !licenseMatch.matched) {
      results.push({
        jobId: job.id,
        score: 0,
        matched: false,
        reason: {
          specialty: specialtyMatch,
          licenseState: licenseMatch,
          overall: { score: 0 },
        },
      });
      continue;
    }

    // Calculate additional factors
    const telehealthEligibility = calculateTelehealthEligibility(criteria, job);
    const locationScore = calculateLocationScore(criteria, job);

    // Calculate overall score (weighted)
    const overallScore = (
      specialtyMatch.score * 0.5 +  // 50% weight on specialty
      (licenseMatch.matched ? 0.3 : 0) +  // 30% weight on license
      locationScore * 0.2  // 20% weight on location
    );

    results.push({
      jobId: job.id,
      score: overallScore,
      matched: true,
      reason: {
        specialty: specialtyMatch,
        licenseState: licenseMatch,
        telehealth: telehealthEligibility,
        overall: { score: overallScore },
      },
    });
  }

  // Sort by score (highest first) and assign ranks
  results.sort((a, b) => b.score - a.score);
  results.forEach((result, index) => {
    if (result.matched) {
      result.rank = index + 1;
      result.reason.overall.rank = index + 1;
    }
  });

  return results;
}

/**
 * Get top N matches
 */
export function getTopMatches(
  criteria: JobMatchCriteria,
  jobs: JobCandidate[],
  topN: number = 10
): MatchResult[] {
  const allMatches = matchJobs(criteria, jobs);
  return allMatches
    .filter(match => match.matched)
    .slice(0, topN);
}

