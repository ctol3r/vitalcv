import type { ChainMetrics } from '@prisma/client';
import type { ValidatorHealthOverview } from '../../services/chain/client';
import type { ValidatorQuorumReport } from './types';

export interface QuorumCalculatorOptions {
  overview?: ValidatorHealthOverview | null;
  metrics?: Array<Pick<ChainMetrics, 'blockTimeMs' | 'capturedAt'>>;
  finalityTarget?: number;
  blockTimeBudgetMs?: number;
}

const DEFAULT_FINALITY_TARGET = 0.95;
const DEFAULT_BLOCK_TIME_BUDGET = 8_000;

export function calculateValidatorQuorum(options: QuorumCalculatorOptions = {}): ValidatorQuorumReport {
  const overview = options.overview ?? null;
  const validators = overview?.validators ?? [];
  const activeValidators = validators.filter((validator) => validator.status === 'active').length;
  const totalValidators = validators.length || (overview ? 1 : 0);
  const quorumThreshold = totalValidators ? Math.ceil(totalValidators * 0.67) : 1;
  const finalityRatio =
    overview && overview.blockHeight > 0
      ? clamp(overview.finalizedHeight / overview.blockHeight, 0, 1)
      : 0;
  const blockTimeAvg = computeAverageBlockTime(options.metrics) ?? DEFAULT_BLOCK_TIME_BUDGET;
  const windowMinutes = computeWindowMinutes(options.metrics);
  const sampleSize = options.metrics?.length ?? 0;
  const finalityTarget = options.finalityTarget ?? DEFAULT_FINALITY_TARGET;
  const blockTimeBudget = options.blockTimeBudgetMs ?? DEFAULT_BLOCK_TIME_BUDGET;

  const quorumMet =
    activeValidators >= quorumThreshold &&
    finalityRatio >= finalityTarget &&
    blockTimeAvg <= blockTimeBudget;

  return {
    activeValidators,
    totalValidators,
    finalityRatio: Number(finalityRatio.toFixed(4)),
    blockTimeAvg,
    quorumMet,
    windowMinutes,
    sampleSize,
  };
}

function computeAverageBlockTime(
  metrics: Array<Pick<ChainMetrics, 'blockTimeMs'>> = [],
): number | null {
  if (!metrics.length) return null;
  const sum = metrics.reduce((acc, metric) => acc + metric.blockTimeMs, 0);
  return Math.round(sum / metrics.length);
}

function computeWindowMinutes(
  metrics: Array<Pick<ChainMetrics, 'capturedAt'>> = [],
): number {
  if (metrics.length < 2) return metrics.length ? 1 : 0;
  const newest = new Date(metrics[0].capturedAt).getTime();
  const oldest = new Date(metrics[metrics.length - 1].capturedAt).getTime();
  return Math.max(1, Math.round((newest - oldest) / 60000));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}









