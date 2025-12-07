import { z } from 'zod';

export const TrustMetricsSchema = z.object({
  verificationAccuracy: z.number().min(0).max(1),
  freshnessHours: z.number().min(0),
  uptimePercentage: z.number().min(0).max(100),
});

export type TrustMetrics = z.infer<typeof TrustMetricsSchema>;

export type TrustTier = 'ANCHOR' | 'TRUSTED' | 'WATCHLIST';

export interface TrustScoreBreakdown {
  overallScore: number;
  components: {
    accuracy: number;
    freshness: number;
    uptime: number;
  };
  tier: TrustTier;
  reasons: string[];
}

const DEFAULT_METRICS: TrustMetrics = {
  verificationAccuracy: 0.97,
  freshnessHours: 8,
  uptimePercentage: 99.5,
};

const ACCURACY_WEIGHT = 0.5;
const FRESHNESS_WEIGHT = 0.3;
const UPTIME_WEIGHT = 0.2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function normalizeFreshness(hours: number): number {
  if (hours <= 6) {
    return 100;
  }
  if (hours <= 24) {
    return 95;
  }
  if (hours <= 72) {
    return 80;
  }
  if (hours <= 168) {
    return 60;
  }
  if (hours <= 336) {
    return 40;
  }
  return 20;
}

export function withDefaultMetrics(partial?: Partial<TrustMetrics>): TrustMetrics {
  return {
    verificationAccuracy: clamp(
      partial?.verificationAccuracy ?? DEFAULT_METRICS.verificationAccuracy,
      0,
      1
    ),
    freshnessHours: Math.max(0, partial?.freshnessHours ?? DEFAULT_METRICS.freshnessHours),
    uptimePercentage: clamp(partial?.uptimePercentage ?? DEFAULT_METRICS.uptimePercentage, 0, 100),
  };
}

export function calculateTrustScore(metricsInput: Partial<TrustMetrics> | TrustMetrics): TrustScoreBreakdown {
  const metrics =
    'verificationAccuracy' in metricsInput || 'freshnessHours' in metricsInput || 'uptimePercentage' in metricsInput
      ? withDefaultMetrics(metricsInput)
      : DEFAULT_METRICS;

  const accuracyComponent = Math.round(metrics.verificationAccuracy * 100);
  const freshnessComponent = Math.round(normalizeFreshness(metrics.freshnessHours));
  const uptimeComponent = Math.round(metrics.uptimePercentage);

  const overallScore = Math.round(
    accuracyComponent * ACCURACY_WEIGHT +
      freshnessComponent * FRESHNESS_WEIGHT +
      uptimeComponent * UPTIME_WEIGHT
  );

  const tier: TrustTier = overallScore >= 85 ? 'ANCHOR' : overallScore >= 60 ? 'TRUSTED' : 'WATCHLIST';
  const reasons: string[] = [];

  if (accuracyComponent < 80) {
    reasons.push('verification accuracy trending low');
  }
  if (freshnessComponent < 70) {
    reasons.push('data freshness outside SLA');
  }
  if (uptimeComponent < 85) {
    reasons.push('uptime below SLA');
  }

  return {
    overallScore,
    components: {
      accuracy: accuracyComponent,
      freshness: freshnessComponent,
      uptime: uptimeComponent,
    },
    tier,
    reasons,
  };
}

