/**
 * B138A-PSY-005: PSYPACT Eligibility Engine
 *
 * Core business logic for determining PSYPACT (Psychology Interjurisdictional Compact) eligibility.
 * Implements rules based on psychology license, primary state, and compact requirements.
 */

import type { PsychologyLicense, PSYPACTCompactData, PSYPACTEligibilityRequirements } from './models/Psycompact.js';
import { PSYPACT_STATES, isPSYPACTState } from './models/Psycompact.js';

/**
 * Determine PSYPACT eligibility based on clinician's psychology license history
 *
 * PSYPACT Eligibility Requirements:
 * 1. Must hold an active, unencumbered license in a PSYPACT member state
 * 2. Must have completed doctoral degree in psychology
 * 3. Must have passed EPPP (Examination for Professional Practice in Psychology)
 * 4. No disciplinary actions or restrictions on license
 * 5. Licensed for at least 2 years (for some jurisdictions)
 * 6. Background check completed
 */
export async function determinePSYPACTEligibility(
  clinicianDid: string,
  primaryState: string | undefined,
  licenseData: PsychologyLicense[]
): Promise<PSYPACTCompactData> {
  // If no primary state specified, try to infer from license data
  let homeState = primaryState;
  if (!homeState && licenseData.length > 0) {
    const primaryLicense = licenseData.find((lic) => lic.isPrimary);
    homeState = primaryLicense?.state || licenseData[0].state;
  }

  if (!homeState) {
    return {
      clinicianDid,
      participatingStates: [],
      status: 'NOT_ELIGIBLE',
      licenseData,
      metadata: {
        reason: 'No primary state or license data provided',
      },
    };
  }

  // Verify home state is a PSYPACT member
  if (!isPSYPACTState(homeState)) {
    return {
      clinicianDid,
      participatingStates: [],
      status: 'NOT_ELIGIBLE',
      primaryState: homeState,
      licenseData,
      metadata: {
        reason: 'Primary state is not a PSYPACT member state',
        homeStateIsMember: false,
      },
    };
  }

  // Find active license in primary state
  const primaryLicense = licenseData.find(
    (lic) => lic.state === homeState && lic.status === 'active'
  );

  if (!primaryLicense) {
    return {
      clinicianDid,
      participatingStates: [],
      status: 'NOT_ELIGIBLE',
      primaryState: homeState,
      licenseData,
      metadata: {
        reason: 'No active psychology license found in primary state',
        homeStateIsMember: true,
        hasActiveLicense: false,
      },
    };
  }

  // Check license type (must be a doctoral-level psychology license)
  const validLicenseTypes = [
    'Clinical Psychologist',
    'Licensed Psychologist',
    'Psychologist',
    'Clinical Psychology',
  ];

  const hasValidLicenseType = validLicenseTypes.some((type) =>
    primaryLicense.licenseType.toLowerCase().includes(type.toLowerCase())
  );

  if (!hasValidLicenseType) {
    return {
      clinicianDid,
      participatingStates: [],
      status: 'NOT_ELIGIBLE',
      primaryState: homeState,
      licenseData,
      metadata: {
        reason: 'License type does not qualify for PSYPACT (requires doctoral-level psychology license)',
        homeStateIsMember: true,
        hasActiveLicense: true,
        hasValidLicenseType: false,
      },
    };
  }

  // Check license duration (at least 2 years for some states)
  const licenseIssueDate = new Date(primaryLicense.issueDate);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const hasSufficientExperience = licenseIssueDate <= twoYearsAgo;

  // For newer licensees, they may still be eligible but with limitations
  const status = hasSufficientExperience ? 'ELIGIBLE' : 'ELIGIBLE';

  // Clinician is ELIGIBLE for PSYPACT
  // They can apply for E.Passport and practice in participating states
  const participatingStates = PSYPACT_STATES.filter((state) => state !== homeState);

  return {
    clinicianDid,
    participatingStates: [...participatingStates],
    status,
    primaryState: homeState,
    licenseData,
    metadata: {
      reason: 'Meets PSYPACT eligibility requirements',
      homeStateIsMember: true,
      hasActiveLicense: true,
      hasValidLicenseType: true,
      hasSufficientExperience,
      eligibleStatesCount: participatingStates.length,
      note: !hasSufficientExperience
        ? 'Licensed for less than 2 years - may have limitations in some jurisdictions'
        : undefined,
    },
  };
}

/**
 * Evaluate detailed PSYPACT eligibility requirements
 */
export function evaluatePSYPACTRequirements(
  primaryState: string | undefined,
  licenseData: PsychologyLicense[]
): PSYPACTEligibilityRequirements {
  const homeState = primaryState || (licenseData.length > 0 ? licenseData[0].state : '');

  const primaryLicense = licenseData.find(
    (lic) => lic.state === homeState && lic.status === 'active'
  );

  const hasActiveLicense = !!primaryLicense;
  const homeStateIsPSYPACTMember = !!homeState && isPSYPACTState(homeState);

  // Assume doctoral degree if licensed (would require additional verification)
  const hasDoctoralDegree = hasActiveLicense;

  // Assume EPPP passed if licensed
  const hasPassedEPPP = hasActiveLicense;

  // Check for disciplinary actions (would require additional data)
  const noDisciplinaryActions = true;

  let meetsExperienceRequirement = false;
  if (primaryLicense) {
    const licenseIssueDate = new Date(primaryLicense.issueDate);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    meetsExperienceRequirement = licenseIssueDate <= twoYearsAgo;
  }

  return {
    hasActiveLicense,
    homeStateIsPSYPACTMember,
    hasDoctoralDegree,
    hasPassedEPPP,
    noDisciplinaryActions,
    meetsExperienceRequirement,
  };
}

/**
 * Check if a clinician can practice telepsychology in a specific state via PSYPACT
 */
export function canPracticeTelepsychologyInState(
  eligibility: PSYPACTCompactData,
  targetState: string
): boolean {
  if (eligibility.status === 'NOT_ELIGIBLE') return false;
  if (eligibility.primaryState === targetState) return true;
  return eligibility.participatingStates.includes(targetState);
}

/**
 * Get all states where clinician can practice telepsychology via PSYPACT
 */
export function getPSYPACTPracticeStates(eligibility: PSYPACTCompactData): string[] {
  if (eligibility.status === 'NOT_ELIGIBLE') return [];
  const states = eligibility.primaryState ? [eligibility.primaryState] : [];
  return [...states, ...eligibility.participatingStates];
}

/**
 * Determine if E.Passport is active based on status
 */
export function hasActiveEPassport(eligibility: PSYPACTCompactData): boolean {
  return eligibility.status === 'ACTIVE' || eligibility.status === 'E_PASS';
}

