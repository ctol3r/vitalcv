/**
 * Batch 400.5 — Trust Contradiction Detector
 * Detects conflicting trust signals
 */

import type { NormalizedTrustSignal } from './normalize';

export interface Contradiction {
  type: 'polarity' | 'temporal' | 'source' | 'magnitude';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  signals: string[];
  recommendation?: string;
}

/**
 * Detect contradictions in trust signals
 */
export function detectContradictions(signals: NormalizedTrustSignal[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  if (signals.length < 2) {
    return contradictions;
  }

  // Group by source
  const bySource = signals.reduce((acc, signal) => {
    if (!acc[signal.source]) acc[signal.source] = [];
    acc[signal.source].push(signal);
    return acc;
  }, {} as Record<string, NormalizedTrustSignal[]>);

  // Check for polarity contradictions (opposite extremes)
  const values = signals.map((s) => s.normalizedValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range > 70 && min < 30 && max > 70) {
    contradictions.push({
      type: 'polarity',
      severity: range > 80 ? 'critical' : 'high',
      description: `Extreme polarity: scores range from ${min.toFixed(1)} to ${max.toFixed(1)}`,
      signals: signals.map((s) => `${s.source}:${s.normalizedValue.toFixed(1)}`),
      recommendation: 'Review source reliability and recent events',
    });
  }

  // Check for temporal contradictions (rapid changes)
  const sortedByTime = [...signals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  for (let i = 1; i < sortedByTime.length; i++) {
    const prev = sortedByTime[i - 1];
    const curr = sortedByTime[i];
    const delta = Math.abs(curr.normalizedValue - prev.normalizedValue);
    const timeDelta = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const daysDelta = timeDelta / (1000 * 60 * 60 * 24);

    if (delta > 40 && daysDelta < 7) {
      contradictions.push({
        type: 'temporal',
        severity: delta > 60 ? 'high' : 'medium',
        description: `Rapid change: ${prev.normalizedValue.toFixed(1)} → ${curr.normalizedValue.toFixed(1)} in ${daysDelta.toFixed(1)} days`,
        signals: [`${prev.source}:${prev.normalizedValue.toFixed(1)}`, `${curr.source}:${curr.normalizedValue.toFixed(1)}`],
        recommendation: 'Investigate recent events or data quality issues',
      });
    }
  }

  // Check for source contradictions (same source, different values)
  for (const [source, sourceSignals] of Object.entries(bySource)) {
    if (sourceSignals.length > 1) {
      const sourceValues = sourceSignals.map((s) => s.normalizedValue);
      const sourceRange = Math.max(...sourceValues) - Math.min(...sourceValues);
      if (sourceRange > 30) {
        contradictions.push({
          type: 'source',
          severity: sourceRange > 50 ? 'high' : 'medium',
          description: `${source} source shows inconsistent values (range: ${sourceRange.toFixed(1)})`,
          signals: sourceSignals.map((s) => `${s.normalizedValue.toFixed(1)}@${s.timestamp}`),
          recommendation: 'Verify source data integrity',
        });
      }
    }
  }

  // Check for magnitude contradictions (unusually high/low values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const outliers = signals.filter((s) => Math.abs(s.normalizedValue - mean) > 40);
  if (outliers.length > 0 && outliers.length < signals.length) {
    contradictions.push({
      type: 'magnitude',
      severity: 'medium',
      description: `${outliers.length} outlier(s) detected (mean: ${mean.toFixed(1)})`,
      signals: outliers.map((s) => `${s.source}:${s.normalizedValue.toFixed(1)}`),
      recommendation: 'Review outlier sources for data quality',
    });
  }

  return contradictions;
}

