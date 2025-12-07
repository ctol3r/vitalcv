/**
 * B207A-LIFE-002: TemporalFeatureExtractor
 *
 * Extracts evolving features: credential half-life, seasonality in performance,
 * renewal clustering, risk aging curves.
 */

import type { LifecycleState } from '../models/LifecycleState.js';
import type { ProjectionWindow } from '../constants.js';

/**
 * Credential half-life calculation result
 */
export interface CredentialHalfLife {
  licenseHalfLife: number; // Days until 50% of licenses expire
  boardHalfLife: number; // Days until 50% of board certs expire
  deaHalfLife: number; // Days until 50% of DEA registrations expire
  overallHalfLife: number; // Weighted average
}

/**
 * Seasonality pattern in performance
 */
export interface SeasonalityPattern {
  monthlyPattern: number[]; // 12 values representing each month (0-1 normalized)
  quarterlyPattern: number[]; // 4 values representing each quarter
  peakMonth: number; // 0-11 (January = 0)
  lowMonth: number; // 0-11
  amplitude: number; // 0-1, strength of seasonality
}

/**
 * Renewal clustering analysis
 */
export interface RenewalClustering {
  clusterCount: number; // Number of distinct renewal periods
  largestClusterSize: number; // Number of credentials in largest cluster
  clusterDensity: number; // 0-1, how tightly clustered renewals are
  nextRenewalWindow: {
    start: Date;
    end: Date;
    credentialCount: number;
  } | null;
}

/**
 * Risk aging curve
 */
export interface RiskAgingCurve {
  currentRisk: number; // 0-1
  projectedRisk: Record<ProjectionWindow, number>; // Risk at each projection window
  riskTrend: 'increasing' | 'decreasing' | 'stable';
  inflectionPoint: Date | null; // When risk trend changes
  decayRate: number; // Rate of risk change per month
}

/**
 * Temporal features result
 */
export interface TemporalFeatures {
  credentialHalfLife: CredentialHalfLife;
  seasonality: SeasonalityPattern;
  renewalClustering: RenewalClustering;
  riskAgingCurve: RiskAgingCurve;
}

/**
 * Calculate credential half-life from lifecycle states
 */
function calculateCredentialHalfLife(states: LifecycleState[]): CredentialHalfLife {
  if (states.length === 0) {
    return {
      licenseHalfLife: 0,
      boardHalfLife: 0,
      deaHalfLife: 0,
      overallHalfLife: 0,
    };
  }

  const now = new Date();
  const licenseDays: number[] = [];
  const boardDays: number[] = [];
  const deaDays: number[] = [];

  for (const state of states) {
    if (state.credentialFreshness) {
      if (state.credentialFreshness.licenseExpiryDays !== undefined) {
        licenseDays.push(state.credentialFreshness.licenseExpiryDays);
      }
      if (state.credentialFreshness.boardExpiryDays !== undefined) {
        boardDays.push(state.credentialFreshness.boardExpiryDays);
      }
      if (state.credentialFreshness.deaExpiryDays !== undefined) {
        deaDays.push(state.credentialFreshness.deaExpiryDays);
      }
    }
  }

  // Calculate median (approximation of half-life)
  const getMedian = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const licenseHalfLife = getMedian(licenseDays);
  const boardHalfLife = getMedian(boardDays);
  const deaHalfLife = getMedian(deaDays);

  // Weighted average (license most important)
  const overallHalfLife = licenseHalfLife * 0.5 + boardHalfLife * 0.3 + deaHalfLife * 0.2;

  return {
    licenseHalfLife,
    boardHalfLife,
    deaHalfLife,
    overallHalfLife,
  };
}

/**
 * Extract seasonality pattern from performance data
 */
function extractSeasonality(states: LifecycleState[]): SeasonalityPattern {
  if (states.length === 0) {
    return {
      monthlyPattern: new Array(12).fill(0.5),
      quarterlyPattern: new Array(4).fill(0.5),
      peakMonth: 0,
      lowMonth: 0,
      amplitude: 0,
    };
  }

  // Group states by month
  const monthlyScores: number[][] = Array.from({ length: 12 }, () => []);
  const quarterlyScores: number[][] = Array.from({ length: 4 }, () => []);

  for (const state of states) {
    const month = state.timestamp.getMonth();
    const quarter = Math.floor(month / 3);

    // Use CCI score as performance indicator if available
    const score = state.cci?.cciScore ?? 50;
    monthlyScores[month].push(score / 100); // Normalize to 0-1
    quarterlyScores[quarter].push(score / 100);
  }

  // Calculate average for each month/quarter
  const monthlyPattern = monthlyScores.map((scores) =>
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5
  );
  const quarterlyPattern = quarterlyScores.map((scores) =>
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5
  );

  // Find peak and low months
  const peakMonth = monthlyPattern.indexOf(Math.max(...monthlyPattern));
  const lowMonth = monthlyPattern.indexOf(Math.min(...monthlyPattern));

  // Calculate amplitude (difference between peak and low)
  const amplitude = Math.max(...monthlyPattern) - Math.min(...monthlyPattern);

  return {
    monthlyPattern,
    quarterlyPattern,
    peakMonth,
    lowMonth,
    amplitude,
  };
}

/**
 * Analyze renewal clustering from credential freshness data
 */
function analyzeRenewalClustering(states: LifecycleState[]): RenewalClustering {
  if (states.length === 0) {
    return {
      clusterCount: 0,
      largestClusterSize: 0,
      clusterDensity: 0,
      nextRenewalWindow: null,
    };
  }

  // Extract renewal dates from credential freshness
  const renewalDates: Date[] = [];
  const now = new Date();

  for (const state of states) {
    if (state.credentialFreshness) {
      const cf = state.credentialFreshness;
      if (cf.licenseExpiryDays !== undefined && cf.licenseExpiryDays > 0) {
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + cf.licenseExpiryDays);
        renewalDates.push(expiryDate);
      }
      if (cf.boardExpiryDays !== undefined && cf.boardExpiryDays > 0) {
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + cf.boardExpiryDays);
        renewalDates.push(expiryDate);
      }
      if (cf.deaExpiryDays !== undefined && cf.deaExpiryDays > 0) {
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + cf.deaExpiryDays);
        renewalDates.push(expiryDate);
      }
    }
  }

  if (renewalDates.length === 0) {
    return {
      clusterCount: 0,
      largestClusterSize: 0,
      clusterDensity: 0,
      nextRenewalWindow: null,
    };
  }

  // Sort dates
  renewalDates.sort((a, b) => a.getTime() - b.getTime());

  // Cluster renewals within 30-day windows
  const clusters: Date[][] = [];
  let currentCluster: Date[] = [renewalDates[0]];

  for (let i = 1; i < renewalDates.length; i++) {
    const daysDiff = (renewalDates[i].getTime() - currentCluster[0].getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 30) {
      currentCluster.push(renewalDates[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [renewalDates[i]];
    }
  }
  clusters.push(currentCluster);

  // Find largest cluster
  const largestCluster = clusters.reduce((max, cluster) => (cluster.length > max.length ? cluster : max), clusters[0]);
  const largestClusterSize = largestCluster.length;

  // Calculate cluster density (how many renewals are in clusters vs isolated)
  const clusteredRenewals = clusters.filter((c) => c.length > 1).reduce((sum, c) => sum + c.length, 0);
  const clusterDensity = renewalDates.length > 0 ? clusteredRenewals / renewalDates.length : 0;

  // Find next renewal window
  const futureRenewals = renewalDates.filter((d) => d > now);
  const nextRenewalWindow =
    futureRenewals.length > 0
      ? {
          start: new Date(Math.min(...futureRenewals.map((d) => d.getTime()))),
          end: new Date(Math.min(...futureRenewals.map((d) => d.getTime())) + 30 * 24 * 60 * 60 * 1000),
          credentialCount: futureRenewals.filter(
            (d) => d >= futureRenewals[0] && d <= new Date(futureRenewals[0].getTime() + 30 * 24 * 60 * 60 * 1000)
          ).length,
        }
      : null;

  return {
    clusterCount: clusters.length,
    largestClusterSize,
    clusterDensity,
    nextRenewalWindow,
  };
}

/**
 * Calculate risk aging curve from historical risk data
 */
function calculateRiskAgingCurve(
  states: LifecycleState[],
  projectionWindows: ProjectionWindow[]
): RiskAgingCurve {
  if (states.length === 0) {
    const projectedRisk: Record<ProjectionWindow, number> = {
      '3mo': 0.5,
      '6mo': 0.5,
      '12mo': 0.5,
      '24mo': 0.5,
      '36mo': 0.5,
    };
    return {
      currentRisk: 0.5,
      projectedRisk,
      riskTrend: 'stable',
      inflectionPoint: null,
      decayRate: 0,
    };
  }

  // Sort states by timestamp
  const sortedStates = [...states].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Extract risk scores over time
  const riskScores: Array<{ date: Date; risk: number }> = [];
  for (const state of sortedStates) {
    if (state.risk) {
      riskScores.push({
        date: state.timestamp,
        risk: state.risk.riskScore,
      });
    }
  }

  if (riskScores.length === 0) {
    const projectedRisk: Record<ProjectionWindow, number> = {
      '3mo': 0.5,
      '6mo': 0.5,
      '12mo': 0.5,
      '24mo': 0.5,
      '36mo': 0.5,
    };
    return {
      currentRisk: 0.5,
      projectedRisk,
      riskTrend: 'stable',
      inflectionPoint: null,
      decayRate: 0,
    };
  }

  const currentRisk = riskScores[riskScores.length - 1].risk;

  // Calculate trend (simple linear regression)
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  let decayRate = 0;
  let inflectionPoint: Date | null = null;

  if (riskScores.length >= 2) {
    const firstRisk = riskScores[0].risk;
    const lastRisk = riskScores[riskScores.length - 1].risk;
    const timeSpan = (riskScores[riskScores.length - 1].date.getTime() - riskScores[0].date.getTime()) / (1000 * 60 * 60 * 24 * 30); // months

    if (timeSpan > 0) {
      decayRate = (lastRisk - firstRisk) / timeSpan;
      if (decayRate > 0.01) {
        trend = 'increasing';
      } else if (decayRate < -0.01) {
        trend = 'decreasing';
      }
    }

    // Find inflection point (where trend changes)
    for (let i = 1; i < riskScores.length - 1; i++) {
      const prev = riskScores[i - 1].risk;
      const curr = riskScores[i].risk;
      const next = riskScores[i + 1].risk;
      if ((prev < curr && curr > next) || (prev > curr && curr < next)) {
        inflectionPoint = riskScores[i].date;
        break;
      }
    }
  }

  // Project risk for each window
  const projectedRisk: Record<ProjectionWindow, number> = {
    '3mo': Math.max(0, Math.min(1, currentRisk + decayRate * 3)),
    '6mo': Math.max(0, Math.min(1, currentRisk + decayRate * 6)),
    '12mo': Math.max(0, Math.min(1, currentRisk + decayRate * 12)),
    '24mo': Math.max(0, Math.min(1, currentRisk + decayRate * 24)),
    '36mo': Math.max(0, Math.min(1, currentRisk + decayRate * 36)),
  };

  return {
    currentRisk,
    projectedRisk,
    riskTrend: trend,
    inflectionPoint,
    decayRate,
  };
}

/**
 * TemporalFeatureExtractor class
 */
export class TemporalFeatureExtractor {
  /**
   * Extract all temporal features from lifecycle states
   */
  extractTemporalFeatures(
    states: LifecycleState[],
    projectionWindows: ProjectionWindow[] = ['3mo', '6mo', '12mo', '24mo', '36mo']
  ): TemporalFeatures {
    return {
      credentialHalfLife: calculateCredentialHalfLife(states),
      seasonality: extractSeasonality(states),
      renewalClustering: analyzeRenewalClustering(states),
      riskAgingCurve: calculateRiskAgingCurve(states, projectionWindows),
    };
  }

  /**
   * Extract only credential half-life
   */
  extractCredentialHalfLife(states: LifecycleState[]): CredentialHalfLife {
    return calculateCredentialHalfLife(states);
  }

  /**
   * Extract only seasonality pattern
   */
  extractSeasonality(states: LifecycleState[]): SeasonalityPattern {
    return extractSeasonality(states);
  }

  /**
   * Extract only renewal clustering
   */
  extractRenewalClustering(states: LifecycleState[]): RenewalClustering {
    return analyzeRenewalClustering(states);
  }

  /**
   * Extract only risk aging curve
   */
  extractRiskAgingCurve(
    states: LifecycleState[],
    projectionWindows: ProjectionWindow[] = ['3mo', '6mo', '12mo', '24mo', '36mo']
  ): RiskAgingCurve {
    return calculateRiskAgingCurve(states, projectionWindows);
  }
}

/**
 * Default temporal feature extractor instance
 */
export const temporalFeatureExtractor = new TemporalFeatureExtractor();

