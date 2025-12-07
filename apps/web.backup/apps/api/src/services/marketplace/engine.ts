/**
 * Marketplace Core Engine
 *
 * Trust-weighted matching between clinicians (supply) and facilities (demand)
 * Chain-anchored, privilege-aware credentialing marketplace
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface MarketplaceClinicianProfile {
  clinicianId: string;
  trustScore: number;
  specialty: string[];
  skills: string[];
  privileges: {
    icu: boolean;
    or: boolean;
    telemedicine: boolean;
    emergency: boolean;
  };
  telemedicineEligibility: {
    eligible: boolean;
    states: string[];
    compacts: string[];
  };
  compactEligibility: {
    eligible: boolean;
    compacts: string[];
    states: string[];
  };
  readinessScore: number;
  availability: {
    status: 'available' | 'limited' | 'unavailable';
    nextAvailable?: string;
  };
  trustTrajectory: {
    trend: 'improving' | 'stable' | 'declining';
    velocity: number;
    lastUpdated: string;
  };
}

export interface MarketplaceFacilityProfile {
  facilityId: string;
  facilityName: string;
  rolesNeeded: Array<{
    role: string;
    specialty: string;
    priority: 'high' | 'medium' | 'low';
    shiftNeeds: number;
  }>;
  credentialRequirements: {
    minimumTrustScore: number;
    requiredCredentials: string[];
    preferredCredentials: string[];
  };
  privilegeRequirements: {
    icu: boolean;
    or: boolean;
    telemedicine: boolean;
    emergency: boolean;
  };
  riskTolerance: 'low' | 'medium' | 'high';
  qualityScore: number;
  onboardingComplexity: 'simple' | 'moderate' | 'complex';
  privilegingTimeline: {
    typical: number; // days
    fastTrack: number; // days
  };
}

export interface MatchScore {
  overall: number;
  breakdown: {
    credentials: number;
    trustTrajectory: number;
    skillCompetency: number;
    privilegingReadiness: number;
    telemedicineCoverage: number;
    compactPortability: number;
  };
  factors: {
    strengths: string[];
    gaps: string[];
  };
}

export interface DemandForecast {
  facilityId: string;
  specialty: string;
  openRoles: number;
  shiftNeeds: {
    current: number;
    projected30d: number;
    projected90d: number;
  };
  urgency: 'critical' | 'high' | 'medium' | 'low';
  updatedAt: string;
}

export interface SupplyForecast {
  clinicianId: string;
  specialty: string[];
  availability: {
    current: boolean;
    next30d: boolean;
    next90d: boolean;
  };
  readiness: {
    current: number;
    projected30d: number;
  };
  updatedAt: string;
}

/**
 * Calculate match score between clinician and facility
 */
export function calculateMatchScore(
  clinician: MarketplaceClinicianProfile,
  facility: MarketplaceFacilityProfile
): MatchScore {
  // Credential match (0-0.25)
  const credentialMatch = calculateCredentialMatch(clinician, facility);

  // Trust trajectory (0-0.20)
  const trustTrajectoryScore = calculateTrustTrajectoryScore(clinician);

  // Skill competency (0-0.20)
  const skillCompetencyScore = calculateSkillCompetencyScore(clinician, facility);

  // Privileging readiness (0-0.15)
  const privilegingReadinessScore = calculatePrivilegingReadiness(clinician, facility);

  // Telemedicine coverage (0-0.10)
  const telemedicineScore = calculateTelemedicineScore(clinician, facility);

  // Compact portability (0-0.10)
  const compactScore = calculateCompactScore(clinician, facility);

  const overall = Math.min(1.0,
    credentialMatch +
    trustTrajectoryScore +
    skillCompetencyScore +
    privilegingReadinessScore +
    telemedicineScore +
    compactScore
  );

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (credentialMatch > 0.2) strengths.push('Strong credential alignment');
  if (trustTrajectoryScore > 0.15) strengths.push('Positive trust trajectory');
  if (skillCompetencyScore > 0.15) strengths.push('High skill match');
  if (privilegingReadinessScore > 0.12) strengths.push('Fast privileging path');
  if (telemedicineScore > 0.08) strengths.push('Telemedicine ready');
  if (compactScore > 0.08) strengths.push('Multi-state portable');

  if (credentialMatch < 0.1) gaps.push('Missing required credentials');
  if (trustTrajectoryScore < 0.1) gaps.push('Trust trajectory concerns');
  if (skillCompetencyScore < 0.1) gaps.push('Skill gaps identified');
  if (privilegingReadinessScore < 0.08) gaps.push('Privileging may be delayed');
  if (telemedicineScore < 0.05 && facility.privilegeRequirements.telemedicine) {
    gaps.push('Telemedicine eligibility needed');
  }
  if (compactScore < 0.05 && facility.rolesNeeded.some(r => r.priority === 'high')) {
    gaps.push('Limited state portability');
  }

  return {
    overall: Number(overall.toFixed(4)),
    breakdown: {
      credentials: Number(credentialMatch.toFixed(4)),
      trustTrajectory: Number(trustTrajectoryScore.toFixed(4)),
      skillCompetency: Number(skillCompetencyScore.toFixed(4)),
      privilegingReadiness: Number(privilegingReadinessScore.toFixed(4)),
      telemedicineCoverage: Number(telemedicineScore.toFixed(4)),
      compactPortability: Number(compactScore.toFixed(4)),
    },
    factors: { strengths, gaps },
  };
}

function calculateCredentialMatch(
  clinician: MarketplaceClinicianProfile,
  facility: MarketplaceFacilityProfile
): number {
  const required = facility.credentialRequirements.requiredCredentials;
  const preferred = facility.credentialRequirements.preferredCredentials;
  const clinicianCreds = [...clinician.specialty, ...clinician.skills];

  let score = 0;
  const requiredWeight = 0.15;
  const preferredWeight = 0.10;

  // Check required credentials
  const requiredMatch = required.filter(req =>
    clinicianCreds.some(cred => cred.toLowerCase().includes(req.toLowerCase()))
  ).length;
  score += (requiredMatch / Math.max(required.length, 1)) * requiredWeight;

  // Check preferred credentials
  const preferredMatch = preferred.filter(pref =>
    clinicianCreds.some(cred => cred.toLowerCase().includes(pref.toLowerCase()))
  ).length;
  score += (preferredMatch / Math.max(preferred.length, 1)) * preferredWeight;

  // Trust score threshold
  if (clinician.trustScore >= facility.credentialRequirements.minimumTrustScore) {
    score += 0.05;
  }

  return Math.min(0.25, score);
}

function calculateTrustTrajectoryScore(
  clinician: MarketplaceClinicianProfile
): number {
  const baseScore = clinician.trustScore * 0.10;
  let trajectoryBonus = 0;

  if (clinician.trustTrajectory.trend === 'improving') {
    trajectoryBonus = 0.08;
  } else if (clinician.trustTrajectory.trend === 'stable') {
    trajectoryBonus = 0.05;
  } else {
    trajectoryBonus = 0.02;
  }

  // Velocity bonus (positive velocity = improving faster)
  const velocityBonus = Math.min(0.02, clinician.trustTrajectory.velocity * 0.01);

  return Math.min(0.20, baseScore + trajectoryBonus + velocityBonus);
}

function calculateSkillCompetencyScore(
  clinician: MarketplaceClinicianProfile,
  facility: MarketplaceFacilityProfile
): number {
  const neededSpecialties = facility.rolesNeeded.map(r => r.specialty);
  const clinicianSpecialties = clinician.specialty;

  let matchCount = 0;
  for (const needed of neededSpecialties) {
    if (clinicianSpecialties.some(spec =>
      spec.toLowerCase().includes(needed.toLowerCase())
    )) {
      matchCount++;
    }
  }

  const specialtyMatch = (matchCount / Math.max(neededSpecialties.length, 1)) * 0.15;

  // Skill overlap
  const neededSkills = facility.rolesNeeded.flatMap(r => [r.role, r.specialty]);
  const skillOverlap = clinician.skills.filter(skill =>
    neededSkills.some(needed => needed.toLowerCase().includes(skill.toLowerCase()))
  ).length;
  const skillMatch = (skillOverlap / Math.max(neededSkills.length, 1)) * 0.05;

  return Math.min(0.20, specialtyMatch + skillMatch);
}

function calculatePrivilegingReadiness(
  clinician: MarketplaceClinicianProfile,
  facility: MarketplaceFacilityProfile
): number {
  let score = 0;

  // Privilege requirements match
  if (facility.privilegeRequirements.icu && clinician.privileges.icu) score += 0.04;
  if (facility.privilegeRequirements.or && clinician.privileges.or) score += 0.04;
  if (facility.privilegeRequirements.telemedicine && clinician.privileges.telemedicine) score += 0.03;
  if (facility.privilegeRequirements.emergency && clinician.privileges.emergency) score += 0.04;

  // Readiness score bonus
  if (clinician.readinessScore >= 0.9) {
    score += 0.05; // Fast track ready
  } else if (clinician.readinessScore >= 0.8) {
    score += 0.03;
  } else if (clinician.readinessScore >= 0.7) {
    score += 0.01;
  }

  return Math.min(0.15, score);
}

function calculateTelemedicineScore(
  clinician: MarketplaceClinicianProfile,
  facility: MarketplaceFacilityProfile
): number {
  if (!facility.privilegeRequirements.telemedicine) {
    return 0.05; // Not required, small bonus
  }

  if (!clinician.telemedicineEligibility.eligible) {
    return 0;
  }

  let score = 0.05; // Base eligibility

  // Compact coverage bonus
  if (clinician.telemedicineEligibility.compacts.length > 0) {
    score += 0.03;
  }

  // State coverage
  if (clinician.telemedicineEligibility.states.length > 5) {
    score += 0.02;
  }

  return Math.min(0.10, score);
}

function calculateCompactScore(
  clinician: MarketplaceClinicianProfile,
  facility: MarketplaceFacilityProfile
): number {
  if (!clinician.compactEligibility.eligible) {
    return 0;
  }

  let score = 0.05; // Base compact eligibility

  // Multiple compacts = higher portability
  if (clinician.compactEligibility.compacts.length > 1) {
    score += 0.03;
  }

  // State coverage
  if (clinician.compactEligibility.states.length > 10) {
    score += 0.02;
  }

  return Math.min(0.10, score);
}

/**
 * Forecast facility demand
 */
export async function forecastFacilityDemand(
  facilityId: string
): Promise<DemandForecast[]> {
  // In a real implementation, this would query actual facility data
  // For now, return mock structure
  const forecasts: DemandForecast[] = [];

  // This would be populated from actual facility role data
  // const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  // const openRoles = await prisma.openRole.findMany({ where: { facilityId } });

  return forecasts;
}

/**
 * Forecast clinician supply
 */
export async function forecastClinicianSupply(
  clinicianId: string
): Promise<SupplyForecast | null> {
  // In a real implementation, this would query actual clinician data
  // For now, return mock structure
  return null;
}

/**
 * Trust-weighted marketplace ranking
 */
export function rankMarketplaceResults<T extends { matchScore?: MatchScore; trustScore?: number }>(
  results: T[]
): T[] {
  return results.sort((a, b) => {
    // Primary: match score
    const matchA = a.matchScore?.overall ?? 0;
    const matchB = b.matchScore?.overall ?? 0;
    if (Math.abs(matchA - matchB) > 0.01) {
      return matchB - matchA;
    }

    // Secondary: trust score
    const trustA = a.trustScore ?? 0;
    const trustB = b.trustScore ?? 0;
    return trustB - trustA;
  });
}

/**
 * Anchor marketplace event to chain
 */
export function anchorMarketplaceEventToChain(
  eventType: string,
  payload: Record<string, unknown>
): string {
  const receipt = anchorEvent(eventType as any, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
  return receipt.txHash;
}

