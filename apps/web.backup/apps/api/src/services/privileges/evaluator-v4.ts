import { evaluateCompetency, type CompetencyEvaluationInput, type CompetencyEvaluationResult } from './competency';
import {
  extractProcedureVolumes,
  type ProcedureVolumeExtractorInput,
  type ProcedureVolumeSummary,
} from './volume';

export interface MultiFactorEvaluatorInput {
  clinicianId: string;
  privilegeCode: string;
  volumeInput: Omit<ProcedureVolumeExtractorInput, 'clinicianId'>;
  competencyInput: Omit<CompetencyEvaluationInput, 'clinicianId' | 'volumeSummary'>;
  sanctionsScore: number;
  npdbScore: number;
  weights?: Partial<FactorWeights>;
  thresholds?: Partial<EligibilityThresholds>;
}

export interface MultiFactorEvaluatorResult {
  clinicianId: string;
  privilegeCode: string;
  eligibility: 'eligible' | 'needs-review' | 'ineligible';
  aggregateScore: number;
  riskCategory: 'green' | 'yellow' | 'orange' | 'red';
  blockers: string[];
  recommendations: string[];
  evaluatedAt: string;
  factors: {
    volume: ProcedureVolumeSummary;
    competency: CompetencyEvaluationResult;
    sanctionsScore: number;
    npdbScore: number;
  };
}

interface FactorWeights {
  volume: number;
  competency: number;
  sanctions: number;
  npdb: number;
}

interface EligibilityThresholds {
  aggregatePass: number;
  yellowFloor: number;
  orangeFloor: number;
  sanctionsMax: number;
  npdbMax: number;
}

const DEFAULT_WEIGHTS: FactorWeights = {
  volume: 0.35,
  competency: 0.35,
  sanctions: 0.15,
  npdb: 0.15,
};

const DEFAULT_THRESHOLDS: EligibilityThresholds = {
  aggregatePass: 0.75,
  yellowFloor: 0.6,
  orangeFloor: 0.45,
  sanctionsMax: 0.65,
  npdbMax: 0.7,
};

export async function evaluatePrivilegeEligibilityV4(
  input: MultiFactorEvaluatorInput,
): Promise<MultiFactorEvaluatorResult> {
  const weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) };

  const volumeSummary = await extractProcedureVolumes({
    clinicianId: input.clinicianId,
    ...input.volumeInput,
  });

  const competency = evaluateCompetency({
    clinicianId: input.clinicianId,
    ...input.competencyInput,
    volumeSummary,
  });

  const sanctionsRisk = clampRisk(input.sanctionsScore);
  const npdbRisk = clampRisk(input.npdbScore);

  const aggregateScore = Number(
    (
      volumeSummary.volumeScore * weights.volume +
      competency.competencyScore * weights.competency +
      (1 - sanctionsRisk) * weights.sanctions +
      (1 - npdbRisk) * weights.npdb
    ).toFixed(3),
  );

  const riskCategory = deriveRiskCategory(aggregateScore, thresholds);
  const blockers = buildBlockers(volumeSummary, competency, sanctionsRisk, npdbRisk, thresholds);
  const eligibility = deriveEligibility(aggregateScore, blockers, sanctionsRisk, npdbRisk, thresholds);
  const recommendations = buildRecommendations(volumeSummary, competency, sanctionsRisk, npdbRisk, input.privilegeCode);

  return {
    clinicianId: input.clinicianId,
    privilegeCode: input.privilegeCode,
    eligibility,
    aggregateScore,
    riskCategory,
    blockers,
    recommendations,
    evaluatedAt: new Date().toISOString(),
    factors: {
      volume: volumeSummary,
      competency,
      sanctionsScore: sanctionsRisk,
      npdbScore: npdbRisk,
    },
  };
}

function clampRisk(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Number(value.toFixed(3))));
}

function deriveRiskCategory(score: number, thresholds: EligibilityThresholds): MultiFactorEvaluatorResult['riskCategory'] {
  if (score >= thresholds.aggregatePass) return 'green';
  if (score >= thresholds.yellowFloor) return 'yellow';
  if (score >= thresholds.orangeFloor) return 'orange';
  return 'red';
}

function deriveEligibility(
  aggregateScore: number,
  blockers: string[],
  sanctionsRisk: number,
  npdbRisk: number,
  thresholds: EligibilityThresholds,
): MultiFactorEvaluatorResult['eligibility'] {
  if (sanctionsRisk >= thresholds.sanctionsMax || npdbRisk >= thresholds.npdbMax) {
    return 'ineligible';
  }
  if (aggregateScore >= thresholds.aggregatePass && blockers.length === 0) {
    return 'eligible';
  }
  if (aggregateScore < thresholds.orangeFloor || blockers.length > 2) {
    return 'ineligible';
  }
  return 'needs-review';
}

function buildBlockers(
  volume: ProcedureVolumeSummary,
  competency: CompetencyEvaluationResult,
  sanctionsRisk: number,
  npdbRisk: number,
  thresholds: EligibilityThresholds,
): string[] {
  const blockers = new Set<string>();
  volume.missingProcedures.forEach((missing) => blockers.add(missing));
  competency.missingCompetencies.forEach((missing) => blockers.add(missing));

  if (sanctionsRisk >= thresholds.sanctionsMax) {
    blockers.add(`Sanctions risk ${Math.round(sanctionsRisk * 100)}% exceeds allowed threshold`);
  }
  if (npdbRisk >= thresholds.npdbMax) {
    blockers.add(`NPDB risk ${Math.round(npdbRisk * 100)}% exceeds allowed threshold`);
  }

  return Array.from(blockers);
}

function buildRecommendations(
  volume: ProcedureVolumeSummary,
  competency: CompetencyEvaluationResult,
  sanctionsRisk: number,
  npdbRisk: number,
  privilegeCode: string,
): string[] {
  const recommendations: string[] = [];

  if (volume.volumeScore < 0.7) {
    recommendations.push(`Collect additional case logs for ${privilegeCode} (volume score ${Math.round(volume.volumeScore * 100)}%)`);
  }
  if (competency.trainingStatus.missing.length) {
    competency.trainingStatus.missing.forEach((training) => {
      recommendations.push(`Assign remedial training: ${training}`);
    });
  }
  if (competency.boardStatus.expiringBoards.length) {
    recommendations.push(`Renew expiring boards: ${competency.boardStatus.expiringBoards.join(', ')}`);
  }
  if (sanctionsRisk > 0.4 || npdbRisk > 0.45) {
    recommendations.push('Route to compliance analyst for sanctions/NPDB attestation.');
  }
  if (!recommendations.length) {
    recommendations.push('Proceed to committee packet generation.');
  }

  return recommendations;
}










