/**
 * B138A-CC-007: Counseling Compact Eligibility Engine
 *
 * Core business logic for determining Counseling Compact eligibility.
 * Implements rules based on counseling license, home state, and compact requirements.
 */

import type { CounselingLicense, CounselingCompactData, CounselingCompactEligibilityRequirements } from './models/CounselingCompact.js';
import { COUNSELING_COMPACT_STATES, isCounselingCompactState, CounselingLicenseTypes } from './models/CounselingCompact.js';

/**
 * Determine Counseling Compact eligibility based on clinician's counseling license history
 *
 * Counseling Compact Eligibility Requirements:
 * 1. Must hold an active, unencumbered counseling license in a member state
 * 2. Must have a master's degree or higher in counseling or related field
 * 3. Completed required supervised experience (typically 3,000 hours)
 * 4. Passed NCE (National Counselor Examination) or NCMHCE
 * 5. No disciplinary actions or restrictions
 * 6. Background check completed
 */
export async function determineCounselingCompactEligibility(
  clinicianDid: string,
  homeState: string | undefined,
  licenseData: CounselingLicense[]
): Promise<CounselingCompactData> {
  // If no home state specified, try to infer from license data
  let primaryState = homeState;
  if (!primaryState && licenseData.length > 0) {
    const primaryLicense = licenseData.find((lic) => lic.isPrimary);
    primaryState = primaryLicense?.state || licenseData[0].state;
  }

  if (!primaryState) {
    return {
      clinicianDid,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      licenseData,
      metadata: {
        reason: 'No home state or license data provided',
      },
    };
  }

  // Verify home state is a Counseling Compact member
  if (!isCounselingCompactState(primaryState)) {
    return {
      clinicianDid,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      homeState: primaryState,
      licenseData,
      metadata: {
        reason: 'Home state is not a Counseling Compact member state',
        homeStateIsMember: false,
      },
    };
  }

  // Find active license in home state
  const primaryLicense = licenseData.find(
    (lic) => lic.state === primaryState && lic.status === 'active'
  );

  if (!primaryLicense) {
    return {
      clinicianDid,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      homeState: primaryState,
      licenseData,
      metadata: {
        reason: 'No active counseling license found in home state',
        homeStateIsMember: true,
        hasActiveLicense: false,
      },
    };
  }

  // Verify license type is a recognized counseling license
  const hasRecognizedLicenseType = CounselingLicenseTypes.includes(primaryLicense.licenseType);

  if (!hasRecognizedLicenseType) {
    return {
      clinicianDid,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      homeState: primaryState,
      licenseType: primaryLicense.licenseType,
      licenseData,
      metadata: {
        reason: `License type '${primaryLicense.licenseType}' is not recognized for Counseling Compact`,
        homeStateIsMember: true,
        hasActiveLicense: true,
        hasRecognizedLicenseType: false,
      },
    };
  }

  // Check license is not expired
  if (primaryLicense.expirationDate) {
    const expirationDate = new Date(primaryLicense.expirationDate);
    const now = new Date();
    if (expirationDate < now) {
      return {
        clinicianDid,
        compactStates: [],
        status: 'NOT_ELIGIBLE',
        homeState: primaryState,
        licenseType: primaryLicense.licenseType,
        licenseData,
        metadata: {
          reason: 'Primary license is expired',
          homeStateIsMember: true,
          hasActiveLicense: false,
          isExpired: true,
        },
      };
    }
  }

  // Clinician is ELIGIBLE for Counseling Compact
  // They can obtain privilege to practice in other compact states
  const compactStates = COUNSELING_COMPACT_STATES.filter((state) => state !== primaryState);

  return {
    clinicianDid,
    compactStates: [...compactStates],
    status: 'ELIGIBLE',
    homeState: primaryState,
    licenseType: primaryLicense.licenseType,
    licenseData,
    metadata: {
      reason: 'Meets Counseling Compact eligibility requirements',
      homeStateIsMember: true,
      hasActiveLicense: true,
      hasRecognizedLicenseType: true,
      eligibleStatesCount: compactStates.length,
    },
  };
}

/**
 * Evaluate detailed Counseling Compact eligibility requirements
 */
export function evaluateCounselingCompactRequirements(
  homeState: string | undefined,
  licenseData: CounselingLicense[]
): CounselingCompactEligibilityRequirements {
  const primaryState = homeState || (licenseData.length > 0 ? licenseData[0].state : '');

  const primaryLicense = licenseData.find(
    (lic) => lic.state === primaryState && lic.status === 'active'
  );

  const hasActiveLicense = !!primaryLicense;
  const homeStateIsCompactMember = !!primaryState && isCounselingCompactState(primaryState);

  // Assume master's degree if licensed (would require additional verification)
  const hasMastersDegree = hasActiveLicense;

  // Assume required experience completed if licensed
  const hasRequiredExperience = hasActiveLicense;

  // Assume national exam passed if licensed
  const hasPassedNationalExam = hasActiveLicense;

  // Check for disciplinary actions (would require additional data)
  const noDisciplinaryActions = true;

  // Background check (would require additional verification)
  const backgroundCheckCompleted = hasActiveLicense;

  return {
    hasActiveLicense,
    homeStateIsCompactMember,
    hasMastersDegree,
    hasRequiredExperience,
    hasPassedNationalExam,
    noDisciplinaryActions,
    backgroundCheckCompleted,
  };
}

/**
 * Check if a clinician can practice counseling in a specific state via compact
 */
export function canPracticeCounselingInState(
  eligibility: CounselingCompactData,
  targetState: string
): boolean {
  if (eligibility.status === 'NOT_ELIGIBLE') return false;
  if (eligibility.homeState === targetState) return true;
  return eligibility.compactStates.includes(targetState);
}

/**
 * Get all states where clinician can practice counseling via compact
 */
export function getCounselingCompactPracticeStates(eligibility: CounselingCompactData): string[] {
  if (eligibility.status === 'NOT_ELIGIBLE') return [];
  const states = eligibility.homeState ? [eligibility.homeState] : [];
  return [...states, ...eligibility.compactStates];
}

/**
 * Check if clinician has active privilege to practice in compact
 */
export function hasActivePrivilege(eligibility: CounselingCompactData): boolean {
  return eligibility.status === 'ACTIVE';
}

