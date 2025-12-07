/**
 * B132A-TELEMED-014: Telehealth eligibility rule (multi-state/IMLC) in matcher
 *
 * If IMLC or multiState licenses present, match to telemed jobs; tests for IMLC state combos
 */

import { JobMatchCriteria } from '../jobs/models/JobPosting';

// IMLC Compact member states (as of 2025)
export const IMLC_STATES = new Set([
  'AL', 'AZ', 'CO', 'DE', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'MD', 'MI', 'MN', 'MS', 'MO', 'NE', 'NH',
  'NV', 'OH', 'OK', 'PA', 'SC', 'TN', 'TX', 'UT', 'VA', 'WA',
  'WV', 'WI', 'WY'
]);

export interface TelehealthEligibilityResult {
  eligible: boolean;
  method: 'imlc' | 'multi-state' | 'single-state' | 'not-eligible';
  coveredStates: string[];
  details: string;
}

/**
 * Check if a clinician is eligible for telehealth jobs based on their licenses
 */
export function checkTelehealthEligibility(
  criteria: JobMatchCriteria,
  requiredStates: string[]
): TelehealthEligibilityResult {
  // Method 1: IMLC eligibility
  if (criteria.imlcMember) {
    const imlcCoveredStates = requiredStates.filter(state => IMLC_STATES.has(state));

    if (imlcCoveredStates.length > 0) {
      return {
        eligible: true,
        method: 'imlc',
        coveredStates: imlcCoveredStates,
        details: `IMLC member can practice in ${imlcCoveredStates.length} required state(s)`,
      };
    }
  }

  // Method 2: Multi-state licenses
  if (criteria.multiStateLicenses && criteria.multiStateLicenses.length > 0) {
    const multiStateCoveredStates = requiredStates.filter(state =>
      criteria.multiStateLicenses!.includes(state)
    );

    if (multiStateCoveredStates.length > 0) {
      return {
        eligible: true,
        method: 'multi-state',
        coveredStates: multiStateCoveredStates,
        details: `Multi-state licenses cover ${multiStateCoveredStates.length} required state(s)`,
      };
    }
  }

  // Method 3: Single-state licenses (direct match)
  const directLicenseStates = requiredStates.filter(state =>
    criteria.licenseStates.includes(state)
  );

  if (directLicenseStates.length > 0) {
    return {
      eligible: true,
      method: 'single-state',
      coveredStates: directLicenseStates,
      details: `Direct licenses in ${directLicenseStates.length} required state(s)`,
    };
  }

  // Not eligible
  return {
    eligible: false,
    method: 'not-eligible',
    coveredStates: [],
    details: 'No licenses covering required states',
  };
}

/**
 * Get all states a clinician can practice in via telehealth
 */
export function getTelehealthCoverageStates(criteria: JobMatchCriteria): string[] {
  const coverageStates = new Set<string>();

  // Add direct license states
  criteria.licenseStates.forEach(state => coverageStates.add(state));

  // Add multi-state license states
  if (criteria.multiStateLicenses) {
    criteria.multiStateLicenses.forEach(state => coverageStates.add(state));
  }

  // Add IMLC states if member
  if (criteria.imlcMember) {
    IMLC_STATES.forEach(state => coverageStates.add(state));
  }

  return Array.from(coverageStates).sort();
}

/**
 * Check if a state combination is valid for IMLC
 */
export function isValidImlcCombination(states: string[]): boolean {
  // All states must be IMLC member states
  return states.every(state => IMLC_STATES.has(state));
}

/**
 * Calculate telehealth reach score (0-1)
 * Higher score = can practice in more states
 */
export function calculateTelehealthReachScore(criteria: JobMatchCriteria): number {
  const coverageStates = getTelehealthCoverageStates(criteria);

  // US has 50 states + DC
  const maxStates = 51;
  const score = Math.min(coverageStates.length / maxStates, 1.0);

  return score;
}

/**
 * Get telehealth eligibility summary
 */
export function getTelehealthEligibilitySummary(criteria: JobMatchCriteria): {
  canPracticeInStates: string[];
  hasImlc: boolean;
  hasMultiState: boolean;
  directLicenseCount: number;
  totalCoverage: number;
  reachScore: number;
} {
  const coverageStates = getTelehealthCoverageStates(criteria);

  return {
    canPracticeInStates: coverageStates,
    hasImlc: !!criteria.imlcMember,
    hasMultiState: !!(criteria.multiStateLicenses && criteria.multiStateLicenses.length > 0),
    directLicenseCount: criteria.licenseStates.length,
    totalCoverage: coverageStates.length,
    reachScore: calculateTelehealthReachScore(criteria),
  };
}

