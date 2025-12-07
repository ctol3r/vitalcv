export interface MobilityScoreInput {
  licenseCount: number;
  compactEligibleCount: number;
  reciprocityReadyCount: number;
}

export interface ScoreComponent {
  label: string;
  value: number;
  weight: number;
  normalized: number;
  contribution: number;
}

export interface MobilityScoreBreakdown {
  total: number;
  max: number;
  version: string;
  computedAt: string;
  components: {
    licenseBreadth: ScoreComponent;
    compacts: ScoreComponent;
    globalEquivalency: ScoreComponent;
  };
}

const SCORE_VERSION = '2025.11';
const LICENSE_WEIGHT = 0.45;
const COMPACT_WEIGHT = 0.35;
const GLOBAL_WEIGHT = 0.2;

export function calculateMobilityScore(input: MobilityScoreInput): MobilityScoreBreakdown {
  const licenseNormalized = Math.min(input.licenseCount / 10, 1);
  const compactNormalized = Math.min(input.compactEligibleCount / 5, 1);
  const globalNormalized = Math.min(input.reciprocityReadyCount / 3, 1);

  const licenseContribution = roundContribution(licenseNormalized * LICENSE_WEIGHT);
  const compactContribution = roundContribution(compactNormalized * COMPACT_WEIGHT);
  const globalContribution = roundContribution(globalNormalized * GLOBAL_WEIGHT);

  const totalScore = Math.round((licenseContribution + compactContribution + globalContribution) * 100);

  return {
    total: Math.max(Math.min(totalScore, 100), 0),
    max: 100,
    version: SCORE_VERSION,
    computedAt: new Date().toISOString(),
    components: {
      licenseBreadth: {
        label: 'License breadth',
        value: input.licenseCount,
        weight: LICENSE_WEIGHT,
        normalized: licenseNormalized,
        contribution: licenseContribution,
      },
      compacts: {
        label: 'Compact coverage',
        value: input.compactEligibleCount,
        weight: COMPACT_WEIGHT,
        normalized: compactNormalized,
        contribution: compactContribution,
      },
      globalEquivalency: {
        label: 'Global equivalency',
        value: input.reciprocityReadyCount,
        weight: GLOBAL_WEIGHT,
        normalized: globalNormalized,
        contribution: globalContribution,
      },
    },
  };
}

function roundContribution(value: number): number {
  return Math.round(value * 1000) / 1000;
}









