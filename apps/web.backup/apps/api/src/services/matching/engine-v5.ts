import type { CompatibilityResult } from './engine';
import type { MarketEquilibrium } from './market';
import { clamp01 } from './features';

export interface EhrPrivilegeSignal {
  requiredRoles: string[];
  satisfiedRoles: string[];
  complianceRatio: number;
  blockers: string[];
}

export interface MultiSignalContext {
  compatibility: CompatibilityResult;
  readinessScore?: number;
  trustWeight?: number;
  market: MarketEquilibrium;
  ehr: EhrPrivilegeSignal;
}

export interface MultiSignalComponents {
  skill: number;
  readiness: number;
  trust: number;
  market: number;
  ehr: number;
}

export interface MultiSignalResult {
  version: 'v5';
  finalScore: number;
  components: MultiSignalComponents;
  contributions: MultiSignalComponents;
  weights: MultiSignalComponents;
  metadata: {
    trustWeight: number;
    readinessScore: number;
    marketPressure: MarketEquilibrium['pressure'];
    ehrCompliance: number;
    blockers: string[];
  };
}

const WEIGHTS: MultiSignalComponents = {
  skill: 0.35,
  readiness: 0.2,
  trust: 0.15,
  market: 0.15,
  ehr: 0.15,
};

export function evaluateMultiSignalMatch(context: MultiSignalContext): MultiSignalResult {
  const skillScore = clamp01(context.compatibility.matchScore);
  const readinessScore = clamp01(
    context.readinessScore ?? context.compatibility.featureVector.recency ?? 0.65,
  );
  const trustWeight = clamp01(context.trustWeight ?? deriveTrustWeight(context.compatibility));
  const marketScore = clamp01(context.market.equilibriumScore);
  const ehrScore = clamp01(context.ehr.complianceRatio);

  const contributions: MultiSignalComponents = {
    skill: skillScore * WEIGHTS.skill,
    readiness: readinessScore * WEIGHTS.readiness,
    trust: trustWeight * WEIGHTS.trust,
    market: marketScore * WEIGHTS.market,
    ehr: ehrScore * WEIGHTS.ehr,
  };

  const totalWeight =
    WEIGHTS.skill + WEIGHTS.readiness + WEIGHTS.trust + WEIGHTS.market + WEIGHTS.ehr;
  const finalScore = clamp01(
    (contributions.skill +
      contributions.readiness +
      contributions.trust +
      contributions.market +
      contributions.ehr) /
      totalWeight,
  );

  return {
    version: 'v5',
    finalScore,
    components: {
      skill: skillScore,
      readiness: readinessScore,
      trust: trustWeight,
      market: marketScore,
      ehr: ehrScore,
    },
    contributions,
    weights: WEIGHTS,
    metadata: {
      trustWeight,
      readinessScore,
      marketPressure: context.market.pressure,
      ehrCompliance: ehrScore,
      blockers: context.ehr.blockers,
    },
  };
}

function deriveTrustWeight(compatibility: CompatibilityResult): number {
  const board = compatibility.featureVector.boardStatus ?? 0.5;
  const sanctions = compatibility.featureVector.sanctionsRisk ?? 0.8;
  const recency = compatibility.featureVector.recency ?? 0.6;
  return clamp01(board * 0.45 + sanctions * 0.35 + recency * 0.2);
}


