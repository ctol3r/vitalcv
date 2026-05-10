/**
 * W2-PR57A — Automation bias detector.
 *
 * Operates on a stream of LineageEvents and surfaces signals that a human
 * reviewer is rubber-stamping AI output rather than reviewing it. Pure
 * transform: takes events, returns findings; no I/O, no DB.
 *
 * Five signals:
 *   - rubber_stamp_velocity: accept events per minute exceed threshold.
 *   - acceptance_concurrence: accept-rate is suspiciously close to 100%
 *     across a meaningful window.
 *   - low_dwell: median time between display and accept is below the
 *     "could-not-have-read-it" floor.
 *   - dissent_drought: zero overrides across a window long enough that some
 *     dissent is statistically expected.
 *   - ambiguity_ignore: accepts on recommendations carrying ambiguity flags
 *     without ambiguityAcknowledged=true.
 *
 * Thresholds are intentionally explicit and tuneable. The detector does not
 * decide policy — it surfaces findings; downstream gates (CI, alerting)
 * decide what to do.
 */

import type { LineageEvent } from './recommendationLineage';

export type BiasSignal =
  | 'rubber_stamp_velocity'
  | 'acceptance_concurrence'
  | 'low_dwell'
  | 'dissent_drought'
  | 'ambiguity_ignore';

export type BiasSeverity = 'green' | 'yellow' | 'red';

export interface BiasFinding {
  readonly signal: BiasSignal;
  readonly severity: BiasSeverity;
  readonly observed: number;
  readonly threshold: number;
  readonly windowSize: number;
  readonly reason: string;
}

export interface BiasThresholds {
  readonly rubberStampVelocityYellowAcceptsPerMin: number;
  readonly rubberStampVelocityRedAcceptsPerMin: number;
  readonly acceptanceConcurrenceYellow: number;
  readonly acceptanceConcurrenceRed: number;
  readonly lowDwellYellowMs: number;
  readonly lowDwellRedMs: number;
  readonly dissentDroughtYellowEvents: number;
  readonly dissentDroughtRedEvents: number;
  readonly ambiguityIgnoreYellow: number;
  readonly ambiguityIgnoreRed: number;
  readonly minWindowSize: number;
}

export const DEFAULT_BIAS_THRESHOLDS: BiasThresholds = {
  rubberStampVelocityYellowAcceptsPerMin: 6,
  rubberStampVelocityRedAcceptsPerMin: 12,
  acceptanceConcurrenceYellow: 0.95,
  acceptanceConcurrenceRed: 0.99,
  lowDwellYellowMs: 4000,
  lowDwellRedMs: 1500,
  dissentDroughtYellowEvents: 50,
  dissentDroughtRedEvents: 200,
  ambiguityIgnoreYellow: 0.4,
  ambiguityIgnoreRed: 0.75,
  minWindowSize: 12,
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function severityFor(
  observed: number,
  yellow: number,
  red: number,
  direction: 'higher_is_worse' | 'lower_is_worse',
): BiasSeverity {
  if (direction === 'higher_is_worse') {
    if (observed >= red) return 'red';
    if (observed >= yellow) return 'yellow';
    return 'green';
  }
  if (observed <= red) return 'red';
  if (observed <= yellow) return 'yellow';
  return 'green';
}

function ambiguousAccepts(events: readonly LineageEvent[]): number {
  return events.filter(
    (e) =>
      e.eventType === 'AI_RECOMMENDATION_ACCEPTED' &&
      e.ambiguityAcknowledged === false,
  ).length;
}

export interface BiasReport {
  readonly findings: readonly BiasFinding[];
  readonly worstSeverity: BiasSeverity;
  readonly windowSize: number;
}

export function detectAutomationBias(
  events: readonly LineageEvent[],
  thresholds: BiasThresholds = DEFAULT_BIAS_THRESHOLDS,
): BiasReport {
  const findings: BiasFinding[] = [];
  const windowSize = events.length;

  if (windowSize < thresholds.minWindowSize) {
    return {
      findings,
      worstSeverity: 'green',
      windowSize,
    };
  }

  const accepts = events.filter((e) => e.eventType === 'AI_RECOMMENDATION_ACCEPTED');
  const overrides = events.filter((e) => e.eventType === 'AI_RECOMMENDATION_OVERRIDDEN');
  const resolutions = accepts.length + overrides.length;

  const sortedAccepts = [...accepts].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
  );

  if (sortedAccepts.length >= 2) {
    const first = Date.parse(sortedAccepts[0]!.occurredAt);
    const last = Date.parse(sortedAccepts[sortedAccepts.length - 1]!.occurredAt);
    const minutes = Math.max((last - first) / 60_000, 0.001);
    const velocity = sortedAccepts.length / minutes;
    const severity = severityFor(
      velocity,
      thresholds.rubberStampVelocityYellowAcceptsPerMin,
      thresholds.rubberStampVelocityRedAcceptsPerMin,
      'higher_is_worse',
    );
    if (severity !== 'green') {
      findings.push({
        signal: 'rubber_stamp_velocity',
        severity,
        observed: Number(velocity.toFixed(3)),
        threshold:
          severity === 'red'
            ? thresholds.rubberStampVelocityRedAcceptsPerMin
            : thresholds.rubberStampVelocityYellowAcceptsPerMin,
        windowSize,
        reason: `Reviewer accepted ${sortedAccepts.length} AI recommendations across ${minutes.toFixed(2)} minutes — velocity exceeds rubber-stamp floor.`,
      });
    }
  }

  if (resolutions >= thresholds.minWindowSize) {
    const concurrence = accepts.length / resolutions;
    const severity = severityFor(
      concurrence,
      thresholds.acceptanceConcurrenceYellow,
      thresholds.acceptanceConcurrenceRed,
      'higher_is_worse',
    );
    if (severity !== 'green') {
      findings.push({
        signal: 'acceptance_concurrence',
        severity,
        observed: Number(concurrence.toFixed(4)),
        threshold:
          severity === 'red'
            ? thresholds.acceptanceConcurrenceRed
            : thresholds.acceptanceConcurrenceYellow,
        windowSize: resolutions,
        reason: `Acceptance rate ${(concurrence * 100).toFixed(2)}% across ${resolutions} resolutions; near-100% concurrence indicates the human is unlikely to be exercising independent judgment.`,
      });
    }
  }

  const dwellSamples = accepts
    .map((e) => e.dwellMs)
    .filter((v): v is number => typeof v === 'number');
  if (dwellSamples.length >= thresholds.minWindowSize) {
    const med = median(dwellSamples);
    const severity = severityFor(
      med,
      thresholds.lowDwellYellowMs,
      thresholds.lowDwellRedMs,
      'lower_is_worse',
    );
    if (severity !== 'green') {
      findings.push({
        signal: 'low_dwell',
        severity,
        observed: med,
        threshold:
          severity === 'red' ? thresholds.lowDwellRedMs : thresholds.lowDwellYellowMs,
        windowSize: dwellSamples.length,
        reason: `Median dwell ${med}ms before accept across ${dwellSamples.length} samples — below the read-and-decide floor.`,
      });
    }
  }

  if (windowSize >= thresholds.dissentDroughtYellowEvents && overrides.length === 0) {
    const severity: BiasSeverity =
      windowSize >= thresholds.dissentDroughtRedEvents ? 'red' : 'yellow';
    findings.push({
      signal: 'dissent_drought',
      severity,
      observed: 0,
      threshold:
        severity === 'red'
          ? thresholds.dissentDroughtRedEvents
          : thresholds.dissentDroughtYellowEvents,
      windowSize,
      reason: `Zero overrides across ${windowSize} events; some dissent is statistically expected.`,
    });
  }

  if (accepts.length >= thresholds.minWindowSize) {
    const ambiguousIgnoreCount = ambiguousAccepts(accepts);
    const ratio = ambiguousIgnoreCount / accepts.length;
    const severity = severityFor(
      ratio,
      thresholds.ambiguityIgnoreYellow,
      thresholds.ambiguityIgnoreRed,
      'higher_is_worse',
    );
    if (severity !== 'green') {
      findings.push({
        signal: 'ambiguity_ignore',
        severity,
        observed: Number(ratio.toFixed(4)),
        threshold:
          severity === 'red'
            ? thresholds.ambiguityIgnoreRed
            : thresholds.ambiguityIgnoreYellow,
        windowSize: accepts.length,
        reason: `${(ratio * 100).toFixed(1)}% of accepts did not acknowledge surfaced ambiguity flags.`,
      });
    }
  }

  const severityRank: Record<BiasSeverity, number> = { green: 0, yellow: 1, red: 2 };
  const worstSeverity: BiasSeverity = findings.reduce<BiasSeverity>(
    (worst, f) =>
      severityRank[f.severity] > severityRank[worst] ? f.severity : worst,
    'green',
  );

  return { findings, worstSeverity, windowSize };
}
