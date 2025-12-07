import type { PredictiveMatchResult } from './predictive';
import { clamp01 } from './features';

export interface HireLikelihoodSignals {
  multiSignalScore: number;
  predictive: PredictiveMatchResult;
  fairnessScore: number;
  marketPressure: number;
  readinessScore: number;
  trustWeight: number;
}

export interface HireLikelihoodResult {
  hireLikelihood: number;
  confidenceBand: {
    lower: number;
    upper: number;
  };
  drivers: string[];
}

const COEFFICIENTS = {
  multiSignal: 0.4,
  predictive: 0.3,
  fairness: 0.15,
  market: 0.1,
  trust: 0.05,
};

const INTERCEPT = -0.1;

export function estimateHireLikelihood(signals: HireLikelihoodSignals): HireLikelihoodResult {
  const normalizedPredictive = clamp01(signals.predictive.predictionScore);
  const normalizedMulti = clamp01(signals.multiSignalScore);
  const fairness = clamp01(signals.fairnessScore);
  const market = clamp01(signals.marketPressure);
  const trust = clamp01(signals.trustWeight);

  const logit =
    INTERCEPT +
    normalizedMulti * COEFFICIENTS.multiSignal +
    normalizedPredictive * COEFFICIENTS.predictive +
    fairness * COEFFICIENTS.fairness +
    market * COEFFICIENTS.market +
    trust * COEFFICIENTS.trust;

  const hireLikelihood = clamp01(sigmoid(logit));
  const variance = 1 - (trust + signals.readinessScore) / 2;
  const spread = clamp01(0.07 + variance * 0.18);
  const confidenceBand = {
    lower: clamp01(hireLikelihood - spread),
    upper: clamp01(hireLikelihood + spread),
  };

  return {
    hireLikelihood,
    confidenceBand,
    drivers: buildDrivers({
      multi: normalizedMulti,
      predictive: normalizedPredictive,
      fairness,
      market,
      trust,
    }),
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value * 4));
}

function buildDrivers(signals: {
  multi: number;
  predictive: number;
  fairness: number;
  market: number;
  trust: number;
}) {
  const drivers: string[] = [];
  if (signals.multi >= 0.8) {
    drivers.push('Multi-signal alignment in top quintile');
  } else if (signals.multi < 0.6) {
    drivers.push('Boost skill/readiness to lift multi-signal baseline');
  }

  if (signals.predictive >= 0.75) {
    drivers.push('Historical hiring telemetry shows strong conversion');
  } else if (signals.predictive < 0.5) {
    drivers.push('Limited back-tested conversion for this cohort');
  }

  if (signals.fairness >= 0.85) {
    drivers.push('Candidate improves fairness guardrail balance');
  } else if (signals.fairness < 0.55) {
    drivers.push('Fairness guardrail dampening applied');
  }

  if (signals.market >= 0.7) {
    drivers.push('High demand market — escalate offers');
  }

  if (signals.trust >= 0.8) {
    drivers.push('Chain-of-trust and PSV telemetry are current');
  }

  return drivers.slice(0, 4);
}


