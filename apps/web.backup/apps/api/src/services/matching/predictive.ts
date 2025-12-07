import { clamp01 } from './features';

export interface PredictiveInput {
  readinessScore: number;
  scheduleFit: number;
  fairnessScore: number;
  historicalSuccessRate: number;
  signalVolatility?: number;
}

export interface PredictiveRationale {
  contributions: {
    readiness: number;
    schedule: number;
    fairness: number;
    history: number;
  };
  confidenceBand: {
    lower: number;
    upper: number;
  };
  factors: string[];
  metadata: Record<string, unknown>;
}

export interface PredictiveMatchResult {
  predictionScore: number;
  rationale: PredictiveRationale;
}

export const PREDICTIVE_WEIGHTS = {
  readiness: 0.35,
  schedule: 0.25,
  fairness: 0.15,
  history: 0.25,
} as const;

export function buildPredictiveScore(input: PredictiveInput): PredictiveMatchResult {
  const readiness = clamp01(input.readinessScore);
  const schedule = clamp01(input.scheduleFit);
  const fairness = clamp01(input.fairnessScore);
  const history = clamp01(input.historicalSuccessRate);
  const volatility = clamp01(input.signalVolatility ?? 0.08);

  const contributions = {
    readiness: readiness * PREDICTIVE_WEIGHTS.readiness,
    schedule: schedule * PREDICTIVE_WEIGHTS.schedule,
    fairness: fairness * PREDICTIVE_WEIGHTS.fairness,
    history: history * PREDICTIVE_WEIGHTS.history,
  };

  const totalWeight =
    PREDICTIVE_WEIGHTS.readiness +
    PREDICTIVE_WEIGHTS.schedule +
    PREDICTIVE_WEIGHTS.fairness +
    PREDICTIVE_WEIGHTS.history;
  const aggregate = (contributions.readiness +
    contributions.schedule +
    contributions.fairness +
    contributions.history) /
    totalWeight;

  const volatilityDiscount = 1 - volatility * 0.35;
  const predictionScore = clamp01(aggregate * volatilityDiscount + fairness * 0.05);

  const confidenceBand = buildConfidenceBand(predictionScore, volatility);
  const factors = buildFactorSummary(readiness, schedule, fairness, history);

  return {
    predictionScore,
    rationale: {
      contributions,
      confidenceBand,
      factors,
      metadata: {
        volatility,
        weights: PREDICTIVE_WEIGHTS,
      },
    },
  };
}

function buildConfidenceBand(score: number, volatility: number) {
  const spread = Math.max(0.05, volatility * 0.4);
  return {
    lower: clamp01(score - spread),
    upper: clamp01(score + spread),
  };
}

function buildFactorSummary(
  readiness: number,
  schedule: number,
  fairness: number,
  history: number,
): string[] {
  const summary: string[] = [];
  if (readiness >= 0.8) {
    summary.push('Readiness stack is production-ready');
  } else if (readiness < 0.55) {
    summary.push('Readiness remediation required before deployment');
  }

  if (schedule >= 0.75) {
    summary.push('Schedule and commute alignment confirmed');
  } else if (schedule < 0.5) {
    summary.push('Schedule friction detected');
  }

  if (fairness >= 0.85) {
    summary.push('Improves fairness balance for this requisition');
  } else if (fairness < 0.5) {
    summary.push('Approaching Title VII decision boundary');
  }

  if (history >= 0.7) {
    summary.push('Strong historical hiring success for similar profiles');
  } else {
    summary.push('Limited back-tested success for this cohort');
  }

  return summary;
}


