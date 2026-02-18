/**
 * Revenue Signal Engine — Wave R
 *
 * Computes deterministic revenue recovery estimates based on
 * onboarding analytics data.
 *
 * Formula:
 *   estimatedRevenueRecovered = daysSaved × avgDailyRevenuePerClinician
 *
 * Where:
 *   daysSaved = baselineDays - avgDaysToPSVCompletion
 *
 * No marketing language. Strict numeric output.
 * No randomness. No external SaaS dependency.
 */

import type { OnboardingMetrics } from './onboardingAnalyticsEngine';

// ── Constants ────────────────────────────────────────────────

/** Industry baseline: NCQA standard PSV window (calendar days). */
const BASELINE_DAYS = 120;

/** Conservative estimate of daily revenue per clinician (USD). */
const AVG_DAILY_REVENUE_PER_CLINICIAN = 800;

// ── Engine ───────────────────────────────────────────────────

export type RevenueSignal = {
  baselineDays: number;
  avgDaysToPSVCompletion: number | null;
  avgDaysSaved: number | null;
  avgDailyRevenuePerClinician: number;
  estimatedRevenueRecovered: number | null;
  completedPSV: number;
};

export function computeRevenueSignal(metrics: OnboardingMetrics): RevenueSignal {
  const { avgDaysToPSVCompletion, completedPSV } = metrics;

  if (avgDaysToPSVCompletion === null || completedPSV === 0) {
    return {
      baselineDays: BASELINE_DAYS,
      avgDaysToPSVCompletion: null,
      avgDaysSaved: null,
      avgDailyRevenuePerClinician: AVG_DAILY_REVENUE_PER_CLINICIAN,
      estimatedRevenueRecovered: null,
      completedPSV,
    };
  }

  const avgDaysSaved = Math.max(0, BASELINE_DAYS - avgDaysToPSVCompletion);
  const estimatedRevenueRecovered = avgDaysSaved * AVG_DAILY_REVENUE_PER_CLINICIAN * completedPSV;

  return {
    baselineDays: BASELINE_DAYS,
    avgDaysToPSVCompletion,
    avgDaysSaved,
    avgDailyRevenuePerClinician: AVG_DAILY_REVENUE_PER_CLINICIAN,
    estimatedRevenueRecovered,
    completedPSV,
  };
}
