/**
 * B212B-ENROLL-007: State-Specific Medicaid Rules
 *
 * Defines which states require Medicaid enrollment for major specialties.
 * Failing state-required Medicaid drops completeness score.
 */

export type StateCode = string;

export type SpecialtyCode = string;

/**
 * Major specialties that typically require Medicaid enrollment in certain states
 */
export const MAJOR_SPECIALTIES: SpecialtyCode[] = [
  '207R00000X', // Internal Medicine
  '208D00000X', // General Practice
  '208M00000X', // Hospitalist
  '208000000X', // Pediatrics
  '207Q00000X', // Family Medicine
  '207T00000X', // Emergency Medicine
  '207L00000X', // Anesthesiology
  '207N00000X', // Dermatology
  '207W00000X', // Obstetrics & Gynecology
  '207P00000X', // Emergency Medicine
];

/**
 * States that typically require Medicaid enrollment for major specialties
 */
export const MEDICAID_REQUIRED_STATES: StateCode[] = ['CA', 'TX', 'FL', 'NY', 'WA'];

/**
 * State-specific Medicaid requirements
 * Key: State code, Value: Array of specialty codes that require Medicaid
 * If specialty array is empty, all major specialties require Medicaid
 */
export const STATE_MEDICAID_REQUIREMENTS: Record<StateCode, SpecialtyCode[] | 'ALL'> = {
  CA: 'ALL', // California: All major specialties require Medicaid
  TX: 'ALL', // Texas: All major specialties require Medicaid
  FL: 'ALL', // Florida: All major specialties require Medicaid
  NY: 'ALL', // New York: All major specialties require Medicaid
  WA: 'ALL', // Washington: All major specialties require Medicaid
};

/**
 * Check if a state requires Medicaid enrollment for a given specialty
 */
export function requiresMedicaidForSpecialty(
  state: StateCode,
  specialty: SpecialtyCode | null | undefined
): boolean {
  const normalizedState = state.toUpperCase();

  // Check if state is in the required list
  if (!MEDICAID_REQUIRED_STATES.includes(normalizedState)) {
    return false;
  }

  const requirement = STATE_MEDICAID_REQUIREMENTS[normalizedState];

  // If requirement is 'ALL', all major specialties require Medicaid
  if (requirement === 'ALL') {
    if (!specialty) return false;
    return MAJOR_SPECIALTIES.includes(specialty);
  }

  // If requirement is an array, check if specialty is in the list
  if (Array.isArray(requirement)) {
    if (!specialty) return false;
    return requirement.includes(specialty);
  }

  return false;
}

/**
 * Check if a state requires Medicaid enrollment at all
 */
export function stateRequiresMedicaid(state: StateCode): boolean {
  return MEDICAID_REQUIRED_STATES.includes(state.toUpperCase());
}

/**
 * Get the penalty multiplier for missing required Medicaid enrollment
 * Returns a value between 0 and 1, where 1 means no penalty and 0 means maximum penalty
 */
export function getMedicaidPenaltyMultiplier(
  state: StateCode,
  specialty: SpecialtyCode | null | undefined,
  hasMedicaidEnrollment: boolean
): number {
  if (!requiresMedicaidForSpecialty(state, specialty)) {
    return 1.0; // No penalty if not required
  }

  if (hasMedicaidEnrollment) {
    return 1.0; // No penalty if enrolled
  }

  // Missing required Medicaid drops completeness significantly
  return 0.3; // 70% penalty
}

