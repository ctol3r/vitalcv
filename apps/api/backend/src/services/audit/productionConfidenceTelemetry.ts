/**
 * productionConfidenceTelemetry.ts — Production Confidence Telemetry
 *
 * Tracks production confidence over time across deployment events. Detects
 * overconfidence episodes, confidence drift, and evidence-score divergence
 * as they accumulate across acceptance cycles.
 *
 * Telemetry is evidence-derived: no score may be reported without the
 * evidence snapshot that produced it. Ambiguity is preserved inline.
 *
 * Design constraints:
 *   - Scores are evidence-capped at time of capture
 *   - Overconfidence episodes are cumulative; the alarm threshold is absolute
 *   - Drift is always directional: improvement vs. degradation tracked separately
 *   - No external I/O; pure transform over caller-supplied snapshots
 */

import { createHash } from 'crypto';
import type { AcceptanceVerdict } from './productionAcceptanceScoring';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TelemetryEventClass =
  | 'ACCEPTANCE_SCORED'
  | 'CONFIDENCE_CEILING_HIT'
  | 'OVERCONFIDENCE_DETECTED'
  | 'DRIFT_IMPROVEMENT'
  | 'DRIFT_DEGRADATION'
  | 'REPLAY_FIDELITY_CHANGE'
  | 'SURVIVABILITY_CHANGE';

export type ConfidenceTrendDirection = 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'VOLATILE';

// ── Input ──────────────────────────────────────────────────────────────────────

export interface ConfidenceDataPoint {
  deploymentId: string;
  snapshotId: string;
  compositeScore: number;
  evidenceCeiling: number;
  compositeVerdict: AcceptanceVerdict;
  replayFidelityPercent: number;
  survivabilityPercent: number;
  overconfidenceDetected: boolean;
  overconfidenceReason: string | null;
  ambiguous: boolean;
  capturedAt: string;
}

export interface ProductionConfidenceTelemetryInput {
  institutionId: string;
  dataPoints: ConfidenceDataPoint[];
  windowStart: string;
  windowEnd: string;
}

// ── Output ─────────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  eventClass: TelemetryEventClass;
  snapshotId: string;
  score: number;
  evidenceCeiling: number;
  overconfidenceDetected: boolean;
  detail: string;
  occurredAt: string;
}

export interface ConfidenceDriftWindow {
  windowStart: string;
  windowEnd: string;
  openingScore: number;
  closingScore: number;
  delta: number;
  direction: ConfidenceTrendDirection;
  overconfidenceEpisodes: number;
  peakScore: number;
  troughScore: number;
}

export interface ProductionConfidenceTelemetryReport {
  schema: 'https://vitalcv.com/confidence-telemetry/v1';
  telemetryVersion: '1.0';
  institutionId: string;
  windowStart: string;
  windowEnd: string;
  dataPointCount: number;
  events: TelemetryEvent[];
  driftWindow: ConfidenceDriftWindow | null;
  currentScore: number | null;
  currentVerdict: AcceptanceVerdict | null;
  currentReplayFidelity: number | null;
  currentSurvivability: number | null;
  overconfidenceAlarmActive: boolean;
  confidenceIntegrityPercent: number;
  telemetryFingerprint: string;
  generatedAt: string;
}

// ── Exported sentinels ─────────────────────────────────────────────────────────

export const TELEMETRY_SENTINELS = {
  OVERCONFIDENCE_ALARM_THRESHOLD:  3,      // episodes in window before alarm fires
  MIN_SCORE_DELTA_FOR_EVENT:       5,      // below this delta, no drift event emitted
  VOLATILE_SWING_THRESHOLD:        15,     // score swing that qualifies as VOLATILE
} as const;

export const KNOWN_TELEMETRY_EVENTS: TelemetryEventClass[] = [
  'ACCEPTANCE_SCORED',
  'CONFIDENCE_CEILING_HIT',
  'OVERCONFIDENCE_DETECTED',
  'DRIFT_IMPROVEMENT',
  'DRIFT_DEGRADATION',
  'REPLAY_FIDELITY_CHANGE',
  'SURVIVABILITY_CHANGE',
];

// ── Internal helpers ───────────────────────────────────────────────────────────

function buildEvents(points: ConfidenceDataPoint[]): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  const sorted = [...points].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];

    events.push({
      eventClass: 'ACCEPTANCE_SCORED',
      snapshotId: p.snapshotId,
      score: p.compositeScore,
      evidenceCeiling: p.evidenceCeiling,
      overconfidenceDetected: p.overconfidenceDetected,
      detail: `Score ${p.compositeScore} (ceiling ${p.evidenceCeiling}) — verdict: ${p.compositeVerdict}`,
      occurredAt: p.capturedAt,
    });

    if (p.compositeScore >= p.evidenceCeiling && p.evidenceCeiling > 0) {
      events.push({
        eventClass: 'CONFIDENCE_CEILING_HIT',
        snapshotId: p.snapshotId,
        score: p.compositeScore,
        evidenceCeiling: p.evidenceCeiling,
        overconfidenceDetected: p.overconfidenceDetected,
        detail: `Score ${p.compositeScore} reached evidence ceiling ${p.evidenceCeiling}.`,
        occurredAt: p.capturedAt,
      });
    }

    if (p.overconfidenceDetected) {
      events.push({
        eventClass: 'OVERCONFIDENCE_DETECTED',
        snapshotId: p.snapshotId,
        score: p.compositeScore,
        evidenceCeiling: p.evidenceCeiling,
        overconfidenceDetected: true,
        detail: p.overconfidenceReason ?? 'Score exceeded evidence-derivable ceiling.',
        occurredAt: p.capturedAt,
      });
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const delta = p.compositeScore - prev.compositeScore;
      if (Math.abs(delta) >= TELEMETRY_SENTINELS.MIN_SCORE_DELTA_FOR_EVENT) {
        events.push({
          eventClass: delta > 0 ? 'DRIFT_IMPROVEMENT' : 'DRIFT_DEGRADATION',
          snapshotId: p.snapshotId,
          score: p.compositeScore,
          evidenceCeiling: p.evidenceCeiling,
          overconfidenceDetected: p.overconfidenceDetected,
          detail: `Score ${delta > 0 ? 'improved' : 'degraded'} by ${Math.abs(delta)} (${prev.compositeScore} → ${p.compositeScore}).`,
          occurredAt: p.capturedAt,
        });
      }
    }
  }

  return events;
}

function buildDriftWindow(
  points: ConfidenceDataPoint[],
  windowStart: string,
  windowEnd: string,
): ConfidenceDriftWindow | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );

  const scores     = sorted.map(p => p.compositeScore);
  const opening    = scores[0];
  const closing    = scores[scores.length - 1];
  const delta      = closing - opening;
  const peak       = Math.max(...scores);
  const trough     = Math.min(...scores);
  const swing      = peak - trough;
  const overEps    = sorted.filter(p => p.overconfidenceDetected).length;

  let direction: ConfidenceTrendDirection;
  if (swing >= TELEMETRY_SENTINELS.VOLATILE_SWING_THRESHOLD)      direction = 'VOLATILE';
  else if (delta > TELEMETRY_SENTINELS.MIN_SCORE_DELTA_FOR_EVENT) direction = 'IMPROVING';
  else if (delta < -TELEMETRY_SENTINELS.MIN_SCORE_DELTA_FOR_EVENT) direction = 'DEGRADING';
  else                                                              direction = 'STABLE';

  return {
    windowStart,
    windowEnd,
    openingScore: opening,
    closingScore: closing,
    delta,
    direction,
    overconfidenceEpisodes: overEps,
    peakScore: peak,
    troughScore: trough,
  };
}

function computeConfidenceIntegrityPercent(points: ConfidenceDataPoint[]): number {
  if (points.length === 0) return 0;
  const clean = points.filter(
    p => !p.overconfidenceDetected && p.compositeScore <= p.evidenceCeiling,
  ).length;
  return Math.round((clean / points.length) * 100);
}

export function generateProductionConfidenceTelemetry(
  input: ProductionConfidenceTelemetryInput,
  generatedAt: string,
): ProductionConfidenceTelemetryReport {
  const sorted = [...input.dataPoints].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );
  const latest = sorted.at(-1) ?? null;

  const events       = buildEvents(sorted);
  const driftWindow  = buildDriftWindow(sorted, input.windowStart, input.windowEnd);
  const overEpisodes = sorted.filter(p => p.overconfidenceDetected).length;
  const alarmActive  = overEpisodes >= TELEMETRY_SENTINELS.OVERCONFIDENCE_ALARM_THRESHOLD;

  const fingerprintPayload = {
    institutionId:  input.institutionId,
    windowStart:    input.windowStart,
    windowEnd:      input.windowEnd,
    snapshotIds:    sorted.map(p => p.snapshotId),
    scores:         sorted.map(p => p.compositeScore),
  };
  const telemetryFingerprint =
    createHash('sha256').update(JSON.stringify(fingerprintPayload)).digest('hex');

  return {
    schema: 'https://vitalcv.com/confidence-telemetry/v1',
    telemetryVersion: '1.0',
    institutionId: input.institutionId,
    windowStart: input.windowStart,
    windowEnd:   input.windowEnd,
    dataPointCount: sorted.length,
    events,
    driftWindow,
    currentScore:           latest?.compositeScore       ?? null,
    currentVerdict:         latest?.compositeVerdict     ?? null,
    currentReplayFidelity:  latest?.replayFidelityPercent ?? null,
    currentSurvivability:   latest?.survivabilityPercent ?? null,
    overconfidenceAlarmActive: alarmActive,
    confidenceIntegrityPercent: computeConfidenceIntegrityPercent(sorted),
    telemetryFingerprint,
    generatedAt,
  };
}
