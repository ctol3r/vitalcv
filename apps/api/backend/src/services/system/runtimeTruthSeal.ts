/**
 * runtimeTruthSeal.ts - W2-PR161A
 *
 * Pure runtime truth-seal evaluator. It seals supplied constitutional runtime
 * truth evidence against replay-truth mutation, ambiguity suppression,
 * telemetry unlocks, drift after seal, and confidence inflation.
 *
 * No fetches, no DB writes, no audit writes. Callers supply evidence; this
 * module returns deterministic lineage, fail-closed verdicts, gates, and
 * chaos signals.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type RuntimeTruthSealDomain =
  | 'global_truth_verification'
  | 'replay_truth_immutability'
  | 'ambiguity_permanence'
  | 'truth_telemetry_lock'
  | 'truth_drift_prevention'
  | 'runtime_truth_lineage'
  | 'longitudinal_truth_durability';

export interface RuntimeTruthSealEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeTruthSealDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  truthFidelity: number;
  replayFaithfulness: number;
  ambiguityPermanence: number;
  driftPrevention: number;
  runtimeStability: number;
  longitudinalDurability: number;
  sealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguityRefs: readonly string[];
  telemetryRefs: readonly string[];
  ambiguity: string | null;
}

export interface RuntimeTruthSealLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeTruthSealDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  ambiguityRefCount: number;
  telemetryRefCount: number;
  sealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  ambiguous: boolean;
  evidenceHash: string;
}

export interface RuntimeTruthSealLineage {
  schema: 'vitalcv.runtime-truth-seal-lineage.v1';
  sealId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly RuntimeTruthSealDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly RuntimeTruthSealLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type RuntimeTruthSealStatus =
  | 'RUNTIME_TRUTH_SEAL_READY'
  | 'RUNTIME_TRUTH_SEAL_DEGRADED'
  | 'RUNTIME_TRUTH_SEAL_BLOCKED';

export type RuntimeTruthSealVerdict =
  | 'RUNTIME_TRUTH_SEALED'
  | 'RUNTIME_TRUTH_SEALED_WITH_AMBIGUITY'
  | 'RUNTIME_TRUTH_PARTIAL'
  | 'RUNTIME_TRUTH_FAIL_CLOSED';

export interface RuntimeTruthSealResult {
  schema: 'vitalcv.runtime-truth-seal.v1';
  sealId: string;
  generatedAt: string;
  status: RuntimeTruthSealStatus;
  verdict: RuntimeTruthSealVerdict;
  failClosed: boolean;
  sealScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: RuntimeTruthSealLineage;
  replayTruth: {
    globallyFaithful: boolean;
    fidelityPct: number;
    traceCoveragePct: number;
    mutableEvidenceIds: readonly string[];
  };
  ambiguityPermanence: {
    permanent: boolean;
    permanencePct: number;
    ambiguityRefCoveragePct: number;
  };
  truthLineage: {
    reconstructable: boolean;
    evidenceRefCount: number;
    lineageRefCount: number;
  };
  truthTelemetry: {
    locked: boolean;
    lockPct: number;
    telemetryRefCount: number;
  };
  driftPrevention: {
    impossiblePostSeal: boolean;
    preventionPct: number;
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
  confidence: {
    score: number;
    basis: readonly string[];
  };
  sealHash: string;
}

export type RuntimeTruthSealGateId =
  | 'replay_truth_globally_faithful'
  | 'ambiguity_permanently_preserved'
  | 'truth_lineage_reconstructable'
  | 'fail_closed_truth_semantics'
  | 'drift_impossible_post_seal'
  | 'truth_telemetry_locked'
  | 'runtime_truth_longitudinally_durable';

export interface RuntimeTruthSealGate {
  id: RuntimeTruthSealGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface RuntimeTruthSealGateResult {
  schema: 'vitalcv.runtime-truth-seal-ci-gate.v1';
  pass: boolean;
  gates: readonly RuntimeTruthSealGate[];
  failedGateIds: readonly RuntimeTruthSealGateId[];
  gateHash: string;
}

export type RuntimeTruthSealChaosScenarioName =
  | 'REPLAY_TRUTH_MUTATION'
  | 'AMBIGUITY_SUPPRESSION'
  | 'LINEAGE_GAP'
  | 'TELEMETRY_UNLOCK'
  | 'DRIFT_PREVENTION_DROP'
  | 'FAIL_CLOSED_DISABLED'
  | 'LONGITUDINAL_DURABILITY_COLLAPSE'
  | 'CONFIDENCE_INFLATION';

export interface RuntimeTruthSealChaosScenarioResult {
  scenario: RuntimeTruthSealChaosScenarioName;
  signalSurfaced: boolean;
  status: RuntimeTruthSealStatus;
  failedGateIds: readonly RuntimeTruthSealGateId[];
  surfacedSignals: readonly string[];
}

export interface RuntimeTruthSealChaosReport {
  schema: 'vitalcv.runtime-truth-seal-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly RuntimeTruthSealChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface RuntimeTruthSealInput {
  sealId: string;
  generatedAt: string;
  evidence: readonly RuntimeTruthSealEvidence[];
}

const SCHEMA_LINEAGE = 'vitalcv.runtime-truth-seal-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-truth-seal.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-truth-seal-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-truth-seal-chaos.v1' as const;
const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;

const REQUIRED_DOMAINS: readonly RuntimeTruthSealDomain[] = Object.freeze([
  'global_truth_verification',
  'replay_truth_immutability',
  'ambiguity_permanence',
  'truth_telemetry_lock',
  'truth_drift_prevention',
  'runtime_truth_lineage',
  'longitudinal_truth_durability',
]);

export const RUNTIME_TRUTH_SEAL_GATE_IDS: readonly RuntimeTruthSealGateId[] = Object.freeze([
  'replay_truth_globally_faithful',
  'ambiguity_permanently_preserved',
  'truth_lineage_reconstructable',
  'fail_closed_truth_semantics',
  'drift_impossible_post_seal',
  'truth_telemetry_locked',
  'runtime_truth_longitudinally_durable',
]);

export const RUNTIME_TRUTH_SEAL_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeTruthSealDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  truthFidelity: number;
  replayFaithfulness: number;
  ambiguityPermanence: number;
  driftPrevention: number;
  runtimeStability: number;
  longitudinalDurability: number;
  sealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguityRefs: readonly string[];
  telemetryRefs: readonly string[];
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

function normalizeEvidence(evidence: readonly RuntimeTruthSealEvidence[]): NormalizedEvidence[] {
  return evidence
    .map((entry, index) => ({
      evidenceId: requiredString(entry.evidenceId, `missing-truth-evidence-${index}`),
      recordedAt: requiredString(entry.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: entry.domain,
      sourceSystemId: requiredString(entry.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanString(entry.replayTraceId),
      truthFidelity: clamp01(entry.truthFidelity),
      replayFaithfulness: clamp01(entry.replayFaithfulness),
      ambiguityPermanence: clamp01(entry.ambiguityPermanence),
      driftPrevention: clamp01(entry.driftPrevention),
      runtimeStability: clamp01(entry.runtimeStability),
      longitudinalDurability: clamp01(entry.longitudinalDurability),
      sealed: entry.sealed === true,
      immutable: entry.immutable === true,
      failClosedReady: entry.failClosedReady === true,
      evidenceRefs: dedupeSorted(entry.evidenceRefs),
      lineageRefs: dedupeSorted(entry.lineageRefs),
      ambiguityRefs: dedupeSorted(entry.ambiguityRefs),
      telemetryRefs: dedupeSorted(entry.telemetryRefs),
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
    truthFidelity: entry.truthFidelity,
    replayFaithfulness: entry.replayFaithfulness,
    ambiguityPermanence: entry.ambiguityPermanence,
    driftPrevention: entry.driftPrevention,
    runtimeStability: entry.runtimeStability,
    longitudinalDurability: entry.longitudinalDurability,
    sealed: entry.sealed,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    evidenceRefs: entry.evidenceRefs,
    lineageRefs: entry.lineageRefs,
    ambiguityRefs: entry.ambiguityRefs,
    telemetryRefs: entry.telemetryRefs,
    ambiguity: entry.ambiguity,
  });
}

function observedDomains(evidence: readonly NormalizedEvidence[]): RuntimeTruthSealDomain[] {
  const present = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.filter(domain => present.has(domain));
}

function hasAllRequiredDomains(evidence: readonly NormalizedEvidence[]): boolean {
  const present = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.every(domain => present.has(domain));
}

function buildLineageFromNormalized(input: {
  sealId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): RuntimeTruthSealLineage {
  const timeline: RuntimeTruthSealLineageEntry[] = input.evidence.map((entry, index) => ({
    position: index + 1,
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    evidenceRefCount: entry.evidenceRefs.length,
    lineageRefCount: entry.lineageRefs.length,
    ambiguityRefCount: entry.ambiguityRefs.length,
    telemetryRefCount: entry.telemetryRefs.length,
    sealed: entry.sealed,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    ambiguous: entry.ambiguity !== null,
    evidenceHash: evidenceHash(entry),
  }));
  const body = {
    schema: SCHEMA_LINEAGE,
    sealId: input.sealId,
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

export function buildRuntimeTruthSealLineage(input: RuntimeTruthSealInput): RuntimeTruthSealLineage {
  return buildLineageFromNormalized({
    ...input,
    evidence: normalizeEvidence(input.evidence),
  });
}

export function evaluateRuntimeTruthSeal(input: RuntimeTruthSealInput): RuntimeTruthSealResult {
  const evidence = normalizeEvidence(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const hasDomains = hasAllRequiredDomains(evidence);
  const traceCoveragePct = evidence.length > 0
    ? pct((evidence.filter(entry => entry.replayTraceId !== null).length / evidence.length) * 100)
    : 0;
  const truthFidelityPct = pct(average(evidence.map(entry => entry.truthFidelity)) * 100);
  const replayFaithfulnessPct = pct(average(evidence.map(entry => entry.replayFaithfulness)) * 100);
  const fidelityPct = pct((truthFidelityPct + replayFaithfulnessPct) / 2);
  const mutableEvidenceIds = evidence
    .filter(entry => !entry.sealed || !entry.immutable)
    .map(entry => entry.evidenceId);
  const allSealedImmutable = evidence.length > 0 && mutableEvidenceIds.length === 0;
  const globallyFaithful =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && fidelityPct >= MIN_SCORE
      && traceCoveragePct >= MIN_TRACE_COVERAGE
      && allSealedImmutable;

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
      && ambiguityRefCoveragePct === 100;

  const evidenceRefCount = evidence.reduce((sum, entry) => sum + entry.evidenceRefs.length, 0);
  const lineageRefCount = evidence.reduce((sum, entry) => sum + entry.lineageRefs.length, 0);
  const truthLineageReconstructable =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && evidence.every(entry => entry.evidenceRefs.length > 0)
      && evidence.every(entry => entry.lineageRefs.length > 0)
      && lineage.sourceSystemIds.length > 0;

  const telemetryRefCount = evidence.reduce((sum, entry) => sum + entry.telemetryRefs.length, 0);
  const telemetryCoveragePct = evidence.length > 0
    ? pct((evidence.filter(entry => entry.telemetryRefs.length > 0).length / evidence.length) * 100)
    : 0;
  const stabilityPct = pct(average(evidence.map(entry => entry.runtimeStability)) * 100);
  const lockPct = pct(stabilityPct * 0.6 + telemetryCoveragePct * 0.4);
  const telemetryLocked =
    hasDomains
      && evidence.some(entry => entry.domain === 'truth_telemetry_lock')
      && evidence.every(entry => entry.telemetryRefs.length > 0)
      && allSealedImmutable
      && stabilityPct >= MIN_SCORE;

  const preventionPct = pct(average(evidence.map(entry => entry.driftPrevention)) * 100);
  const driftRiskEvidenceIds = evidence
    .filter(entry => !entry.sealed || !entry.immutable || pct(entry.driftPrevention * 100) < MIN_SCORE)
    .map(entry => entry.evidenceId);
  const impossiblePostSeal =
    hasDomains
      && evidence.some(entry => entry.domain === 'truth_drift_prevention')
      && preventionPct >= MIN_SCORE
      && driftRiskEvidenceIds.length === 0;

  const durabilityPct = pct(average(evidence.map(entry => entry.longitudinalDurability)) * 100);
  const uniqueRecordedAt = new Set(evidence.map(entry => entry.recordedAt));
  const runtimeStable = stabilityPct >= MIN_SCORE && allSealedImmutable;
  const longitudinallyDurable =
    runtimeStable
      && hasDomains
      && evidence.some(entry => entry.domain === 'longitudinal_truth_durability')
      && durabilityPct >= MIN_SCORE
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt;

  const failClosedReady = evidence.length > 0 && evidence.every(entry => entry.failClosedReady);

  const blockers: string[] = [];
  if (!globallyFaithful) blockers.push('Replay truth is not globally faithful.');
  if (!ambiguityPermanent) blockers.push('Ambiguity permanence is not enforceable.');
  if (!truthLineageReconstructable) blockers.push('Truth lineage is not reconstructable.');
  if (!telemetryLocked) blockers.push('Truth telemetry is not locked.');
  if (!impossiblePostSeal) blockers.push('Post-seal drift prevention is not enforceable.');
  if (!failClosedReady) blockers.push('Fail-closed truth semantics are not ready.');
  if (!longitudinallyDurable) blockers.push('Runtime truth is not longitudinally durable.');

  const failClosed = blockers.length > 0;
  const rawSealScore = pct(
    fidelityPct * 0.22
      + permanencePct * 0.16
      + preventionPct * 0.17
      + lockPct * 0.14
      + stabilityPct * 0.15
      + durabilityPct * 0.16,
  );
  const sealScore = failClosed ? Math.min(rawSealScore, 49) : rawSealScore;
  const status: RuntimeTruthSealStatus = failClosed
    ? 'RUNTIME_TRUTH_SEAL_BLOCKED'
    : ambiguities.length > 0 || sealScore < 90
      ? 'RUNTIME_TRUTH_SEAL_DEGRADED'
      : 'RUNTIME_TRUTH_SEAL_READY';
  const verdict: RuntimeTruthSealVerdict = status === 'RUNTIME_TRUTH_SEAL_BLOCKED'
    ? 'RUNTIME_TRUTH_FAIL_CLOSED'
    : status === 'RUNTIME_TRUTH_SEAL_READY'
      ? 'RUNTIME_TRUTH_SEALED'
      : ambiguities.length > 0
        ? 'RUNTIME_TRUTH_SEALED_WITH_AMBIGUITY'
        : 'RUNTIME_TRUTH_PARTIAL';
  const basis: string[] = [];
  if (globallyFaithful) basis.push('replay_truth_globally_faithful');
  if (ambiguityPermanent) basis.push('ambiguity_permanently_preserved');
  if (truthLineageReconstructable) basis.push('truth_lineage_reconstructable');
  if (!failClosed) basis.push('fail_closed_truth_semantics');
  if (impossiblePostSeal) basis.push('drift_impossible_post_seal');
  if (telemetryLocked) basis.push('truth_telemetry_locked');
  if (longitudinallyDurable) basis.push('runtime_truth_longitudinally_durable');

  const body = {
    schema: SCHEMA_RESULT,
    sealId: input.sealId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    sealScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayTruth: {
      globallyFaithful,
      fidelityPct,
      traceCoveragePct,
      mutableEvidenceIds,
    },
    ambiguityPermanence: {
      permanent: ambiguityPermanent,
      permanencePct,
      ambiguityRefCoveragePct,
    },
    truthLineage: {
      reconstructable: truthLineageReconstructable,
      evidenceRefCount,
      lineageRefCount,
    },
    truthTelemetry: {
      locked: telemetryLocked,
      lockPct,
      telemetryRefCount,
    },
    driftPrevention: {
      impossiblePostSeal,
      preventionPct,
      driftRiskEvidenceIds,
    },
    runtimeTruth: {
      stable: runtimeStable,
      stabilityPct,
      longitudinallyDurable,
      durabilityPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    confidence: {
      score: sealScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    sealHash: sha256ForPayload(body),
  };
}

export function evaluateRuntimeTruthSealGate(
  result: RuntimeTruthSealResult,
): RuntimeTruthSealGateResult {
  const gates: RuntimeTruthSealGate[] = [
    {
      id: 'replay_truth_globally_faithful',
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
      id: 'truth_lineage_reconstructable',
      pass: result.truthLineage.reconstructable,
      observed: result.truthLineage.reconstructable,
      required: true,
    },
    {
      id: 'fail_closed_truth_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'drift_impossible_post_seal',
      pass: result.driftPrevention.impossiblePostSeal,
      observed: result.driftPrevention.preventionPct,
      required: MIN_SCORE,
    },
    {
      id: 'truth_telemetry_locked',
      pass: result.truthTelemetry.locked,
      observed: result.truthTelemetry.lockPct,
      required: MIN_SCORE,
    },
    {
      id: 'runtime_truth_longitudinally_durable',
      pass: result.runtimeTruth.longitudinallyDurable,
      observed: result.runtimeTruth.durabilityPct,
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
  scenario: RuntimeTruthSealChaosScenarioName,
  result: RuntimeTruthSealResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): RuntimeTruthSealChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateRuntimeTruthSealGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runRuntimeTruthSealChaosSimulations(
  input: RuntimeTruthSealInput,
): RuntimeTruthSealChaosReport {
  const baseline = evaluateRuntimeTruthSeal(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const replayMutation = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'replay_truth_immutability'
      ? {
        ...entry,
        replayTraceId: null,
        truthFidelity: 0.2,
        replayFaithfulness: 0.2,
        sealed: false,
        immutable: false,
      }
      : entry),
  });
  const replayGate = evaluateRuntimeTruthSealGate(replayMutation);

  const ambiguitySuppression = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      ambiguity: null,
      ambiguityRefs: [],
      ambiguityPermanence: 0.2,
    })),
  });
  const ambiguityGate = evaluateRuntimeTruthSealGate(ambiguitySuppression);
  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;

  const lineageGap = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'runtime_truth_lineage'
      ? { ...entry, evidenceRefs: [], lineageRefs: [] }
      : entry),
  });
  const lineageGate = evaluateRuntimeTruthSealGate(lineageGap);

  const telemetryUnlock = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'truth_telemetry_lock'
      ? { ...entry, telemetryRefs: [], sealed: false }
      : entry),
  });
  const telemetryGate = evaluateRuntimeTruthSealGate(telemetryUnlock);

  const driftDrop = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'truth_drift_prevention'
      ? { ...entry, driftPrevention: 0.1, immutable: false }
      : entry),
  });
  const driftGate = evaluateRuntimeTruthSealGate(driftDrop);

  const failClosedDisabled = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, failClosedReady: false })),
  });
  const failClosedGate = evaluateRuntimeTruthSealGate(failClosedDisabled);

  const longitudinalCollapse = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      recordedAt: '2026-05-11T00:00:00.000Z',
      longitudinalDurability: 0.2,
    })),
  });
  const longitudinalGate = evaluateRuntimeTruthSealGate(longitudinalCollapse);

  const confidenceInflation = evaluateRuntimeTruthSeal({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      truthFidelity: 1,
      replayFaithfulness: 1,
      ambiguityPermanence: 1,
      driftPrevention: 1,
      runtimeStability: 1,
      longitudinalDurability: 1,
      evidenceRefs: [],
      lineageRefs: [],
      telemetryRefs: [],
    })),
  });
  const confidenceGate = evaluateRuntimeTruthSealGate(confidenceInflation);

  const scenarios: RuntimeTruthSealChaosScenarioResult[] = [
    chaosScenario(
      'REPLAY_TRUTH_MUTATION',
      replayMutation,
      replayGate.failedGateIds.includes('replay_truth_globally_faithful'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed && ambiguityGate.failedGateIds.includes('ambiguity_permanently_preserved'),
      ambiguityGate.failedGateIds,
    ),
    chaosScenario(
      'LINEAGE_GAP',
      lineageGap,
      lineageGate.failedGateIds.includes('truth_lineage_reconstructable'),
      lineageGate.failedGateIds,
    ),
    chaosScenario(
      'TELEMETRY_UNLOCK',
      telemetryUnlock,
      telemetryGate.failedGateIds.includes('truth_telemetry_locked'),
      telemetryGate.failedGateIds,
    ),
    chaosScenario(
      'DRIFT_PREVENTION_DROP',
      driftDrop,
      driftGate.failedGateIds.includes('drift_impossible_post_seal'),
      driftGate.failedGateIds,
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
    chaosScenario(
      'CONFIDENCE_INFLATION',
      confidenceInflation,
      confidenceGate.failedGateIds.includes('truth_lineage_reconstructable')
        || confidenceGate.failedGateIds.includes('truth_telemetry_locked'),
      confidenceGate.failedGateIds,
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
