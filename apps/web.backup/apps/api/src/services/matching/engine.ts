import type { FeatureContext, FeatureVector } from './features';
import { buildFeatureVector, clamp01 } from './features';

export interface MatchingWeights {
  specialty: number;
  experience: number;
  compact: number;
  sanctions: number;
  recency: number;
}

export interface MatchRationale {
  keyFactors: Array<{
    label: string;
    detail: string;
    impact: 'positive' | 'neutral' | 'warning';
  }>;
  contributions: Record<keyof MatchingWeights | 'board', number>;
  compact?: {
    eligibleStates: string[];
    message: string;
    status: 'ready' | 'missing' | 'encouraged';
  };
  specialty?: {
    clinician: string;
    job: string;
    overlap: number;
  };
}

export interface CompatibilityResult {
  matchScore: number;
  featureVector: FeatureVector;
  rationale: MatchRationale;
}

export const DEFAULT_WEIGHTS: MatchingWeights = {
  specialty: 0.3,
  experience: 0.25,
  compact: 0.15,
  sanctions: 0.2,
  recency: 0.1,
};

export function evaluateCompatibility(
  context: FeatureContext,
  weights: MatchingWeights = DEFAULT_WEIGHTS,
): CompatibilityResult {
  const features = buildFeatureVector(context);
  const specialtyComposite = clamp01(features.specialtyMatch * 0.7 + features.boardStatus * 0.3);

  const contributions = {
    specialty: specialtyComposite * weights.specialty,
    experience: features.experience * weights.experience,
    compact: features.compactFit * weights.compact,
    sanctions: features.sanctionsRisk * weights.sanctions,
    recency: features.recency * weights.recency,
    board: features.boardStatus * (weights.specialty * 0.3),
  };

  const weightedTotal =
    contributions.specialty +
    contributions.experience +
    contributions.compact +
    contributions.sanctions +
    contributions.recency;

  const weightSum =
    weights.specialty + weights.experience + weights.compact + weights.sanctions + weights.recency;

  const matchScore = clamp01(weightSum > 0 ? weightedTotal / weightSum : 0);

  return {
    matchScore,
    featureVector: features,
    rationale: buildRationale(context, features, contributions),
  };
}

function buildRationale(
  context: FeatureContext,
  features: FeatureVector,
  contributions: MatchRationale['contributions'],
): MatchRationale {
  const keyFactors: MatchRationale['keyFactors'] = [];

  if (features.specialtyMatch >= 0.9) {
    keyFactors.push({
      label: 'Specialty alignment',
      detail: `Primary specialty matches ${context.job.specialty}.`,
      impact: 'positive',
    });
  } else if (features.specialtyMatch >= 0.7) {
    keyFactors.push({
      label: 'Adjacent specialty fit',
      detail: `Clinician has recent experience adjacent to ${context.job.specialty}.`,
      impact: 'neutral',
    });
  } else {
    keyFactors.push({
      label: 'Specialty gap',
      detail: `Limited evidence of ${context.job.specialty} procedures.`,
      impact: 'warning',
    });
  }

  if (features.compactFit >= 0.9) {
    keyFactors.push({
      label: 'Compact portability',
      detail: 'Compact credentialing unlocks multi-state coverage.',
      impact: 'positive',
    });
  } else if (features.compactFit <= 0.4) {
    keyFactors.push({
      label: 'State license constraint',
      detail: 'No compact leverage detected; expect local onboarding.',
      impact: 'warning',
    });
  }

  if (features.sanctionsRisk < 0.6) {
    keyFactors.push({
      label: 'Sanctions history',
      detail: 'Recent sanctions require escalation review.',
      impact: 'warning',
    });
  }

  if (features.recency < 0.6) {
    keyFactors.push({
      label: 'Verification recency',
      detail: 'Last PSV is older than six months.',
      impact: 'warning',
    });
  }

  if (keyFactors.length < 3 && features.experience >= 0.7) {
    keyFactors.push({
      label: 'Experience depth',
      detail: `Exceeds ${context.job.minYearsExperience ?? 'target'} year requirement.`,
      impact: 'positive',
    });
  }

  const compactStates = context.clinician.compactEligibleStates ?? [];
  const compactRationale =
    compactStates.length === 0
      ? {
          eligibleStates: [],
          message: 'No compact states on file',
          status: 'missing' as const,
        }
      : features.compactFit >= 0.9
        ? {
            eligibleStates: compactStates,
            message: `Portable to ${compactStates.length} compact states.`,
            status: 'ready' as const,
          }
        : {
            eligibleStates: compactStates,
            message: 'Compact eligibility exists but job prefers local licenses.',
            status: 'encouraged' as const,
          };

  return {
    keyFactors,
    contributions,
    compact: compactRationale,
    specialty: {
      clinician: context.clinician.primarySpecialty,
      job: context.job.specialty,
      overlap: features.specialtyMatch,
    },
  };
}










