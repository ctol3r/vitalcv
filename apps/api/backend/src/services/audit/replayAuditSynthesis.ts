/**
 * replayAuditSynthesis.ts — Replay Audit Synthesis Engine (W2-PR124A)
 *
 * Synthesizes multi-capsule replay evidence into a consolidated SAFE-style
 * audit synthesis package. Sits on top of the raw replayEngine output and
 * produces a higher-level narrative that external auditors can act on.
 *
 * Key synthesis operations:
 *   - Cross-capsule evidence convergence (are the same credentials confirmed
 *     across multiple decisions consistently?)
 *   - Temporal drift detection (same credential appearing with different
 *     status across time)
 *   - Ambiguity quantification (what fraction of decisions could not be
 *     cleanly classified?)
 *   - Survivability window estimation (how far back does the replay record
 *     remain structurally intact?)
 *
 * Design contract:
 *   - Pure transform — no DB access, no network calls
 *   - Ambiguity is never collapsed — synthesis surfaces it explicitly
 *   - Fail-closed: partial data → partial synthesis with explicit gaps flagged
 */

import { createHash } from 'crypto';
import type { SAFEBundleInput, SAFEReplayInput, SafeEvidenceEnvelope } from './safeAuditAdapters';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReplayAuditSynthesis {
  schema: 'vitalcv.replay-synthesis/v1';
  synthesisId: string;
  synthesizedAt: string;
  sourceBundle: {
    bundleId: string;
    capsuleCount: number;
    bundleHash: string;
  };
  convergenceReport: ConvergenceReport;
  temporalDriftReport: TemporalDriftReport;
  ambiguityQuantification: AmbiguityQuantification;
  survivabilityWindow: SurvivabilityWindow;
  synthesisIntegrity: SynthesisIntegrity;
  gaps: SynthesisGap[];
}

export interface ConvergenceReport {
  credentialTypes: ConvergedCredential[];
  convergenceScore: number;     // 0–100: fraction of credential types consistently confirmed
  divergenceCount: number;      // credentials with conflicting statuses across capsules
}

export interface ConvergedCredential {
  credentialType: string;
  observedStatuses: string[];
  consensusStatus: string | null;   // null if genuinely ambiguous
  capsuleIds: string[];
  convergent: boolean;
  ambiguous: boolean;
}

export interface TemporalDriftReport {
  driftEvents: DriftEvent[];
  driftCount: number;
  earliestEvent: string | null;
  latestEvent: string | null;
}

export interface DriftEvent {
  credentialType: string;
  artifactId: string | null;
  priorStatus: string;
  currentStatus: string;
  priorTimestamp: string;
  currentTimestamp: string;
  driftGapDays: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

export interface AmbiguityQuantification {
  totalDecisions: number;
  ambiguousDecisions: number;
  ambiguityRate: number;    // 0.0–1.0
  quarantinedDecisions: number;
  cleanDecisions: number;
  unresolvedAmbiguities: string[];  // capsuleIds that remain AMBIGUOUS
}

export interface SurvivabilityWindow {
  windowStart: string | null;
  windowEnd: string | null;
  intactCapsules: number;
  totalCapsules: number;
  intactRate: number;         // 0.0–1.0
  oldestIntactTimestamp: string | null;
  survivabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  notes: string[];
}

export interface SynthesisIntegrity {
  synthesisHash: string;    // SHA-256(synthesis payload minus this field)
  sourceVerifiable: boolean;
  hashChainIntact: boolean;
  failClosedGaps: number;
}

export interface SynthesisGap {
  gapId: string;
  field: string;
  reason: string;
  severity: 'BLOCKING' | 'DEGRADED' | 'INFORMATIONAL';
}

// ── Main Synthesizer ──────────────────────────────────────────────────────────

export function synthesizeReplayAudit(
  bundle: SAFEBundleInput,
  safeEnvelope?: SafeEvidenceEnvelope,
): ReplayAuditSynthesis {
  const synthesisId = `syn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const synthesizedAt = new Date().toISOString();
  const gaps: SynthesisGap[] = [];

  const replays = bundle.replays ?? [];

  if (!replays.length) {
    gaps.push({
      gapId: 'gap:no-replays',
      field: 'bundle.replays',
      reason: 'Bundle contains no replay records — synthesis is structural only',
      severity: 'BLOCKING',
    });
  }

  const convergenceReport = computeConvergence(replays, gaps);
  const temporalDriftReport = computeTemporalDrift(replays, gaps);
  const ambiguityQuantification = computeAmbiguity(replays, gaps);
  const survivabilityWindow = computeSurvivabilityWindow(replays, gaps);

  const synthesisIntegrity = computeSynthesisIntegrity({
    bundleId: bundle.bundleId,
    bundleHash: bundle.bundleHash,
    capsuleCount: bundle.capsuleCount,
    convergenceScore: convergenceReport.convergenceScore,
    ambiguityRate: ambiguityQuantification.ambiguityRate,
    survivabilityGrade: survivabilityWindow.survivabilityGrade,
    gaps: gaps.length,
  });

  return {
    schema: 'vitalcv.replay-synthesis/v1',
    synthesisId,
    synthesizedAt,
    sourceBundle: {
      bundleId: bundle.bundleId,
      capsuleCount: bundle.capsuleCount,
      bundleHash: bundle.bundleHash,
    },
    convergenceReport,
    temporalDriftReport,
    ambiguityQuantification,
    survivabilityWindow,
    synthesisIntegrity,
    gaps,
  };
}

// ── Convergence ───────────────────────────────────────────────────────────────

function computeConvergence(replays: SAFEReplayInput[], gaps: SynthesisGap[]): ConvergenceReport {
  // Group evidence by credentialType across all replays
  const byType = new Map<string, { statuses: string[]; capsuleIds: string[] }>();

  for (const replay of replays) {
    const evidence = replay.evidence ?? [];
    for (const e of evidence) {
      const key = e.credentialType ?? 'UNKNOWN';
      if (!byType.has(key)) byType.set(key, { statuses: [], capsuleIds: [] });
      const entry = byType.get(key)!;
      entry.statuses.push(e.status ?? 'UNKNOWN');
      if (!entry.capsuleIds.includes(replay.capsuleId)) {
        entry.capsuleIds.push(replay.capsuleId);
      }
    }
  }

  if (!byType.size) {
    gaps.push({
      gapId: 'gap:convergence-no-evidence',
      field: 'convergenceReport',
      reason: 'No evidence items across replays — convergence score defaults to 0',
      severity: 'BLOCKING',
    });
    return { credentialTypes: [], convergenceScore: 0, divergenceCount: 0 };
  }

  const credentialTypes: ConvergedCredential[] = [];
  let convergentCount = 0;
  let divergenceCount = 0;

  for (const [credentialType, { statuses, capsuleIds }] of byType) {
    const unique = [...new Set(statuses)];
    const convergent = unique.length === 1;
    const ambiguous = unique.length > 1 && unique.includes('UNKNOWN');

    let consensusStatus: string | null = null;
    if (convergent) {
      consensusStatus = unique[0];
      convergentCount++;
    } else {
      divergenceCount++;
    }

    credentialTypes.push({
      credentialType,
      observedStatuses: unique,
      consensusStatus,
      capsuleIds,
      convergent,
      ambiguous,
    });
  }

  const convergenceScore =
    byType.size > 0 ? Math.round((convergentCount / byType.size) * 100) : 0;

  return { credentialTypes, convergenceScore, divergenceCount };
}

// ── Temporal Drift ────────────────────────────────────────────────────────────

function computeTemporalDrift(
  replays: SAFEReplayInput[],
  gaps: SynthesisGap[],
): TemporalDriftReport {
  // Build per-credential-type time-ordered status observations
  const observations = new Map<string, Array<{ status: string; ts: string; artifactId: string | null }>>();

  for (const replay of replays) {
    const ts = replay.decision?.decisionTimestamp ?? null;
    if (!ts) continue;
    for (const e of replay.evidence ?? []) {
      const key = e.credentialType ?? 'UNKNOWN';
      if (!observations.has(key)) observations.set(key, []);
      observations.get(key)!.push({
        status: e.status ?? 'UNKNOWN',
        ts,
        artifactId: e.artifactId ?? null,
      });
    }
  }

  const driftEvents: DriftEvent[] = [];

  for (const [credentialType, obs] of observations) {
    const sorted = obs.sort((a, b) => a.ts.localeCompare(b.ts));
    for (let i = 1; i < sorted.length; i++) {
      const prior = sorted[i - 1];
      const current = sorted[i];
      if (prior.status !== current.status) {
        const priorDate = new Date(prior.ts);
        const currentDate = new Date(current.ts);
        const driftGapDays = Math.round(
          (currentDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        const severity: DriftEvent['severity'] =
          ['VERIFIED', 'EXPIRED'].includes(current.status) ? 'WARNING'
          : current.status === 'FAILED' ? 'CRITICAL'
          : 'INFO';

        driftEvents.push({
          credentialType,
          artifactId: current.artifactId,
          priorStatus: prior.status,
          currentStatus: current.status,
          priorTimestamp: prior.ts,
          currentTimestamp: current.ts,
          driftGapDays,
          severity,
        });
      }
    }
  }

  if (!driftEvents.length && !observations.size) {
    gaps.push({
      gapId: 'gap:temporal-no-timestamps',
      field: 'temporalDriftReport',
      reason: 'No timestamped evidence — drift detection is unavailable',
      severity: 'DEGRADED',
    });
  }

  const timestamps = driftEvents.flatMap((d) => [d.priorTimestamp, d.currentTimestamp]).sort();

  return {
    driftEvents,
    driftCount: driftEvents.length,
    earliestEvent: timestamps[0] ?? null,
    latestEvent: timestamps[timestamps.length - 1] ?? null,
  };
}

// ── Ambiguity Quantification ──────────────────────────────────────────────────

function computeAmbiguity(
  replays: SAFEReplayInput[],
  _gaps: SynthesisGap[],
): AmbiguityQuantification {
  const totalDecisions = replays.length;
  const ambiguousDecisions = replays.filter(
    (r) => r.containment?.verdict === 'AMBIGUOUS',
  ).length;
  const quarantinedDecisions = replays.filter(
    (r) => r.containment?.verdict === 'QUARANTINED' || r.containment?.verdict === 'CONTAINMENT_BREACH',
  ).length;
  const cleanDecisions = replays.filter((r) => r.containment?.verdict === 'CLEAN').length;
  const unresolvedAmbiguities = replays
    .filter((r) => r.containment?.verdict === 'AMBIGUOUS')
    .map((r) => r.capsuleId);

  return {
    totalDecisions,
    ambiguousDecisions,
    ambiguityRate: totalDecisions > 0 ? ambiguousDecisions / totalDecisions : 0,
    quarantinedDecisions,
    cleanDecisions,
    unresolvedAmbiguities,
  };
}

// ── Survivability Window ──────────────────────────────────────────────────────

function computeSurvivabilityWindow(
  replays: SAFEReplayInput[],
  gaps: SynthesisGap[],
): SurvivabilityWindow {
  const intactReplays = replays.filter((r) => r.containment?.verdict === 'CLEAN');
  const intactTimestamps = intactReplays
    .map((r) => r.decision?.decisionTimestamp)
    .filter((t): t is string => !!t)
    .sort();

  const allTimestamps = replays
    .map((r) => r.decision?.decisionTimestamp)
    .filter((t): t is string => !!t)
    .sort();

  const intactRate = replays.length > 0 ? intactReplays.length / replays.length : 0;

  const notes: string[] = [];
  if (intactRate < 0.5) notes.push('Fewer than half of capsules are CLEAN — audit evidence is significantly degraded');
  if (!intactTimestamps.length) notes.push('No intact capsules with timestamps — survivability window indeterminate');
  if (replays.some((r) => r.containment?.verdict === 'CONTAINMENT_BREACH')) {
    notes.push('One or more CONTAINMENT_BREACH capsules detected — potential audit trail corruption');
    gaps.push({
      gapId: 'gap:containment-breach',
      field: 'survivabilityWindow',
      reason: 'CONTAINMENT_BREACH capsules degrade replay survivability below threshold',
      severity: 'BLOCKING',
    });
  }

  const survivabilityGrade = gradeFromRate(intactRate);

  return {
    windowStart: allTimestamps[0] ?? null,
    windowEnd: allTimestamps[allTimestamps.length - 1] ?? null,
    intactCapsules: intactReplays.length,
    totalCapsules: replays.length,
    intactRate,
    oldestIntactTimestamp: intactTimestamps[0] ?? null,
    survivabilityGrade,
    notes,
  };
}

function gradeFromRate(rate: number): SurvivabilityWindow['survivabilityGrade'] {
  if (rate >= 0.95) return 'A';
  if (rate >= 0.80) return 'B';
  if (rate >= 0.65) return 'C';
  if (rate >= 0.50) return 'D';
  return 'F';
}

// ── Synthesis Integrity ───────────────────────────────────────────────────────

function computeSynthesisIntegrity(payload: Record<string, unknown>): SynthesisIntegrity {
  const failClosedGaps = typeof payload.gaps === 'number' ? (payload.gaps as number) : 0;
  const canonical = JSON.stringify(payload);
  const synthesisHash = createHash('sha256').update(canonical, 'utf8').digest('hex');

  return {
    synthesisHash,
    sourceVerifiable: !!(payload.bundleHash),
    hashChainIntact: failClosedGaps === 0,
    failClosedGaps,
  };
}
