import type { CompactsStatusData } from '../../compacts/models/CompactsStatus.js';
import type {
  ClinicianCompactProfile,
  CompactType,
  PracticeEligibilityResult,
} from '../../compacts/eligibilityEngine.js';
import { evaluatePracticeEligibility } from '../../compacts/eligibilityEngine.js';
import { buildClinicianProfileFromStatus } from '../../compacts/profileAdapter.js';

const SUPPORTED_COMPACT_TYPES: CompactType[] = ['IMLC', 'PSYPACT', 'NLC', 'APRN', 'PT'];

function hasCompactData(profile: ClinicianCompactProfile, compactType: CompactType): boolean {
  if (!profile.compacts) return false;

  switch (compactType) {
    case 'IMLC':
      return !!profile.compacts.imlc;
    case 'PSYPACT':
      return !!profile.compacts.psypact;
    case 'NLC':
      return !!profile.compacts.nlc;
    case 'APRN':
      return !!profile.compacts.aprn;
    case 'PT':
      return !!profile.compacts.pt;
    default:
      return false;
  }
}

export function evaluateCompactRuleWithProfile(
  profile: ClinicianCompactProfile,
  compactType: CompactType,
  targetState: string
): PracticeEligibilityResult | null {
  if (!SUPPORTED_COMPACT_TYPES.includes(compactType)) return null;
  if (!hasCompactData(profile, compactType)) return null;
  return evaluatePracticeEligibility(compactType, profile, targetState);
}

export function evaluateCompactRule(
  compactsStatus: CompactsStatusData,
  compactType: CompactType,
  targetState: string,
  overrides?: Partial<ClinicianCompactProfile>
): PracticeEligibilityResult | null {
  const profile = buildClinicianProfileFromStatus(compactsStatus, overrides);
  return evaluateCompactRuleWithProfile(profile, compactType, targetState);
}

export { buildClinicianProfileFromStatus } from '../../compacts/profileAdapter.js';

