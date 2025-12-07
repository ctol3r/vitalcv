/**
 * Pilot Readiness SLO Configuration
 * B133A-PILOT-001: Defines Service Level Objectives for pilot readiness
 *
 * SLO Thresholds:
 * - Uptime: ≥99.5% (allows ~3.5 hours downtime per month)
 * - Error Rate: <1% (99% success rate)
 * - Anchor P95 Latency: <2000ms (95th percentile response time)
 */

export interface PilotSloConfig {
  /**
   * Uptime threshold (percentage)
   * Minimum acceptable uptime for pilot readiness
   */
  uptimeThreshold: number;

  /**
   * Error rate threshold (percentage)
   * Maximum acceptable error rate
   */
  errorRateThreshold: number;

  /**
   * Anchor operation P95 latency threshold (milliseconds)
   * Maximum acceptable 95th percentile latency for anchor operations
   */
  anchorP95LatencyThreshold: number;

  /**
   * Evaluation window (days)
   * Number of days to aggregate for SLO calculation
   */
  evaluationWindowDays: number;

  /**
   * Smoke test interval (minutes)
   * How frequently smoke tests should run
   */
  smokeTestIntervalMinutes: number;

  /**
   * Error budget (percentage)
   * Calculated as (100 - uptimeThreshold)
   */
  errorBudget: number;

  /**
   * Critical alert threshold
   * When error budget consumption exceeds this percentage, trigger critical alerts
   */
  criticalAlertThreshold: number;
}

/**
 * Default pilot SLO configuration
 */
export const DEFAULT_PILOT_SLO: PilotSloConfig = {
  uptimeThreshold: 99.5, // 99.5% uptime
  errorRateThreshold: 1.0, // <1% error rate
  anchorP95LatencyThreshold: 2000, // <2000ms (2 seconds)
  evaluationWindowDays: 7, // 7-day rolling window
  smokeTestIntervalMinutes: 60, // Hourly smoke tests
  errorBudget: 0.5, // 0.5% error budget (100 - 99.5)
  criticalAlertThreshold: 80, // Alert when 80% of error budget consumed
};

/**
 * SLO Metric Types
 */
export enum SloMetricType {
  UPTIME = 'uptime',
  ERROR_RATE = 'errorRate',
  ANCHOR_P95_LATENCY = 'anchorP95Latency',
}

/**
 * SLO Status
 */
export enum SloStatus {
  PASS = 'pass',
  FAIL = 'fail',
  WARNING = 'warning',
  UNKNOWN = 'unknown',
}

/**
 * SLO Metric Result
 */
export interface SloMetricResult {
  metric: SloMetricType;
  value: number;
  threshold: number;
  status: SloStatus;
  timestamp: Date;
  details?: string;
}

/**
 * Overall SLO Evaluation Result
 */
export interface SloEvaluationResult {
  status: SloStatus;
  metrics: SloMetricResult[];
  evaluationPeriodStart: Date;
  evaluationPeriodEnd: Date;
  errorBudgetConsumed: number; // Percentage of error budget consumed
  passed: boolean;
  reasons?: string[];
}

/**
 * Get pilot SLO configuration
 * Can be extended to load from database or environment variables
 */
export function getPilotSloConfig(): PilotSloConfig {
  // Allow environment variable overrides
  return {
    uptimeThreshold: parseFloat(process.env.PILOT_SLO_UPTIME_THRESHOLD || String(DEFAULT_PILOT_SLO.uptimeThreshold)),
    errorRateThreshold: parseFloat(process.env.PILOT_SLO_ERROR_THRESHOLD || String(DEFAULT_PILOT_SLO.errorRateThreshold)),
    anchorP95LatencyThreshold: parseInt(process.env.PILOT_SLO_P95_LATENCY_MS || String(DEFAULT_PILOT_SLO.anchorP95LatencyThreshold)),
    evaluationWindowDays: parseInt(process.env.PILOT_SLO_WINDOW_DAYS || String(DEFAULT_PILOT_SLO.evaluationWindowDays)),
    smokeTestIntervalMinutes: parseInt(process.env.PILOT_SMOKE_INTERVAL_MIN || String(DEFAULT_PILOT_SLO.smokeTestIntervalMinutes)),
    errorBudget: parseFloat(process.env.PILOT_SLO_ERROR_BUDGET || String(DEFAULT_PILOT_SLO.errorBudget)),
    criticalAlertThreshold: parseFloat(process.env.PILOT_SLO_CRITICAL_THRESHOLD || String(DEFAULT_PILOT_SLO.criticalAlertThreshold)),
  };
}

/**
 * Export SLO configuration as JSON
 */
export function exportSloConfigAsJson(): string {
  const config = getPilotSloConfig();
  return JSON.stringify(config, null, 2);
}

/**
 * Validate SLO metric result against thresholds
 */
export function validateSloMetric(
  metric: SloMetricType,
  value: number,
  config: PilotSloConfig = getPilotSloConfig()
): SloMetricResult {
  let threshold: number;
  let status: SloStatus;
  let details: string;

  switch (metric) {
    case SloMetricType.UPTIME:
      threshold = config.uptimeThreshold;
      status = value >= threshold ? SloStatus.PASS : SloStatus.FAIL;
      details = `Uptime ${value.toFixed(2)}% ${status === SloStatus.PASS ? 'meets' : 'below'} threshold ${threshold}%`;
      break;

    case SloMetricType.ERROR_RATE:
      threshold = config.errorRateThreshold;
      status = value < threshold ? SloStatus.PASS : SloStatus.FAIL;
      details = `Error rate ${value.toFixed(2)}% ${status === SloStatus.PASS ? 'below' : 'exceeds'} threshold ${threshold}%`;
      break;

    case SloMetricType.ANCHOR_P95_LATENCY:
      threshold = config.anchorP95LatencyThreshold;
      status = value < threshold ? SloStatus.PASS : SloStatus.FAIL;
      details = `P95 latency ${value.toFixed(0)}ms ${status === SloStatus.PASS ? 'below' : 'exceeds'} threshold ${threshold}ms`;
      break;

    default:
      throw new Error(`Unknown SLO metric type: ${metric}`);
  }

  return {
    metric,
    value,
    threshold,
    status,
    timestamp: new Date(),
    details,
  };
}

/**
 * Calculate error budget consumption
 * @param actualUptime Actual uptime percentage
 * @param config SLO configuration
 * @returns Percentage of error budget consumed
 */
export function calculateErrorBudgetConsumption(
  actualUptime: number,
  config: PilotSloConfig = getPilotSloConfig()
): number {
  const actualDowntime = 100 - actualUptime;
  const allowedDowntime = config.errorBudget;

  if (allowedDowntime === 0) return 100;

  const consumption = (actualDowntime / allowedDowntime) * 100;
  return Math.min(consumption, 100);
}

/**
 * Export module for testing
 */
export default {
  DEFAULT_PILOT_SLO,
  getPilotSloConfig,
  exportSloConfigAsJson,
  validateSloMetric,
  calculateErrorBudgetConsumption,
  SloMetricType,
  SloStatus,
};

