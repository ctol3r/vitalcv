/**
 * Canonical VitalCV demo profiles - single source of truth.
 *
 * Rules:
 * - Only use sources that are actually integrated (NPPES, OIG/LEIE, PECOS)
 * - Gated sources (Nursys, FSMB) shown as "access required" not "missing"
 * - DEA, ABMS, NPDB never appear as integration sources
 * - These profiles are structurally representative of real data shapes
 *
 * ACTION REQUIRED: apps/web/components/hero/ReadinessPreview.tsx DEMO_PROFILES
 * currently list "DEA (CA)" and "Board cert renewal" as missing items.
 * Those must be replaced with correct sources after UX-2 commits (file owned by UX-2).
 * Use this file as the reference for what the correct profiles should look like.
 */

export interface DemoProfile {
  npi: string;
  name: string;
  specialty: string;
  readiness: 'READY' | 'PARTIAL' | 'BLOCKED';
  readinessScore: number;
  verifiedItems: string[];
  missingItems: string[];
  gatedItems: string[];
  blockers: string[];
  estimatedStart: string;
  sources: {
    nppes: { status: 'checked'; npiVerified: boolean };
    oigLeie: { status: 'checked'; exclusionClear: boolean };
    pecos: { status: 'checked' | 'previewOnly'; enrolled: boolean };
    nursys: { status: 'access-required' };
    fsmb: { status: 'access-required' };
  };
}

export const DEMO_PROFILES: Record<string, DemoProfile> = {
  '1003000126': {
    npi: '1003000126',
    name: 'Sarah Chen, MD',
    specialty: 'Internal Medicine',
    readiness: 'READY',
    readinessScore: 87,
    verifiedItems: ['NPI identity checked', 'OIG / LEIE checked', 'Medicare enrolled'],
    missingItems: [],
    gatedItems: ['State license - Nursys (access required)', 'FSMB board history (access required)'],
    blockers: [],
    estimatedStart: '7-14 days',
    sources: {
      nppes: { status: 'checked', npiVerified: true },
      oigLeie: { status: 'checked', exclusionClear: true },
      pecos: { status: 'previewOnly', enrolled: true },
      nursys: { status: 'access-required' },
      fsmb: { status: 'access-required' },
    },
  },
  '1942788324': {
    npi: '1942788324',
    name: 'Marcus Williams, DO',
    specialty: 'Emergency Medicine',
    readiness: 'PARTIAL',
    readinessScore: 54,
    verifiedItems: ['NPI identity checked', 'OIG / LEIE checked'],
    missingItems: ['Medicare enrollment not found - submit PECOS enrollment (45-60 days)'],
    gatedItems: ['State license - Nursys (access required)', 'FSMB board history (access required)'],
    blockers: ['Medicare enrollment not found'],
    estimatedStart: '45-60 days',
    sources: {
      nppes: { status: 'checked', npiVerified: true },
      oigLeie: { status: 'checked', exclusionClear: true },
      pecos: { status: 'previewOnly', enrolled: false },
      nursys: { status: 'access-required' },
      fsmb: { status: 'access-required' },
    },
  },
  '1841498016': {
    npi: '1841498016',
    name: 'Priya Nair, MD',
    specialty: 'Hospitalist',
    readiness: 'BLOCKED',
    readinessScore: 12,
    verifiedItems: ['NPI identity checked'],
    missingItems: [],
    gatedItems: ['State license - Nursys (access required)', 'FSMB board history (access required)'],
    blockers: ['OIG / LEIE exclusion flag detected - provider is excluded from federal programs'],
    estimatedStart: 'Not ready',
    sources: {
      nppes: { status: 'checked', npiVerified: true },
      oigLeie: { status: 'checked', exclusionClear: false },
      pecos: { status: 'previewOnly', enrolled: false },
      nursys: { status: 'access-required' },
      fsmb: { status: 'access-required' },
    },
  },
};

export const DEMO_FALLBACK: DemoProfile = DEMO_PROFILES['1942788324'];

/** Returns the demo profile for an NPI, or the fallback profile. */
export function getDemoProfile(npi: string): DemoProfile {
  return DEMO_PROFILES[npi] ?? DEMO_FALLBACK;
}

// INTEGRATION PLAN: Once UX-2 commits (hero/ReadinessPreview.tsx), update its
// DEMO_PROFILES to use these NPI keys and corrected missing/gated item lists.
// Key changes needed:
//   - '1234567890' -> use NPI '1003000126' profile (Sarah Chen)
//   - '9876543210' -> use NPI '1942788324' profile (Marcus Williams)
//   - '1111111111' -> use NPI '1841498016' profile (Priya Nair)
//   - Remove all DEA references (not integrated)
//   - Replace 'Board cert renewal' with 'FSMB board history (access required)'
