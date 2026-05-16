/**
 * runtimeMergeFreeze.ts - W3-PR189A
 *
 * Pure constitutional runtime merge-freeze evaluator. It verifies supplied
 * freeze evidence after replay integrity and stewardship enforcement land,
 * preserving ambiguity while making governance drift and fail-open freeze
 * semantics visible.
 *
 * No fetches, no DB writes, no audit writes. Callers supply evidence; this
 * module returns deterministic lineage, fail-closed verdicts, gates, and
 * chaos signals.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type RuntimeMergeFreezeDomain =
  | 'merge_freeze_verification'
  | 'replay_freeze_harmonization'
  | 'governance_immutability_validation'
  | 'freeze_telemetry'
  | 'runtime_drift_scoring'
  | 'stewardship_enforcement'
  | 'merge_lineage_reconstruction';

export interface RuntimeMergeFreezeEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeMergeFreezeDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  freezeIntegrity: number;
  replayFreezeIntegrity: number;
  governanceImmutability: number;
  driftResistance: number;
  runtimeContinuity: number;
  ambiguityPermanence: number;
  immutablePostFreeze: boolean;
  governanceLocked: boolean;
  failClosedReady: boolean;
  mergeLineageRefs: readonly string[];
  replayFreezeRefs: readonly string[];
  governanceRefs: readonly string[];
  telemetryRefs: readonly string[];
  driftRefs: readonly string[];
  ambiguityRefs: readonly string[];
  stewardshipRefs: readonly string[];
  ambiguity: string | null;
}

export interface RuntimeMergeFreezeLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeMergeFreezeDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  mergeLineageRefCount: number;
  replayFreezeRefCount: number;
  governanceRefCount: number;
  telemetryRefCount: number;
  driftRefCount: number;
  ambiguityRefCount: number;
  stewardshipRefCount: number;
  immutablePostFreeze: boolean;
  governanceLocked: boolean;
  failClosedReady: boolean;
  ambiguous: boolean;
  evidenceHash: string;
}

export interface RuntimeMergeFreezeLineage {
  schema: 'vitalcv.runtime-merge-freeze-lineage.v1';
  freezeId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly RuntimeMergeFreezeDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly RuntimeMergeFreezeLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type RuntimeMergeFreezeStatus =
  | 'RUNTIME_MERGE_FREEZE_READY'
  | 'RUNTIME_MERGE_FREEZE_DEGRADED'
  | 'RUNTIME_MERGE_FREEZE_BLOCKED';

export type RuntimeMergeFreezeVerdict =
  | 'CONSTITUTIONAL_RUNTIME_MERGE_FROZEN'
  | 'CONSTITUTIONAL_RUNTIME_MERGE_FROZEN_WITH_AMBIGUITY'
  | 'CONSTITUTIONAL_RUNTIME_MERGE_FREEZE_PARTIAL'
  | 'CONSTITUTIONAL_RUNTIME_MERGE_FREEZE_FAIL_CLOSED';

export interface RuntimeMergeFreezeResult {
  schema: 'vitalcv.runtime-merge-freeze.v1';
  freezeId: string;
  generatedAt: string;
  status: RuntimeMergeFreezeStatus;
  verdict: RuntimeMergeFreezeVerdict;
  failClosed: boolean;
  freezeScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: RuntimeMergeFreezeLineage;
  mergeFreeze: {
    verified: boolean;
    integrityPct: number;
  };
  replayFreeze: {
    immutablePostFreeze: boolean;
    integrityPct: number;
    traceCoveragePct: number;
    mutableEvidenceIds: readonly string[];
  };
  governance: {
    driftImpossible: boolean;
    immutabilityPct: number;
    lockedCoveragePct: number;
  };
  ambiguityPermanence: {
    preserved: boolean;
    permanencePct: number;
    ambiguityRefCoveragePct: number;
  };
  freezeTelemetry: {
    observable: boolean;
    telemetryCoveragePct: number;
    telemetryRefCount: number;
  };
  driftResistance: {
    resistant: boolean;
    resistancePct: number;
    driftRefCount: number;
  };
  runtimeContinuity: {
    measurable: boolean;
    continuityPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  mergeLineage: {
    reconstructable: boolean;
    domainCoverage: number;
    lineageRefCount: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  freezeHash: string;
}

export type RuntimeMergeFreezeGateId =
  | 'merge_freeze_verified'
  | 'replay_integrity_immutable_post_freeze'
  | 'governance_drift_impossible'
  | 'ambiguity_permanence_preserved'
  | 'fail_closed_freeze_semantics'
  | 'runtime_continuity_measurable'
  | 'merge_lineage_reconstructable';

export interface RuntimeMergeFreezeGate {
  id: RuntimeMergeFreezeGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface RuntimeMergeFreezeGateResult {
  schema: 'vitalcv.runtime-merge-freeze-ci-gate.v1';
  pass: boolean;
  gates: readonly RuntimeMergeFreezeGate[];
  failedGateIds: readonly RuntimeMergeFreezeGateId[];
  gateHash: string;
}

export type RuntimeMergeFreezeChaosScenarioName =
  | 'MERGE_FREEZE_VERIFICATION_DROP'
  | 'REPLAY_FREEZE_MUTATION'
  | 'GOVERNANCE_DRIFT_UNLOCK'
  | 'AMBIGUITY_SUPPRESSION'
  | 'TELEMETRY_DROP'
  | 'DRIFT_SCORE_COLLAPSE'
  | 'FAIL_CLOSED_DISABLED'
  | 'LINEAGE_GAP';

export interface RuntimeMergeFreezeChaosScenarioResult {
  scenario: RuntimeMergeFreezeChaosScenarioName;
  signalSurfaced: boolean;
  status: RuntimeMergeFreezeStatus;
  failedGateIds: readonly RuntimeMergeFreezeGateId[];
  surfacedSignals: readonly string[];
}

export interface RuntimeMergeFreezeChaosReport {
  schema: 'vitalcv.runtime-merge-freeze-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly RuntimeMergeFreezeChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface RuntimeMergeFreezeInput {
  freezeId: string;
  generatedAt: string;
  evidence: readonly RuntimeMergeFreezeEvidence[];
}

const SCHEMA_LINEAGE = 'vitalcv.runtime-merge-freeze-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-merge-freeze.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-merge-freeze-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-merge-freeze-chaos.v1' as const;
const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;

const REQUIRED_DOMAINS: readonly RuntimeMergeFreezeDomain[] = Object.freeze([
  'freeze_telemetry',
  'governance_immutability_validation',
  'merge_freeze_verification',
  'merge_lineage_reconstruction',
  'replay_freeze_harmonization',
  'runtime_drift_scoring',
  'stewardship_enforcement',
]);

export const RUNTIME_MERGE_FREEZE_GATE_IDS: readonly RuntimeMergeFreezeGateId[] = Object.freeze([
  'merge_freeze_verified',
  'replay_integrity_immutable_post_freeze',
  'governance_drift_impossible',
  'ambiguity_permanence_preserved',
  'fail_closed_freeze_semantics',
  'runtime_continuity_measurable',
  'merge_lineage_reconstructable',
]);

export const RUNTIME_MERGE_FREEZE_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeMergeFreezeDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  freezeIntegrity: number;
  replayFreezeIntegrity: number;
  governanceImmutability: number;
  driftResistance: number;
  runtimeContinuity: number;
  ambiguityPermanence: number;
  immutablePostFreeze: boolean;
  governanceLocked: boolean;
  failClosedReady: boolean;
  mergeLineageRefs: readonly string[];
  replayFreezeRefs: readonly string[];
  governanceRefs: readonly string[];
  telemetryRefs: readonly string[];
  driftRefs: readonly string[];
  ambiguityRefs: readonly string[];
  stewardshipRefs: readonly string[];
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

function cleanRefs(refs: readonly string[]): string[] {
  return Array.from(
    new Set(refs.map(ref => cleanString(ref)).filter((ref): ref is string => ref !== null)),
  ).sort();
}

function dedupeSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(value => value.trim().length > 0).map(value => value.trim()))).sort();
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

function normalizeEvidence(evidence: readonly RuntimeMergeFreezeEvidence[]): NormalizedEvidence[] {
  return evidence
    .map((entry, index) => ({
      evidenceId: requiredString(entry.evidenceId, `missing-freeze-evidence-${index}`),
      recordedAt: requiredString(entry.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: entry.domain,
      sourceSystemId: requiredString(entry.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanString(entry.replayTraceId),
      freezeIntegrity: clamp01(entry.freezeIntegrity),
      replayFreezeIntegrity: clamp01(entry.replayFreezeIntegrity),
      governanceImmutability: clamp01(entry.governanceImmutability),
      driftResistance: clamp01(entry.driftResistance),
      runtimeContinuity: clamp01(entry.runtimeContinuity),
      ambiguityPermanence: clamp01(entry.ambiguityPermanence),
      immutablePostFreeze: entry.immutablePostFreeze === true,
      governanceLocked: entry.governanceLocked === true,
      failClosedReady: entry.failClosedReady === true,
      mergeLineageRefs: cleanRefs(entry.mergeLineageRefs),
      replayFreezeRefs: cleanRefs(entry.replayFreezeRefs),
      governanceRefs: cleanRefs(entry.governanceRefs),
      telemetryRefs: cleanRefs(entry.telemetryRefs),
      driftRefs: cleanRefs(entry.driftRefs),
      ambiguityRefs: cleanRefs(entry.ambiguityRefs),
      stewardshipRefs: cleanRefs(entry.stewardshipRefs),
      ambiguity: cleanString(entry.ambiguity),
    }))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.evidenceId.localeCompare(right.evidenceId));
}

function evidenceHash(evidence: NormalizedEvidence): string {
  return sha256ForPayload({
    evidenceId: evidence.evidenceId,
    recordedAt: evidence.recordedAt,
    domain: evidence.domain,
    sourceSystemId: evidence.sourceSystemId,
    replayTraceId: evidence.replayTraceId,
    freezeIntegrity: evidence.freezeIntegrity,
    replayFreezeIntegrity: evidence.replayFreezeIntegrity,
    governanceImmutability: evidence.governanceImmutability,
    driftResistance: evidence.driftResistance,
    runtimeContinuity: evidence.runtimeContinuity,
    ambiguityPermanence: evidence.ambiguityPermanence,
    immutablePostFreeze: evidence.immutablePostFreeze,
    governanceLocked: evidence.governanceLocked,
    failClosedReady: evidence.failClosedReady,
    mergeLineageRefs: evidence.mergeLineageRefs,
    replayFreezeRefs: evidence.replayFreezeRefs,
    governanceRefs: evidence.governanceRefs,
    telemetryRefs: evidence.telemetryRefs,
    driftRefs: evidence.driftRefs,
    ambiguityRefs: evidence.ambiguityRefs,
    stewardshipRefs: evidence.stewardshipRefs,
    ambiguity: evidence.ambiguity,
  });
}

function domainsObserved(evidence: readonly NormalizedEvidence[]): RuntimeMergeFreezeDomain[] {
  const observed = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.filter(domain => observed.has(domain));
}

function buildLineageFromNormalized(input: {
  freezeId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): RuntimeMergeFreezeLineage {
  const timeline: RuntimeMergeFreezeLineageEntry[] = input.evidence.map((entry, index) => ({
    position: index + 1,
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    mergeLineageRefCount: entry.mergeLineageRefs.length,
    replayFreezeRefCount: entry.replayFreezeRefs.length,
    governanceRefCount: entry.governanceRefs.length,
    telemetryRefCount: entry.telemetryRefs.length,
    driftRefCount: entry.driftRefs.length,
    ambiguityRefCount: entry.ambiguityRefs.length,
    stewardshipRefCount: entry.stewardshipRefs.length,
    immutablePostFreeze: entry.immutablePostFreeze,
    governanceLocked: entry.governanceLocked,
    failClosedReady: entry.failClosedReady,
    ambiguous: entry.ambiguity !== null,
    evidenceHash: evidenceHash(entry),
  }));
  const observedDomains = domainsObserved(input.evidence);
  const sourceSystemIds = dedupeSorted(input.evidence.map(entry => entry.sourceSystemId));
  const body = {
    schema: SCHEMA_LINEAGE,
    freezeId: input.freezeId,
    firstRecordedAt: timeline[0]?.recordedAt ?? null,
    lastRecordedAt: timeline[timeline.length - 1]?.recordedAt ?? null,
    domainsObserved: observedDomains,
    sourceSystemIds,
    timeline: timeline.map(entry => ({
      position: entry.position,
      evidenceId: entry.evidenceId,
      recordedAt: entry.recordedAt,
      domain: entry.domain,
      sourceSystemId: entry.sourceSystemId,
      evidenceHash: entry.evidenceHash,
    })),
  };

  return {
    ...body,
    timeline,
    lineageHash: sha256ForPayload(body),
    generatedAt: input.generatedAt,
  };
}

export function buildRuntimeMergeFreezeLineage(input: RuntimeMergeFreezeInput): RuntimeMergeFreezeLineage {
  return buildLineageFromNormalized({
    ...input,
    evidence: normalizeEvidence(input.evidence),
  });
}

function lineageReconstructable(
  evidence: readonly NormalizedEvidence[],
  lineage: RuntimeMergeFreezeLineage,
): boolean {
  return evidence.length >= REQUIRED_DOMAINS.length
    && lineage.domainsObserved.length === REQUIRED_DOMAINS.length
    && evidence.every(entry => entry.mergeLineageRefs.length > 0)
    && evidence.every(entry => entry.replayFreezeRefs.length > 0)
    && evidence.every(entry => entry.governanceRefs.length > 0);
}

export function evaluateRuntimeMergeFreeze(input: RuntimeMergeFreezeInput): RuntimeMergeFreezeResult {
  const evidence = normalizeEvidence(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const total = evidence.length;
  const traceCoveragePct = total > 0
    ? pct((evidence.filter(entry => entry.replayTraceId !== null).length / total) * 100)
    : 0;
  const freezeIntegrityPct = pct(average(evidence.map(entry => entry.freezeIntegrity)) * 100);
  const replayFreezeIntegrityPct = pct(average(evidence.map(entry => entry.replayFreezeIntegrity)) * 100);
  const governanceImmutabilityPct = pct(average(evidence.map(entry => entry.governanceImmutability)) * 100);
  const driftResistancePct = pct(average(evidence.map(entry => entry.driftResistance)) * 100);
  const runtimeContinuityPct = pct(average(evidence.map(entry => entry.runtimeContinuity)) * 100);
  const ambiguityPermanencePct = pct(average(evidence.map(entry => entry.ambiguityPermanence)) * 100);
  const lockedCoveragePct = total > 0
    ? pct((evidence.filter(entry => entry.governanceLocked).length / total) * 100)
    : 0;
  const telemetryCoveragePct = total > 0
    ? pct((evidence.filter(entry => entry.telemetryRefs.length > 0).length / total) * 100)
    : 0;
  const ambiguityRefCoveragePct = total > 0
    ? pct((evidence.filter(entry => entry.ambiguityRefs.length > 0).length / total) * 100)
    : 0;
  const mutableEvidenceIds = evidence
    .filter(entry => !entry.immutablePostFreeze || entry.replayTraceId === null)
    .map(entry => entry.evidenceId);
  const mergeFreezeVerified =
    total >= REQUIRED_DOMAINS.length
      && freezeIntegrityPct >= MIN_SCORE
      && evidence.every(entry => entry.mergeLineageRefs.length > 0)
      && evidence.every(entry => entry.failClosedReady);
  const replayImmutablePostFreeze =
    total >= REQUIRED_DOMAINS.length
      && replayFreezeIntegrityPct >= MIN_SCORE
      && traceCoveragePct >= MIN_TRACE_COVERAGE
      && mutableEvidenceIds.length === 0
      && evidence.every(entry => entry.replayFreezeRefs.length > 0);
  const governanceDriftImpossible =
    total >= REQUIRED_DOMAINS.length
      && governanceImmutabilityPct >= MIN_SCORE
      && driftResistancePct >= MIN_SCORE
      && lockedCoveragePct === 100
      && evidence.every(entry => entry.governanceRefs.length > 0)
      && evidence.every(entry => entry.driftRefs.length > 0);
  const ambiguityPermanencePreserved =
    total >= REQUIRED_DOMAINS.length
      && ambiguityPermanencePct >= MIN_SCORE
      && ambiguityRefCoveragePct === 100
      && evidence.every(entry => entry.ambiguity === null || entry.ambiguityRefs.length > 0);
  const freezeTelemetryObservable =
    total >= REQUIRED_DOMAINS.length
      && telemetryCoveragePct === 100
      && evidence.every(entry => entry.telemetryRefs.length > 0);
  const uniqueRecordedAt = new Set(evidence.map(entry => entry.recordedAt));
  const runtimeContinuityMeasurable =
    total >= REQUIRED_DOMAINS.length
      && runtimeContinuityPct >= MIN_SCORE
      && freezeTelemetryObservable
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt;
  const failClosedReady = total >= REQUIRED_DOMAINS.length && evidence.every(entry => entry.failClosedReady);
  const reconstructable = lineageReconstructable(evidence, lineage);
  const driftRefCount = evidence.reduce((sum, entry) => sum + entry.driftRefs.length, 0);
  const telemetryRefCount = evidence.reduce((sum, entry) => sum + entry.telemetryRefs.length, 0);
  const lineageRefCount = evidence.reduce((sum, entry) => sum + entry.mergeLineageRefs.length, 0);
  const ambiguities = dedupeChronological(evidence.map(entry => entry.ambiguity));

  const blockers: string[] = [];
  if (!mergeFreezeVerified) blockers.push('Merge freeze verification is incomplete.');
  if (!replayImmutablePostFreeze) blockers.push('Replay integrity is not immutable post-freeze.');
  if (!governanceDriftImpossible) blockers.push('Governance drift is still possible.');
  if (!ambiguityPermanencePreserved) blockers.push('Ambiguity permanence is not preserved.');
  if (!failClosedReady) blockers.push('Fail-closed freeze semantics are not ready.');
  if (!runtimeContinuityMeasurable) blockers.push('Runtime continuity is not measurable.');
  if (!reconstructable) blockers.push('Merge lineage is not reconstructable.');

  const failClosed = blockers.length > 0;
  const rawFreezeScore = pct(
    replayFreezeIntegrityPct * 0.24
      + governanceImmutabilityPct * 0.22
      + driftResistancePct * 0.18
      + runtimeContinuityPct * 0.18
      + ambiguityPermanencePct * 0.1
      + freezeIntegrityPct * 0.08,
  );
  const freezeScore = failClosed ? Math.min(rawFreezeScore, 49) : rawFreezeScore;
  const status: RuntimeMergeFreezeStatus = failClosed
    ? 'RUNTIME_MERGE_FREEZE_BLOCKED'
    : ambiguities.length > 0 || freezeScore < 92
      ? 'RUNTIME_MERGE_FREEZE_DEGRADED'
      : 'RUNTIME_MERGE_FREEZE_READY';
  const verdict: RuntimeMergeFreezeVerdict = status === 'RUNTIME_MERGE_FREEZE_BLOCKED'
    ? 'CONSTITUTIONAL_RUNTIME_MERGE_FREEZE_FAIL_CLOSED'
    : status === 'RUNTIME_MERGE_FREEZE_READY'
      ? 'CONSTITUTIONAL_RUNTIME_MERGE_FROZEN'
      : ambiguities.length > 0
        ? 'CONSTITUTIONAL_RUNTIME_MERGE_FROZEN_WITH_AMBIGUITY'
        : 'CONSTITUTIONAL_RUNTIME_MERGE_FREEZE_PARTIAL';
  const basis: string[] = [];
  if (mergeFreezeVerified) basis.push('merge_freeze_verified');
  if (replayImmutablePostFreeze) basis.push('replay_integrity_immutable_post_freeze');
  if (governanceDriftImpossible) basis.push('governance_drift_impossible');
  if (ambiguityPermanencePreserved) basis.push('ambiguity_permanence_preserved');
  if (failClosedReady && !failClosed) basis.push('fail_closed_freeze_semantics');
  if (runtimeContinuityMeasurable) basis.push('runtime_continuity_measurable');
  if (reconstructable) basis.push('merge_lineage_reconstructable');

  const body = {
    schema: SCHEMA_RESULT,
    freezeId: input.freezeId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    freezeScore,
    blockers,
    ambiguities,
    ambiguityPreserved: ambiguityPermanencePreserved,
    lineageHash: lineage.lineageHash,
    mergeFreeze: {
      verified: mergeFreezeVerified,
      integrityPct: freezeIntegrityPct,
    },
    replayFreeze: {
      immutablePostFreeze: replayImmutablePostFreeze,
      integrityPct: replayFreezeIntegrityPct,
      traceCoveragePct,
      mutableEvidenceIds,
    },
    governance: {
      driftImpossible: governanceDriftImpossible,
      immutabilityPct: governanceImmutabilityPct,
      lockedCoveragePct,
    },
    ambiguityPermanence: {
      preserved: ambiguityPermanencePreserved,
      permanencePct: ambiguityPermanencePct,
      ambiguityRefCoveragePct,
    },
    freezeTelemetry: {
      observable: freezeTelemetryObservable,
      telemetryCoveragePct,
      telemetryRefCount,
    },
    driftResistance: {
      resistant: driftResistancePct >= MIN_SCORE && driftRefCount > 0,
      resistancePct: driftResistancePct,
      driftRefCount,
    },
    runtimeContinuity: {
      measurable: runtimeContinuityMeasurable,
      continuityPct: runtimeContinuityPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    mergeLineage: {
      reconstructable,
      domainCoverage: lineage.domainsObserved.length,
      lineageRefCount,
    },
    confidence: {
      score: freezeScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    freezeHash: sha256ForPayload(body),
  };
}

export function evaluateRuntimeMergeFreezeGate(
  result: RuntimeMergeFreezeResult,
): RuntimeMergeFreezeGateResult {
  const gates: RuntimeMergeFreezeGate[] = [
    {
      id: 'merge_freeze_verified',
      pass: result.mergeFreeze.verified,
      observed: result.mergeFreeze.integrityPct,
      required: MIN_SCORE,
    },
    {
      id: 'replay_integrity_immutable_post_freeze',
      pass: result.replayFreeze.immutablePostFreeze,
      observed: result.replayFreeze.integrityPct,
      required: MIN_SCORE,
    },
    {
      id: 'governance_drift_impossible',
      pass: result.governance.driftImpossible,
      observed: result.governance.immutabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'ambiguity_permanence_preserved',
      pass: result.ambiguityPermanence.preserved,
      observed: result.ambiguityPermanence.permanencePct,
      required: MIN_SCORE,
    },
    {
      id: 'fail_closed_freeze_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'runtime_continuity_measurable',
      pass: result.runtimeContinuity.measurable,
      observed: result.runtimeContinuity.continuityPct,
      required: MIN_SCORE,
    },
    {
      id: 'merge_lineage_reconstructable',
      pass: result.mergeLineage.reconstructable,
      observed: result.mergeLineage.domainCoverage,
      required: REQUIRED_DOMAINS.length,
    },
  ];
  const failedGateIds = gates.filter(gate => !gate.pass).map(gate => gate.id);
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
  scenario: RuntimeMergeFreezeChaosScenarioName,
  result: RuntimeMergeFreezeResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): RuntimeMergeFreezeChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateRuntimeMergeFreezeGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runRuntimeMergeFreezeChaosSimulations(
  input: RuntimeMergeFreezeInput,
): RuntimeMergeFreezeChaosReport {
  const baseline = evaluateRuntimeMergeFreeze(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const freezeDrop = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'merge_freeze_verification'
      ? { ...entry, freezeIntegrity: 0.1, mergeLineageRefs: [] }
      : entry),
  });
  const freezeGate = evaluateRuntimeMergeFreezeGate(freezeDrop);

  const replayMutation = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'replay_freeze_harmonization'
      ? { ...entry, replayFreezeIntegrity: 0.1, immutablePostFreeze: false, replayTraceId: null, replayFreezeRefs: [] }
      : entry),
  });
  const replayGate = evaluateRuntimeMergeFreezeGate(replayMutation);

  const governanceUnlock = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'governance_immutability_validation'
      ? { ...entry, governanceImmutability: 0.1, governanceLocked: false, governanceRefs: [] }
      : entry),
  });
  const governanceGate = evaluateRuntimeMergeFreezeGate(governanceUnlock);

  const ambiguitySuppression = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      ambiguity: null,
      ambiguityPermanence: 0.1,
      ambiguityRefs: [],
    })),
  });
  const ambiguityGate = evaluateRuntimeMergeFreezeGate(ambiguitySuppression);

  const telemetryDrop = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'freeze_telemetry'
      ? { ...entry, runtimeContinuity: 0.1, telemetryRefs: [] }
      : entry),
  });
  const telemetryGate = evaluateRuntimeMergeFreezeGate(telemetryDrop);

  const driftCollapse = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'runtime_drift_scoring'
      ? { ...entry, driftResistance: 0.1, driftRefs: [] }
      : entry),
  });
  const driftGate = evaluateRuntimeMergeFreezeGate(driftCollapse);

  const failClosedDisabled = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      failClosedReady: false,
    })),
  });
  const failClosedGate = evaluateRuntimeMergeFreezeGate(failClosedDisabled);

  const lineageGap = evaluateRuntimeMergeFreeze({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'merge_lineage_reconstruction'
      ? { ...entry, mergeLineageRefs: [], replayFreezeRefs: [], governanceRefs: [] }
      : entry),
  });
  const lineageGate = evaluateRuntimeMergeFreezeGate(lineageGap);

  const scenarios: RuntimeMergeFreezeChaosScenarioResult[] = [
    chaosScenario(
      'MERGE_FREEZE_VERIFICATION_DROP',
      freezeDrop,
      freezeGate.failedGateIds.includes('merge_freeze_verified'),
      freezeDrop.blockers,
    ),
    chaosScenario(
      'REPLAY_FREEZE_MUTATION',
      replayMutation,
      replayGate.failedGateIds.includes('replay_integrity_immutable_post_freeze'),
      replayMutation.blockers,
    ),
    chaosScenario(
      'GOVERNANCE_DRIFT_UNLOCK',
      governanceUnlock,
      governanceGate.failedGateIds.includes('governance_drift_impossible'),
      governanceUnlock.blockers,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguityGate.failedGateIds.includes('ambiguity_permanence_preserved')
        || ambiguitySuppression.ambiguities.length < baselineAmbiguityCount,
      ambiguitySuppression.blockers,
    ),
    chaosScenario(
      'TELEMETRY_DROP',
      telemetryDrop,
      telemetryGate.failedGateIds.includes('runtime_continuity_measurable'),
      telemetryDrop.blockers,
    ),
    chaosScenario(
      'DRIFT_SCORE_COLLAPSE',
      driftCollapse,
      driftGate.failedGateIds.includes('governance_drift_impossible'),
      driftCollapse.blockers,
    ),
    chaosScenario(
      'FAIL_CLOSED_DISABLED',
      failClosedDisabled,
      failClosedGate.failedGateIds.includes('fail_closed_freeze_semantics'),
      failClosedDisabled.blockers,
    ),
    chaosScenario(
      'LINEAGE_GAP',
      lineageGap,
      lineageGate.failedGateIds.includes('merge_lineage_reconstructable'),
      lineageGap.blockers,
    ),
  ];
  const silentFailureCount = scenarios.filter(scenario => !scenario.signalSurfaced).length;
  const body = {
    schema: SCHEMA_CHAOS,
    totalScenarios: scenarios.length,
    silentFailureCount,
    scenarios,
    generatedAt: input.generatedAt,
  };

  return {
    ...body,
    reportHash: sha256ForPayload(body),
  };
}
