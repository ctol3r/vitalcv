/**
 * auditBaseline.ts — Wave 122: Audit OS + SIEM Operations
 *
 * Baseline-aware anomaly detection for the audit ledger.
 * Tracks rolling windows and detects:
 *   - Revocation spikes (>3x baseline in 1hr window)
 *   - Unusual bundle export rates (>5x baseline)
 *   - Repeated failed presentations (>10 in 15min)
 *   - Auth event anomalies (>20 failed in 5min)
 *
 * Maintains an in-memory baseline that auto-calibrates over time.
 */

import { log } from '../../obs/logger';
import { exportSinceTime, type AuditEntry, type AuditCategory, type AuditSeverity } from './auditLedger';

// ── Types ─────────────────────────────────────────────────────────────

export interface BaselineWindow {
  category: AuditCategory;
  windowMinutes: number;
  baselineRate: number;   // events per window at baseline
  currentRate: number;    // events in current window
  multiplier: number;     // current / baseline
  anomaly: boolean;
  threshold: number;      // multiplier threshold for anomaly
}

export interface AuditAnomaly {
  anomalyId: string;
  category: AuditCategory;
  description: string;
  severity: AuditSeverity;
  currentRate: number;
  baselineRate: number;
  multiplier: number;
  windowMinutes: number;
  detectedAt: string;
  sampleEvents: Array<{ eventId: string; time: string; actor: string; resource: string }>;
}

export interface BaselineSummary {
  computedAt: string;
  windowsChecked: number;
  anomaliesDetected: number;
  windows: BaselineWindow[];
  anomalies: AuditAnomaly[];
}

// ── Configuration ─────────────────────────────────────────────────────

interface BaselineConfig {
  category: AuditCategory;
  windowMinutes: number;
  baselineRate: number;
  threshold: number;
  severity: AuditSeverity;
  description: string;
}

const BASELINE_CONFIGS: BaselineConfig[] = [
  {
    category: 'REVOCATION',
    windowMinutes: 60,
    baselineRate: 2,
    threshold: 3,
    severity: 'CRITICAL',
    description: 'Revocation spike — >3x baseline rate in 1-hour window',
  },
  {
    category: 'BUNDLE_EXPORT',
    windowMinutes: 60,
    baselineRate: 5,
    threshold: 5,
    severity: 'WARNING',
    description: 'Unusual bundle export rate — >5x baseline',
  },
  {
    category: 'PRESENTATION',
    windowMinutes: 15,
    baselineRate: 3,
    threshold: 3.5,
    severity: 'WARNING',
    description: 'Repeated failed presentations — elevated rate in 15-min window',
  },
  {
    category: 'AUTH',
    windowMinutes: 5,
    baselineRate: 5,
    threshold: 4,
    severity: 'CRITICAL',
    description: 'Auth event anomaly — >4x baseline in 5-min window',
  },
  {
    category: 'TRUST_STATE_CHANGE',
    windowMinutes: 30,
    baselineRate: 3,
    threshold: 5,
    severity: 'WARNING',
    description: 'Trust state changes — elevated band transitions',
  },
  {
    category: 'ISSUANCE',
    windowMinutes: 60,
    baselineRate: 10,
    threshold: 5,
    severity: 'WARNING',
    description: 'Issuance spike — >5x baseline in 1-hour window',
  },
];

// ── Rolling Baseline State ────────────────────────────────────────────

interface RollingState {
  category: AuditCategory;
  historicalCounts: number[];  // hourly counts for calibration
  calibratedBaseline: number | null;
}

const rollingStates = new Map<AuditCategory, RollingState>();

function getOrCreateState(category: AuditCategory, defaultBaseline: number): RollingState {
  if (!rollingStates.has(category)) {
    rollingStates.set(category, {
      category,
      historicalCounts: [],
      calibratedBaseline: null,
    });
  }
  return rollingStates.get(category)!;
}

function getEffectiveBaseline(state: RollingState, defaultBaseline: number): number {
  if (state.calibratedBaseline !== null && state.calibratedBaseline > 0) {
    return state.calibratedBaseline;
  }
  return defaultBaseline;
}

// ── Anomaly Detection ─────────────────────────────────────────────────

let anomalyCounter = 0;

function checkWindow(config: BaselineConfig): BaselineWindow & { anomaly_detail?: AuditAnomaly } {
  const since = new Date(Date.now() - config.windowMinutes * 60_000).toISOString();
  const events = exportSinceTime(since, 10_000);

  // Filter by category
  const categoryEvents = events.filter((e) =>
    e.category.includes(config.category)
  );

  const state = getOrCreateState(config.category, config.baselineRate);
  const effectiveBaseline = getEffectiveBaseline(state, config.baselineRate);
  const currentRate = categoryEvents.length;
  const multiplier = effectiveBaseline > 0 ? currentRate / effectiveBaseline : 0;
  const isAnomaly = multiplier >= config.threshold && currentRate > 0;

  const window: BaselineWindow = {
    category: config.category,
    windowMinutes: config.windowMinutes,
    baselineRate: effectiveBaseline,
    currentRate,
    multiplier: Math.round(multiplier * 100) / 100,
    anomaly: isAnomaly,
    threshold: config.threshold,
  };

  let anomaly_detail: AuditAnomaly | undefined;

  if (isAnomaly) {
    anomalyCounter++;
    anomaly_detail = {
      anomalyId: `anomaly_${anomalyCounter}_${Date.now()}`,
      category: config.category,
      description: config.description,
      severity: config.severity,
      currentRate,
      baselineRate: effectiveBaseline,
      multiplier: window.multiplier,
      windowMinutes: config.windowMinutes,
      detectedAt: new Date().toISOString(),
      sampleEvents: categoryEvents.slice(-5).map((e) => ({
        eventId: e.eventId,
        time: e.time,
        actor: e.actor,
        resource: e.resource,
      })),
    };

    log('warn', `audit_baseline: anomaly detected — ${config.category}`, {
      multiplier: window.multiplier,
      currentRate,
      baseline: effectiveBaseline,
      threshold: config.threshold,
    });
  }

  return { ...window, anomaly_detail };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Compute baseline summary across all configured windows.
 * Detects anomalies and returns detailed results.
 */
export function computeBaselineSummary(): BaselineSummary {
  const results = BASELINE_CONFIGS.map(checkWindow);

  const windows = results.map(({ anomaly_detail, ...w }) => w);
  const anomalies = results
    .filter((r) => r.anomaly_detail)
    .map((r) => r.anomaly_detail!);

  return {
    computedAt: new Date().toISOString(),
    windowsChecked: windows.length,
    anomaliesDetected: anomalies.length,
    windows,
    anomalies,
  };
}

/**
 * Calibrate baselines from historical data.
 * Call periodically (e.g., every 6 hours) to update baselines.
 */
export function calibrateBaselines(): void {
  // Look at last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const events = exportSinceTime(since, 100_000);

  for (const config of BASELINE_CONFIGS) {
    const state = getOrCreateState(config.category, config.baselineRate);
    const categoryEvents = events.filter((e) => e.category.includes(config.category));

    // Calculate hourly rate over 24h
    const hourlyRate = categoryEvents.length / 24;
    state.historicalCounts.push(hourlyRate);

    // Keep last 7 data points (≈7 calibration cycles)
    if (state.historicalCounts.length > 7) {
      state.historicalCounts.shift();
    }

    // Calibrated baseline = average of historical hourly rates, adjusted for window size
    const avgHourly = state.historicalCounts.reduce((a, b) => a + b, 0) / state.historicalCounts.length;
    state.calibratedBaseline = Math.max(1, Math.round(avgHourly * (config.windowMinutes / 60)));

    log('info', `audit_baseline: calibrated ${config.category}`, {
      calibrated: state.calibratedBaseline,
      dataPoints: state.historicalCounts.length,
    });
  }
}

/**
 * Get recent anomalies only (for quick operator checks).
 */
export function getRecentAnomalies(): AuditAnomaly[] {
  return computeBaselineSummary().anomalies;
}
