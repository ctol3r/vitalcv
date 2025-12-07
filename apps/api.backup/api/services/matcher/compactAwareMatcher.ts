/**
 * B138A-MATCH-011: Compact-Aware Matcher Enhancement
 *
 * Enhances job matching to consider compact licenses (IMLC, PSYPACT, Counseling Compact).
 * If a job allows compact licenses and a clinician has active compact covering the job state,
 * the clinician is marked as eligible for the match.
 */

import type { PrismaClient } from '@prisma/client';
import type { CompactsStatusData } from '../compacts/models/CompactsStatus.js';
import type { ClinicianCompactProfile } from '../compacts/eligibilityEngine.js';
import {
  buildClinicianProfileFromStatus,
  evaluateCompactRuleWithProfile,
} from './rules/compactRule.js';

// Job posting interface (from JobPosting model)
export interface JobPostingWithCompacts {
  id: string;
  title: string;
  specialty: string;
  requiredStates: string[];
  targetLicenseJurisdictions: string[];
  imlcAllowed: boolean;
  psypactAllowed: boolean;
  counselingCompactAllowed: boolean;
  compactAllowed: boolean;
  modality: string;
  telehealth: boolean;
}

// Match result
export interface CompactMatchResult {
  jobId: string;
  clinicianDid: string;
  matchEligible: boolean;
  matchScore: number;
  matchReasons: string[];
  compactMatches: {
    imlc: boolean;
    psypact: boolean;
    counseling: boolean;
  };
  eligibleStates: string[];
}

/**
 * Check if clinician is eligible for a job based on compact licenses
 */
export async function checkCompactEligibility(
  prisma: PrismaClient,
  clinicianDid: string,
  job: JobPostingWithCompacts
): Promise<CompactMatchResult> {
  const compactsStatus = await prisma.compactsStatus.findUnique({
    where: { clinicianDid },
  });

  if (!compactsStatus) {
    return buildUnavailableStatusResult(job.id, clinicianDid);
  }

  return evaluateJobAgainstCompacts(compactsStatus as unknown as CompactsStatusData, job);
}

export async function batchCheckCompactEligibility(
  prisma: PrismaClient,
  clinicianDids: string[],
  jobs: JobPostingWithCompacts[]
): Promise<CompactMatchResult[]> {
  const compactsStatuses = await prisma.compactsStatus.findMany({
    where: {
      clinicianDid: { in: clinicianDids },
    },
  });

  const statusMap = new Map(compactsStatuses.map((s) => [s.clinicianDid, s]));

  const results: CompactMatchResult[] = [];

  for (const clinicianDid of clinicianDids) {
    for (const job of jobs) {
      const compactsStatus = statusMap.get(clinicianDid);

      if (!compactsStatus) {
        results.push(buildUnavailableStatusResult(job.id, clinicianDid));
        continue;
      }

      const result = evaluateJobAgainstCompacts(compactsStatus as unknown as CompactsStatusData, job);
      results.push(result);
    }
  }

  return results;
}

function buildUnavailableStatusResult(jobId: string, clinicianDid: string): CompactMatchResult {
  return {
    jobId,
    clinicianDid,
    matchEligible: false,
    matchScore: 0,
    matchReasons: ['Compacts status not computed'],
    compactMatches: {
      imlc: false,
      psypact: false,
      counseling: false,
    },
    eligibleStates: [],
  };
}

function computeCompactMatchWithProfile(
  compactsStatus: CompactsStatusData,
  profile: ClinicianCompactProfile,
  job: JobPostingWithCompacts
): CompactMatchResult {
  const targetStates = job.targetLicenseJurisdictions.length > 0
    ? job.targetLicenseJurisdictions
    : job.requiredStates;

  const matchReasons: string[] = [];
  const eligibleStates = new Set<string>();
  let imlcMatch = false;
  let psypactMatch = false;
  let counselingMatch = false;

  if ((job.imlcAllowed || job.compactAllowed) && profile.compacts?.imlc) {
    const imlcCoveredStates = targetStates.filter((state) => {
      const evaluation = evaluateCompactRuleWithProfile(profile, 'IMLC', state);
      return evaluation?.eligible;
    });

    if (imlcCoveredStates.length > 0) {
      imlcMatch = true;
      matchReasons.push(`IMLC compact covers states: ${imlcCoveredStates.join(', ')}`);
      imlcCoveredStates.forEach((state) => eligibleStates.add(state));
    }
  }

  if ((job.psypactAllowed || job.compactAllowed) && (job.telehealth || job.modality === 'telehealth') && profile.compacts?.psypact) {
    const psypactCoveredStates = targetStates.filter((state) => {
      const evaluation = evaluateCompactRuleWithProfile(profile, 'PSYPACT', state);
      return evaluation?.eligible;
    });

    if (psypactCoveredStates.length > 0) {
      psypactMatch = true;
      matchReasons.push(`PSYPACT compact covers telepsychology in states: ${psypactCoveredStates.join(', ')}`);
      psypactCoveredStates.forEach((state) => eligibleStates.add(state));
    }
  }

  if (job.counselingCompactAllowed || job.compactAllowed) {
    const counselingEligible = compactsStatus.counselingStatus !== 'NOT_ELIGIBLE';
    if (counselingEligible) {
      const counselingStates = [compactsStatus.counselingHomeState, ...compactsStatus.counselingStates].filter(Boolean) as string[];
      const counselingCoveredStates = targetStates.filter((state) => counselingStates.includes(state));

      if (counselingCoveredStates.length > 0) {
        counselingMatch = true;
        matchReasons.push(`Counseling Compact covers states: ${counselingCoveredStates.join(', ')}`);
        counselingCoveredStates.forEach((state) => eligibleStates.add(state));
      }
    }
  }

  const matchEligible = imlcMatch || psypactMatch || counselingMatch;

  let matchScore = 0;
  if (matchEligible) {
    matchScore = 0.5;
    const coverageRatio = eligibleStates.size / targetStates.length;
    matchScore += coverageRatio * 0.3;
    const compactCount = [imlcMatch, psypactMatch, counselingMatch].filter(Boolean).length;
    matchScore += (compactCount - 1) * 0.1;
    matchScore = Math.min(matchScore, 1.0);
  }

  return {
    jobId: job.id,
    clinicianDid: compactsStatus.clinicianDid,
    matchEligible,
    matchScore,
    matchReasons,
    compactMatches: { imlc: imlcMatch, psypact: psypactMatch, counseling: counselingMatch },
    eligibleStates: Array.from(eligibleStates),
  };
}

export function evaluateJobAgainstCompacts(
  compactsStatus: CompactsStatusData,
  job: JobPostingWithCompacts
): CompactMatchResult {
  const profile = buildClinicianProfileFromStatus(compactsStatus);
  return computeCompactMatchWithProfile(compactsStatus, profile, job);
}
