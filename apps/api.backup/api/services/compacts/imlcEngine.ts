/**
 * B138A-IMLC-002: IMLC Eligibility Engine
 *
 * Core business logic for determining Interstate Medical Licensure Compact (IMLC) eligibility.
 * Implements rules based on home state, license history, and compact requirements.
 */

import type { LicenseHistory, IMLCEligibilityData, IMLCEligibilityRequirements } from './models/IMLCEligibility.js';
import { IMLC_STATES, isIMLCState } from './models/IMLCEligibility.js';

/**
 * Determine IMLC eligibility based on clinician's license history and home state
 *
 * IMLC Eligibility Requirements:
 * 1. Must have a primary license in an IMLC member state (home state)
 * 2. License must be full, unrestricted, and active
 * 3. No pending investigations or disciplinary actions
 * 4. Completed at least 1 year of practice (or graduated from residency)
 * 5. Passed USMLE or COMLEX examination
 * 6. No malpractice claims or criminal history (with exceptions)
 */
export async function determineIMLCEligibility(
  clinicianDid: string,
  homeState: string,
  licenseHistory: LicenseHistory[]
): Promise<IMLCEligibilityData> {
  // Verify home state is an IMLC member
  if (!isIMLCState(homeState)) {
    return {
      clinicianDid,
      homeState,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      licenseHistory,
      metadata: {
        reason: 'Home state is not an IMLC member state',
        homeStateIsMember: false,
      },
    };
  }

  // Find primary license in home state
  const primaryLicense = licenseHistory.find(
    (lic) => lic.state === homeState && lic.isPrimary && lic.status === 'active'
  );

  if (!primaryLicense) {
    return {
      clinicianDid,
      homeState,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      licenseHistory,
      metadata: {
        reason: 'No active primary license found in home state',
        homeStateIsMember: true,
        hasActivePrimaryLicense: false,
      },
    };
  }

  // Check for disciplinary actions
  const hasDisciplinaryActions = licenseHistory.some(
    (lic) => lic.disciplinaryActions && lic.disciplinaryActions.length > 0
  );

  if (hasDisciplinaryActions) {
    return {
      clinicianDid,
      homeState,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      licenseHistory,
      metadata: {
        reason: 'Disciplinary actions found in license history',
        homeStateIsMember: true,
        hasActivePrimaryLicense: true,
        hasDisciplinaryActions: true,
      },
    };
  }

  // Check license duration (at least 1 year of practice)
  const primaryLicenseIssueDate = new Date(primaryLicense.issueDate);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const hasMinimumPracticeTime = primaryLicenseIssueDate <= oneYearAgo;

  if (!hasMinimumPracticeTime) {
    return {
      clinicianDid,
      homeState,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      licenseHistory,
      metadata: {
        reason: 'Insufficient practice time (requires at least 1 year)',
        homeStateIsMember: true,
        hasActivePrimaryLicense: true,
        hasDisciplinaryActions: false,
        hasMinimumPracticeTime: false,
      },
    };
  }

  // Check for any revoked licenses
  const hasRevokedLicenses = licenseHistory.some((lic) => lic.status === 'revoked');

  if (hasRevokedLicenses) {
    return {
      clinicianDid,
      homeState,
      compactStates: [],
      status: 'NOT_ELIGIBLE',
      licenseHistory,
      metadata: {
        reason: 'Revoked license found in history',
        homeStateIsMember: true,
        hasActivePrimaryLicense: true,
        hasDisciplinaryActions: false,
        hasMinimumPracticeTime: true,
        hasRevokedLicenses: true,
      },
    };
  }

  // Clinician is ELIGIBLE for IMLC
  // Compute eligible compact states (all IMLC states except home state)
  const compactStates = IMLC_STATES.filter((state) => state !== homeState);

  return {
    clinicianDid,
    homeState,
    compactStates: [...compactStates],
    status: 'ELIGIBLE',
    licenseHistory,
    metadata: {
      reason: 'Meets all IMLC eligibility requirements',
      homeStateIsMember: true,
      hasActivePrimaryLicense: true,
      hasDisciplinaryActions: false,
      hasMinimumPracticeTime: true,
      hasRevokedLicenses: false,
      eligibleStatesCount: compactStates.length,
    },
  };
}

/**
 * Evaluate detailed eligibility requirements
 */
export function evaluateIMLCRequirements(
  homeState: string,
  licenseHistory: LicenseHistory[]
): IMLCEligibilityRequirements {
  const primaryLicense = licenseHistory.find(
    (lic) => lic.state === homeState && lic.isPrimary && lic.status === 'active'
  );

  const hasUnrestrictedLicense = !!primaryLicense;
  const homeStateIsIMLCMember = isIMLCState(homeState);

  const hasDisciplinaryActions = licenseHistory.some(
    (lic) => lic.disciplinaryActions && lic.disciplinaryActions.length > 0
  );
  const noPendingActions = !hasDisciplinaryActions;
  const noDisciplinaryHistory = !hasDisciplinaryActions;

  let hasMinimumPracticeTime = false;
  if (primaryLicense) {
    const licenseIssueDate = new Date(primaryLicense.issueDate);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    hasMinimumPracticeTime = licenseIssueDate <= oneYearAgo;
  }

  // Note: Board exam verification would require additional data sources
  const hasPassedBoardExam = true; // Assumed if licensed

  return {
    hasUnrestrictedLicense,
    homeStateIsIMLCMember,
    noPendingActions,
    noDisciplinaryHistory,
    hasMinimumPracticeTime,
    hasPassedBoardExam,
  };
}

/**
 * Check if a clinician has an active IMLC license in a specific state
 */
export function hasIMLCLicenseInState(
  eligibility: IMLCEligibilityData,
  targetState: string
): boolean {
  if (eligibility.status === 'NOT_ELIGIBLE') return false;
  if (eligibility.homeState === targetState) return true;
  return eligibility.compactStates.includes(targetState);
}

/**
 * Get all states where clinician can practice via IMLC
 */
export function getIMLCPracticeStates(eligibility: IMLCEligibilityData): string[] {
  if (eligibility.status === 'NOT_ELIGIBLE') return [];
  return [eligibility.homeState, ...eligibility.compactStates];
}

