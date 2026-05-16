/**
 * runtimeTruthPermanence.ts - W2-PR168A
 *
 * Pure post-freeze runtime truth permanence verifier. It checks supplied
 * constitutional truth evidence for replay durability, ambiguity permanence,
 * drift telemetry, operational observability, evidence-derived scoring, and
 * longitudinal durability after runtime freeze.
 *
 * No fetches, no DB writes, no audit writes. Callers supply evidence; this
 * module returns deterministic lineage, fail-closed verdicts, gates, and
 * chaos signals.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type RuntimeTruthPermanenceDomain =
  | 'post_freeze_truth_verification'
  | 'replay_truth_durability'
  | 'ambiguity_permanence_validation'
  | 'truth_drift_telemetry'
  | 'runtime_truth_scoring'
  | 'institutional_truth_observability'
  | 'longitudinal_truth_durability';

export interface RuntimeTruthPermanenceEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeTruthPermanenceDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayFaithfulness: number;
  truthDurability: number;
  ambiguityPermanence: number;
  driftResistance: number;
  runtimeStability: number;
  truthScore: number;
  operationalObservability: number;
  longitudinalDurability: number;
  freezeSealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguityRefs: readonly string[];
  driftTelemetryRefs: readonly string[];
  observabilityRefs: readonly string[];
  ambiguity: string | null;
}

export interface RuntimeTruthPermanenceLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeTruthPermanenceDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  ambiguityRefCount: number;
  driftTelemetryRefCount: number;
  observabilityRefCount: number;
  freezeSealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  ambiguous: boolean;
  evidenceHash: string;
}

export interface RuntimeTruthPermanenceLineage {
  schema: 'vitalcv.runtime-truth-permanence-lineage.v1';
  permanenceId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly RuntimeTruthPermanenceDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly RuntimeTruthPermanenceLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type RuntimeTruthPermanenceStatus =
  | 'TRUTH_PERMANENCE_READY'
  | 'TRUTH_PERMANENCE_DEGRADED'
  | 'TRUTH_PERMANENCE_BLOCKED';

export type RuntimeTruthPermanenceVerdict =
  | 'TRUTH_PERMANENCE_VERIFIED'
  | 'TRUTH_PERMANENCE_VERIFIED_WITH_AMBIGUITY'
  | 'TRUTH_PERMANENCE_PARTIAL'
  | 'TRUTH_PERMANENCE_FAIL_CLOSED';

export interface RuntimeTruthPermanenceResult {
  schema: 'vitalcv.runtime-truth-permanence.v1';
  permanenceId: string;
  generatedAt: string;
  status: RuntimeTruthPermanenceStatus;
  verdict: RuntimeTruthPermanenceVerdict;
  failClosed: boolean;
  permanenceScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: RuntimeTruthPermanenceLineage;
  replayTruth: {
    globallyFaithful: boolean;
    fidelityPct: number;
    durabilityPct: number;
    traceCoveragePct: number;
    mutableEvidenceIds: readonly string[];
  };
  ambiguityPermanence: {
    permanent: boolean;
    permanencePct: number;
    ambiguityRefCoveragePct: number;
  };
  driftResistance: {
    impossiblePostFreeze: boolean;
    resistancePct: number;
    telemetryCoveragePct: number;
    driftRiskEvidenceIds: readonly string[];
  };
  runtimeTruth: {
    stable: boolean;
    stabilityPct: number;
    longitudinallyDurable: boolean;
    durabilityPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  institutionalTruth: {
    operationallyObservable: boolean;
    observabilityPct: number;
    observabilityRefCount: number;
  };
  truthScoring: {
    evidenceDerived: boolean;
    scorePct: number;
    evidenceRefCount: number;
    lineageRefCount: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  permanenceHash: string;
}

export type RuntimeTruthPermanenceGateId =
  | 'truth_globally_replay_faithful'
  | 'ambiguity_permanently_preserved'
  | 'drift_impossible_post_freeze'
  | 'fail_closed_truth_semantics'
  | 'runtime_truth_longitudinally_durable'
  | 'institutional_truth_operationally_observable'
  | 'truth_scoring_evidence_derived';

export interface RuntimeTruthPermanenceGate {
  id: RuntimeTruthPermanenceGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface RuntimeTruthPermanenceGateResult {
  schema: 'vitalcv.runtime-truth-permanence-ci-gate.v1';
  pass: boolean;
  gates: readonly RuntimeTruthPermanenceGate[];
  failedGateIds: readonly RuntimeTruthPermanenceGateId[];
  gateHash: string;
}

export type RuntimeTruthPermanenceChaosScenarioName =
  | 'REPLAY_DURABILITY_DROP'
  | 'AMBIGUITY_SUPPRESSION'
  | 'DRIFT_TELEMETRY_DROP'
  | 'POST_FREEZE_MUTATION'
  | 'OBSERVABILITY_DROP'
  | 'SCORING_EVIDENCE_GAP'
  | 'FAIL_CLOSED_DISABLED'
  | 'LONGITUDINAL_DURABILITY_COLLAPSE';

export interface RuntimeTruthPermanenceChaosScenarioResult {
  scenario: RuntimeTruthPermanenceChaosScenarioName;
  signalSurfaced: boolean;
  status: RuntimeTruthPermanenceStatus;
  failedGateIds: readonly RuntimeTruthPermanenceGateId[];
  surfacedSignals: readonly string[];
}

export interface RuntimeTruthPermanenceChaosReport {
  schema: 'vitalcv.runtime-truth-permanence-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly RuntimeTruthPermanenceChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface RuntimeTruthPermanenceInput {
  permanenceId: string;
  generatedAt: string;
  evidence: readonly RuntimeTruthPermanenceEvidence[];
}

const SCHEMA_LINEAGE = 'vitalcv.runtime-truth-permanence-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-truth-permanence.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-truth-permanence-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-truth-permanence-chaos.v1' as const;
const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;

const REQUIRED_DOMAINS: readonly RuntimeTruthPermanenceDomain[] = Object.freeze([
  'post_freeze_truth_verification',
  'replay_truth_durability',
  'ambiguity_permanence_validation',
  'truth_drift_telemetry',
  'runtime_truth_scoring',
  'institutional_truth_observability',
  'longitudinal_truth_durability',
]);

export const RUNTIME_TRUTH_PERMANENCE_GATE_IDS: readonly RuntimeTruthPermanenceGateId[] = Object.freeze([
  'truth_globally_replay_faithful',
  'ambiguity_permanently_preserved',
  'drift_impossible_post_freeze',
  'fail_closed_truth_semantics',
  'runtime_truth_longitudinally_durable',
  'institutional_truth_operationally_observable',
  'truth_scoring_evidence_derived',
]);

export const RUNTIME_TRUTH_PERMANENCE_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeTruthPermanenceDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayFaithfulness: number;
  truthDurability: number;
  ambiguityPermanence: number;
  driftResistance: number;
  runtimeStability: number;
  truthScore: number;
  operationalObservability: number;
  longitudinalDurability: number;
  freezeSealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguityRefs: readonly string[];
  driftTelemetryRefs: readonly string[];
  observabilityRefs: readonly string[];
  ambiguity: string | null;
}

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredString(value: string, fallback: string): string {
  return cleanString(value) ?? fallback;
}

function dedupeSorted(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map(value => cleanString(value)).filter((value): value is string => value !== null)),
  ).sort();
}

function dedupeChronological(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeEvidence(evidence: readonly RuntimeTruthPermanenceEvidence[]): NormalizedEvidence[] {
  return evidence
    .map((entry, index) => ({
      evidenceId: requiredString(entry.evidenceId, `missing-truth-permanence-${index}`),
      recordedAt: requiredString(entry.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: entry.domain,
      sourceSystemId: requiredString(entry.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanString(entry.replayTraceId),
      replayFaithfulness: clamp01(entry.replayFaithfulness),
      truthDurability: clamp01(entry.truthDurability),
      ambiguityPermanence: clamp01(entry.ambiguityPermanence),
      driftResistance: clamp01(entry.driftResistance),
      runtimeStability: clamp01(entry.runtimeStability),
      truthScore: clamp01(entry.truthScore),
      operationalObservability: clamp01(entry.operationalObservability),
      longitudinalDurability: clamp01(entry.longitudinalDurability),
      freezeSealed: entry.freezeSealed === true,
      immutable: entry.immutable === true,
      failClosedReady: entry.failClosedReady === true,
      evidenceRefs: dedupeSorted(entry.evidenceRefs),
      lineageRefs: dedupeSorted(entry.lineageRefs),
      ambiguityRefs: dedupeSorted(entry.ambiguityRefs),
      driftTelemetryRefs: dedupeSorted(entry.driftTelemetryRefs),
      observabilityRefs: dedupeSorted(entry.observabilityRefs),
      ambiguity: cleanString(entry.ambiguity),
    }))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.evidenceId.localeCompare(right.evidenceId));
}

function evidenceHash(entry: NormalizedEvidence): string {
  return sha256ForPayload({
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    replayFaithfulness: entry.replayFaithfulness,
    truthDurability: entry.truthDurability,
    ambiguityPermanence: entry.ambiguityPermanence,
    driftResistance: entry.driftResistance,
    runtimeStability: entry.runtimeStability,
    truthScore: entry.truthScore,
    operationalObservability: entry.operationalObservability,
    longitudinalDurability: entry.longitudinalDurability,
    freezeSealed: entry.freezeSealed,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    evidenceRefs: entry.evidenceRefs,
    lineageRefs: entry.lineageRefs,
    ambiguityRefs: entry.ambiguityRefs,
    driftTelemetryRefs: entry.driftTelemetryRefs,
    observabilityRefs: entry.observabilityRefs,
    ambiguity: entry.ambiguity,
  });
}

function observedDomains(evidence: readonly NormalizedEvidence[]): RuntimeTruthPermanenceDomain[] {
  const present = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.filter(domain => present.has(domain));
}

function hasAllRequiredDomains(evidence: readonly NormalizedEvidence[]): boolean {
  const present = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.every(domain => present.has(domain));
}

function coveragePct(
  evidence: readonly NormalizedEvidence[],
  key: keyof Pick<
    NormalizedEvidence,
    'evidenceRefs' | 'lineageRefs' | 'ambiguityRefs' | 'driftTelemetryRefs' | 'observabilityRefs'
  >,
): number {
  if (evidence.length === 0) return 0;
  return pct((evidence.filter(entry => entry[key].length > 0).length / evidence.length) * 100);
}

function buildLineageFromNormalized(input: {
  permanenceId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): RuntimeTruthPermanenceLineage {
  const timeline: RuntimeTruthPermanenceLineageEntry[] = input.evidence.map((entry, index) => ({
    position: index + 1,
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    evidenceRefCount: entry.evidenceRefs.length,
    lineageRefCount: entry.lineageRefs.length,
    ambiguityRefCount: entry.ambiguityRefs.length,
    driftTelemetryRefCount: entry.driftTelemetryRefs.length,
    observabilityRefCount: entry.observabilityRefs.length,
    freezeSealed: entry.freezeSealed,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    ambiguous: entry.ambiguity !== null,
    evidenceHash: evidenceHash(entry),
  }));
  const body = {
    schema: SCHEMA_LINEAGE,
    permanenceId: input.permanenceId,
    firstRecordedAt: timeline[0]?.recordedAt ?? null,
    lastRecordedAt: timeline[timeline.length - 1]?.recordedAt ?? null,
    domainsObserved: observedDomains(input.evidence),
    sourceSystemIds: dedupeSorted(input.evidence.map(entry => entry.sourceSystemId)),
    timeline,
    generatedAt: input.generatedAt,
  };

  return {
    ...body,
    lineageHash: sha256ForPayload(body),
  };
}

export function buildRuntimeTruthPermanenceLineage(
  input: RuntimeTruthPermanenceInput,
): RuntimeTruthPermanenceLineage {
  return buildLineageFromNormalized({
    ...input,
    evidence: normalizeEvidence(input.evidence),
  });
}

export function evaluateRuntimeTruthPermanence(
  input: RuntimeTruthPermanenceInput,
): RuntimeTruthPermanenceResult {
  const evidence = normalizeEvidence(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const hasDomains = hasAllRequiredDomains(evidence);
  const traceCoveragePct = evidence.length > 0
    ? pct((evidence.filter(entry => entry.replayTraceId !== null).length / evidence.length) * 100)
    : 0;
  const replayFidelityPct = pct(average(evidence.map(entry => entry.replayFaithfulness)) * 100);
  const truthDurabilityPct = pct(average(evidence.map(entry => entry.truthDurability)) * 100);
  const mutableEvidenceIds = evidence
    .filter(entry => !entry.freezeSealed || !entry.immutable)
    .map(entry => entry.evidenceId);
  const freezeImmutable = evidence.length > 0 && mutableEvidenceIds.length === 0;
  const globallyFaithful =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && replayFidelityPct >= MIN_SCORE
      && truthDurabilityPct >= MIN_SCORE
      && traceCoveragePct >= MIN_TRACE_COVERAGE
      && freezeImmutable
      && evidence.some(entry => entry.domain === 'replay_truth_durability');

  const ambiguities = dedupeChronological(evidence.map(entry => entry.ambiguity));
  const ambiguityPreserved = dedupeChronological(evidence.map(entry => entry.ambiguity)).length === ambiguities.length;
  const ambiguousEvidence = evidence.filter(entry => entry.ambiguity !== null);
  const ambiguityRefCoveragePct = ambiguousEvidence.length === 0
    ? 100
    : pct((ambiguousEvidence.filter(entry => entry.ambiguityRefs.length > 0).length / ambiguousEvidence.length) * 100);
  const permanencePct = pct(average(evidence.map(entry => entry.ambiguityPermanence)) * 100);
  const ambiguityPermanent =
    hasDomains
      && permanencePct >= MIN_SCORE
      && ambiguityPreserved
      && ambiguityRefCoveragePct === 100
      && evidence.some(entry => entry.domain === 'ambiguity_permanence_validation');

  const telemetryCoveragePct = coveragePct(evidence, 'driftTelemetryRefs');
  const resistancePct = pct(average(evidence.map(entry => entry.driftResistance)) * 100);
  const driftRiskEvidenceIds = evidence
    .filter(entry => !entry.freezeSealed || !entry.immutable || pct(entry.driftResistance * 100) < MIN_SCORE)
    .map(entry => entry.evidenceId);
  const impossiblePostFreeze =
    hasDomains
      && resistancePct >= MIN_SCORE
      && telemetryCoveragePct === 100
      && driftRiskEvidenceIds.length === 0
      && evidence.some(entry => entry.domain === 'truth_drift_telemetry');

  const stabilityPct = pct(average(evidence.map(entry => entry.runtimeStability)) * 100);
  const longitudinalDurabilityPct = pct(average(evidence.map(entry => entry.longitudinalDurability)) * 100);
  const uniqueRecordedAt = new Set(evidence.map(entry => entry.recordedAt));
  const runtimeStable = stabilityPct >= MIN_SCORE && freezeImmutable;
  const longitudinallyDurable =
    runtimeStable
      && hasDomains
      && longitudinalDurabilityPct >= MIN_SCORE
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt
      && evidence.some(entry => entry.domain === 'longitudinal_truth_durability');

  const observabilityPct = pct(average(evidence.map(entry => entry.operationalObservability)) * 100);
  const observabilityRefCount = evidence.reduce((sum, entry) => sum + entry.observabilityRefs.length, 0);
  const operationallyObservable =
    hasDomains
      && observabilityPct >= MIN_SCORE
      && coveragePct(evidence, 'observabilityRefs') === 100
      && evidence.some(entry => entry.domain === 'institutional_truth_observability');

  const scorePct = pct(average(evidence.map(entry => entry.truthScore)) * 100);
  const evidenceRefCount = evidence.reduce((sum, entry) => sum + entry.evidenceRefs.length, 0);
  const lineageRefCount = evidence.reduce((sum, entry) => sum + entry.lineageRefs.length, 0);
  const scoringEvidenceDerived =
    hasDomains
      && scorePct >= MIN_SCORE
      && coveragePct(evidence, 'evidenceRefs') === 100
      && coveragePct(evidence, 'lineageRefs') === 100
      && evidence.some(entry => entry.domain === 'runtime_truth_scoring');

  const failClosedReady = evidence.length > 0 && evidence.every(entry => entry.failClosedReady);

  const blockers: string[] = [];
  if (!globallyFaithful) blockers.push('Truth is not globally replay-faithful.');
  if (!ambiguityPermanent) blockers.push('Ambiguity is not permanently preserved.');
  if (!impossiblePostFreeze) blockers.push('Truth drift remains possible post-freeze.');
  if (!failClosedReady) blockers.push('Fail-closed truth semantics are not ready.');
  if (!longitudinallyDurable) blockers.push('Runtime truth is not longitudinally durable.');
  if (!operationallyObservable) blockers.push('Institutional truth is not operationally observable.');
  if (!scoringEvidenceDerived) blockers.push('Truth scoring is not evidence-derived.');

  const failClosed = blockers.length > 0;
  const rawPermanenceScore = pct(
    replayFidelityPct * 0.18
      + truthDurabilityPct * 0.16
      + permanencePct * 0.15
      + resistancePct * 0.16
      + stabilityPct * 0.13
      + observabilityPct * 0.11
      + longitudinalDurabilityPct * 0.11,
  );
  const permanenceScore = failClosed ? Math.min(rawPermanenceScore, 49) : rawPermanenceScore;
  const status: RuntimeTruthPermanenceStatus = failClosed
    ? 'TRUTH_PERMANENCE_BLOCKED'
    : ambiguities.length > 0 || permanenceScore < 90
      ? 'TRUTH_PERMANENCE_DEGRADED'
      : 'TRUTH_PERMANENCE_READY';
  const verdict: RuntimeTruthPermanenceVerdict = status === 'TRUTH_PERMANENCE_BLOCKED'
    ? 'TRUTH_PERMANENCE_FAIL_CLOSED'
    : status === 'TRUTH_PERMANENCE_READY'
      ? 'TRUTH_PERMANENCE_VERIFIED'
      : ambiguities.length > 0
        ? 'TRUTH_PERMANENCE_VERIFIED_WITH_AMBIGUITY'
        : 'TRUTH_PERMANENCE_PARTIAL';

  const basis: string[] = [];
  if (globallyFaithful) basis.push('truth_globally_replay_faithful');
  if (ambiguityPermanent) basis.push('ambiguity_permanently_preserved');
  if (impossiblePostFreeze) basis.push('drift_impossible_post_freeze');
  if (!failClosed) basis.push('fail_closed_truth_semantics');
  if (longitudinallyDurable) basis.push('runtime_truth_longitudinally_durable');
  if (operationallyObservable) basis.push('institutional_truth_operationally_observable');
  if (scoringEvidenceDerived) basis.push('truth_scoring_evidence_derived');

  const body = {
    schema: SCHEMA_RESULT,
    permanenceId: input.permanenceId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    permanenceScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayTruth: {
      globallyFaithful,
      fidelityPct: replayFidelityPct,
      durabilityPct: truthDurabilityPct,
      traceCoveragePct,
      mutableEvidenceIds,
    },
    ambiguityPermanence: {
      permanent: ambiguityPermanent,
      permanencePct,
      ambiguityRefCoveragePct,
    },
    driftResistance: {
      impossiblePostFreeze,
      resistancePct,
      telemetryCoveragePct,
      driftRiskEvidenceIds,
    },
    runtimeTruth: {
      stable: runtimeStable,
      stabilityPct,
      longitudinallyDurable,
      durabilityPct: longitudinalDurabilityPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    institutionalTruth: {
      operationallyObservable,
      observabilityPct,
      observabilityRefCount,
    },
    truthScoring: {
      evidenceDerived: scoringEvidenceDerived,
      scorePct,
      evidenceRefCount,
      lineageRefCount,
    },
    confidence: {
      score: permanenceScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    permanenceHash: sha256ForPayload(body),
  };
}

export function evaluateRuntimeTruthPermanenceGate(
  result: RuntimeTruthPermanenceResult,
): RuntimeTruthPermanenceGateResult {
  const gates: RuntimeTruthPermanenceGate[] = [
    {
      id: 'truth_globally_replay_faithful',
      pass: result.replayTruth.globallyFaithful,
      observed: result.replayTruth.fidelityPct,
      required: MIN_SCORE,
    },
    {
      id: 'ambiguity_permanently_preserved',
      pass: result.ambiguityPermanence.permanent,
      observed: result.ambiguityPermanence.permanencePct,
      required: MIN_SCORE,
    },
    {
      id: 'drift_impossible_post_freeze',
      pass: result.driftResistance.impossiblePostFreeze,
      observed: result.driftResistance.resistancePct,
      required: MIN_SCORE,
    },
    {
      id: 'fail_closed_truth_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'runtime_truth_longitudinally_durable',
      pass: result.runtimeTruth.longitudinallyDurable,
      observed: result.runtimeTruth.durabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'institutional_truth_operationally_observable',
      pass: result.institutionalTruth.operationallyObservable,
      observed: result.institutionalTruth.observabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'truth_scoring_evidence_derived',
      pass: result.truthScoring.evidenceDerived,
      observed: result.truthScoring.scorePct,
      required: MIN_SCORE,
    },
  ];
  const failedGateIds = gates
    .filter(gate => !gate.pass)
    .map(gate => gate.id);
  const body = {
    schema: SCHEMA_GATE,
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };

  return {
    ...body,
    gateHash: sha256ForPayload(body),
  };
}

function chaosScenario(
  scenario: RuntimeTruthPermanenceChaosScenarioName,
  result: RuntimeTruthPermanenceResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): RuntimeTruthPermanenceChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateRuntimeTruthPermanenceGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runRuntimeTruthPermanenceChaosSimulations(
  input: RuntimeTruthPermanenceInput,
): RuntimeTruthPermanenceChaosReport {
  const baseline = evaluateRuntimeTruthPermanence(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const replayDurabilityDrop = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      replayTraceId: null,
      replayFaithfulness: entry.domain === 'replay_truth_durability' ? 0.1 : entry.replayFaithfulness,
      truthDurability: entry.domain === 'replay_truth_durability' ? 0.1 : entry.truthDurability,
    })),
  });
  const replayGate = evaluateRuntimeTruthPermanenceGate(replayDurabilityDrop);

  const ambiguitySuppression = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      ambiguity: null,
      ambiguityRefs: [],
      ambiguityPermanence: 0.2,
    })),
  });
  const ambiguityGate = evaluateRuntimeTruthPermanenceGate(ambiguitySuppression);
  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;

  const driftTelemetryDrop = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'truth_drift_telemetry'
      ? { ...entry, driftTelemetryRefs: [], driftResistance: 0.1 }
      : entry),
  });
  const driftGate = evaluateRuntimeTruthPermanenceGate(driftTelemetryDrop);

  const postFreezeMutation = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'post_freeze_truth_verification'
      ? { ...entry, freezeSealed: false, immutable: false }
      : entry),
  });
  const mutationGate = evaluateRuntimeTruthPermanenceGate(postFreezeMutation);

  const observabilityDrop = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'institutional_truth_observability'
      ? { ...entry, observabilityRefs: [], operationalObservability: 0.1 }
      : entry),
  });
  const observabilityGate = evaluateRuntimeTruthPermanenceGate(observabilityDrop);

  const scoringEvidenceGap = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'runtime_truth_scoring'
      ? { ...entry, evidenceRefs: [], lineageRefs: [], truthScore: 0.1 }
      : entry),
  });
  const scoringGate = evaluateRuntimeTruthPermanenceGate(scoringEvidenceGap);

  const failClosedDisabled = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, failClosedReady: false })),
  });
  const failClosedGate = evaluateRuntimeTruthPermanenceGate(failClosedDisabled);

  const longitudinalCollapse = evaluateRuntimeTruthPermanence({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      recordedAt: '2026-05-11T01:00:00.000Z',
      runtimeStability: 0.2,
      longitudinalDurability: 0.2,
    })),
  });
  const longitudinalGate = evaluateRuntimeTruthPermanenceGate(longitudinalCollapse);

  const scenarios: RuntimeTruthPermanenceChaosScenarioResult[] = [
    chaosScenario(
      'REPLAY_DURABILITY_DROP',
      replayDurabilityDrop,
      replayGate.failedGateIds.includes('truth_globally_replay_faithful'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed && ambiguityGate.failedGateIds.includes('ambiguity_permanently_preserved'),
      ambiguityGate.failedGateIds,
    ),
    chaosScenario(
      'DRIFT_TELEMETRY_DROP',
      driftTelemetryDrop,
      driftGate.failedGateIds.includes('drift_impossible_post_freeze'),
      driftGate.failedGateIds,
    ),
    chaosScenario(
      'POST_FREEZE_MUTATION',
      postFreezeMutation,
      mutationGate.failedGateIds.includes('truth_globally_replay_faithful')
        || mutationGate.failedGateIds.includes('drift_impossible_post_freeze'),
      mutationGate.failedGateIds,
    ),
    chaosScenario(
      'OBSERVABILITY_DROP',
      observabilityDrop,
      observabilityGate.failedGateIds.includes('institutional_truth_operationally_observable'),
      observabilityGate.failedGateIds,
    ),
    chaosScenario(
      'SCORING_EVIDENCE_GAP',
      scoringEvidenceGap,
      scoringGate.failedGateIds.includes('truth_scoring_evidence_derived'),
      scoringGate.failedGateIds,
    ),
    chaosScenario(
      'FAIL_CLOSED_DISABLED',
      failClosedDisabled,
      failClosedGate.failedGateIds.includes('fail_closed_truth_semantics'),
      failClosedGate.failedGateIds,
    ),
    chaosScenario(
      'LONGITUDINAL_DURABILITY_COLLAPSE',
      longitudinalCollapse,
      longitudinalGate.failedGateIds.includes('runtime_truth_longitudinally_durable'),
      longitudinalGate.failedGateIds,
    ),
  ];
  const body = {
    schema: SCHEMA_CHAOS,
    totalScenarios: scenarios.length,
    silentFailureCount: scenarios.filter(scenario => !scenario.signalSurfaced).length,
    scenarios,
    generatedAt: input.generatedAt,
  };

  return {
    ...body,
    reportHash: sha256ForPayload(body),
  };
}
