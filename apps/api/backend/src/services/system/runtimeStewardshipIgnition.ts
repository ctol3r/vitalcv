/**
 * runtimeStewardshipIgnition.ts - W2-PR171A
 *
 * Pure runtime stewardship ignition evaluator. It validates supplied ignition
 * workflows, governance continuity activation, replay stewardship telemetry,
 * caretaker harmonization, survivability scoring, institutional stability, and
 * longitudinal caretaker lineage before runtime stewardship can be treated as
 * activated.
 *
 * No fetches, no DB writes, no audit writes. Callers supply evidence; this
 * module returns deterministic lineage, fail-closed verdicts, gates, and
 * chaos signals.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type RuntimeStewardshipIgnitionDomain =
  | 'stewardship_ignition_workflow'
  | 'governance_continuity_activation'
  | 'replay_stewardship_telemetry'
  | 'caretaker_harmonization'
  | 'stewardship_survivability_scoring'
  | 'institutional_stability'
  | 'longitudinal_caretaker_lineage';

export interface RuntimeStewardshipIgnitionEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeStewardshipIgnitionDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayFaithfulness: number;
  governanceContinuity: number;
  institutionalStability: number;
  stewardshipSurvivability: number;
  ignitionReadiness: number;
  caretakerLineageDurability: number;
  operationalStability: number;
  activated: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  workflowRefs: readonly string[];
  governanceContinuityRefs: readonly string[];
  replayTelemetryRefs: readonly string[];
  caretakerLineageRefs: readonly string[];
  harmonizationRefs: readonly string[];
  survivabilityRefs: readonly string[];
  evidenceRefs: readonly string[];
  ambiguityRefs: readonly string[];
  ambiguity: string | null;
}

export interface RuntimeStewardshipIgnitionLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeStewardshipIgnitionDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  workflowRefCount: number;
  governanceContinuityRefCount: number;
  replayTelemetryRefCount: number;
  caretakerLineageRefCount: number;
  harmonizationRefCount: number;
  survivabilityRefCount: number;
  evidenceRefCount: number;
  ambiguityRefCount: number;
  activated: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  ambiguous: boolean;
  evidenceHash: string;
}

export interface RuntimeStewardshipIgnitionLineage {
  schema: 'vitalcv.runtime-stewardship-ignition-lineage.v1';
  ignitionId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly RuntimeStewardshipIgnitionDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly RuntimeStewardshipIgnitionLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type RuntimeStewardshipIgnitionStatus =
  | 'STEWARDSHIP_IGNITION_READY'
  | 'STEWARDSHIP_IGNITION_DEGRADED'
  | 'STEWARDSHIP_IGNITION_BLOCKED';

export type RuntimeStewardshipIgnitionVerdict =
  | 'STEWARDSHIP_IGNITED'
  | 'STEWARDSHIP_IGNITED_WITH_AMBIGUITY'
  | 'STEWARDSHIP_IGNITION_PARTIAL'
  | 'STEWARDSHIP_IGNITION_FAIL_CLOSED';

export interface RuntimeStewardshipIgnitionResult {
  schema: 'vitalcv.runtime-stewardship-ignition.v1';
  ignitionId: string;
  generatedAt: string;
  status: RuntimeStewardshipIgnitionStatus;
  verdict: RuntimeStewardshipIgnitionVerdict;
  failClosed: boolean;
  ignitionScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: RuntimeStewardshipIgnitionLineage;
  replayStewardship: {
    faithful: boolean;
    fidelityPct: number;
    traceCoveragePct: number;
    telemetryCoveragePct: number;
  };
  governanceContinuity: {
    reconstructable: boolean;
    continuityPct: number;
    continuityRefCount: number;
  };
  caretakerHarmonization: {
    longitudinallyDurable: boolean;
    lineageDurabilityPct: number;
    caretakerLineageRefCount: number;
    harmonizationRefCount: number;
  };
  stewardshipSurvivability: {
    scored: boolean;
    survivabilityPct: number;
    survivabilityRefCount: number;
  };
  institutionalStability: {
    stable: boolean;
    stabilityPct: number;
    operationalStabilityPct: number;
  };
  ignition: {
    activated: boolean;
    readinessPct: number;
    workflowCoveragePct: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  ignitionHash: string;
}

export type RuntimeStewardshipIgnitionGateId =
  | 'stewardship_replay_faithful'
  | 'ambiguity_preserved_operationally'
  | 'governance_continuity_reconstructable'
  | 'fail_closed_stewardship_semantics'
  | 'caretaker_lineage_longitudinally_durable'
  | 'runtime_stewardship_operationally_stable'
  | 'stewardship_survivability_scored';

export interface RuntimeStewardshipIgnitionGate {
  id: RuntimeStewardshipIgnitionGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface RuntimeStewardshipIgnitionGateResult {
  schema: 'vitalcv.runtime-stewardship-ignition-ci-gate.v1';
  pass: boolean;
  gates: readonly RuntimeStewardshipIgnitionGate[];
  failedGateIds: readonly RuntimeStewardshipIgnitionGateId[];
  gateHash: string;
}

export type RuntimeStewardshipIgnitionChaosScenarioName =
  | 'IGNITION_WORKFLOW_GAP'
  | 'GOVERNANCE_CONTINUITY_DROP'
  | 'REPLAY_TELEMETRY_DROP'
  | 'CARETAKER_HARMONIZATION_GAP'
  | 'SURVIVABILITY_SCORE_DROP'
  | 'AMBIGUITY_SUPPRESSION'
  | 'FAIL_CLOSED_DISABLED'
  | 'LINEAGE_DURABILITY_COLLAPSE';

export interface RuntimeStewardshipIgnitionChaosScenarioResult {
  scenario: RuntimeStewardshipIgnitionChaosScenarioName;
  signalSurfaced: boolean;
  status: RuntimeStewardshipIgnitionStatus;
  failedGateIds: readonly RuntimeStewardshipIgnitionGateId[];
  surfacedSignals: readonly string[];
}

export interface RuntimeStewardshipIgnitionChaosReport {
  schema: 'vitalcv.runtime-stewardship-ignition-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly RuntimeStewardshipIgnitionChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface RuntimeStewardshipIgnitionInput {
  ignitionId: string;
  generatedAt: string;
  evidence: readonly RuntimeStewardshipIgnitionEvidence[];
}

const SCHEMA_LINEAGE = 'vitalcv.runtime-stewardship-ignition-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-stewardship-ignition.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-stewardship-ignition-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-stewardship-ignition-chaos.v1' as const;
const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;

const REQUIRED_DOMAINS: readonly RuntimeStewardshipIgnitionDomain[] = Object.freeze([
  'stewardship_ignition_workflow',
  'governance_continuity_activation',
  'replay_stewardship_telemetry',
  'caretaker_harmonization',
  'stewardship_survivability_scoring',
  'institutional_stability',
  'longitudinal_caretaker_lineage',
]);

export const RUNTIME_STEWARDSHIP_IGNITION_GATE_IDS: readonly RuntimeStewardshipIgnitionGateId[] = Object.freeze([
  'stewardship_replay_faithful',
  'ambiguity_preserved_operationally',
  'governance_continuity_reconstructable',
  'fail_closed_stewardship_semantics',
  'caretaker_lineage_longitudinally_durable',
  'runtime_stewardship_operationally_stable',
  'stewardship_survivability_scored',
]);

export const RUNTIME_STEWARDSHIP_IGNITION_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeStewardshipIgnitionDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayFaithfulness: number;
  governanceContinuity: number;
  institutionalStability: number;
  stewardshipSurvivability: number;
  ignitionReadiness: number;
  caretakerLineageDurability: number;
  operationalStability: number;
  activated: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  workflowRefs: readonly string[];
  governanceContinuityRefs: readonly string[];
  replayTelemetryRefs: readonly string[];
  caretakerLineageRefs: readonly string[];
  harmonizationRefs: readonly string[];
  survivabilityRefs: readonly string[];
  evidenceRefs: readonly string[];
  ambiguityRefs: readonly string[];
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

function normalizeEvidence(
  evidence: readonly RuntimeStewardshipIgnitionEvidence[],
): NormalizedEvidence[] {
  return evidence
    .map((entry, index) => ({
      evidenceId: requiredString(entry.evidenceId, `missing-stewardship-ignition-${index}`),
      recordedAt: requiredString(entry.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: entry.domain,
      sourceSystemId: requiredString(entry.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanString(entry.replayTraceId),
      replayFaithfulness: clamp01(entry.replayFaithfulness),
      governanceContinuity: clamp01(entry.governanceContinuity),
      institutionalStability: clamp01(entry.institutionalStability),
      stewardshipSurvivability: clamp01(entry.stewardshipSurvivability),
      ignitionReadiness: clamp01(entry.ignitionReadiness),
      caretakerLineageDurability: clamp01(entry.caretakerLineageDurability),
      operationalStability: clamp01(entry.operationalStability),
      activated: entry.activated === true,
      immutable: entry.immutable === true,
      failClosedReady: entry.failClosedReady === true,
      workflowRefs: dedupeSorted(entry.workflowRefs),
      governanceContinuityRefs: dedupeSorted(entry.governanceContinuityRefs),
      replayTelemetryRefs: dedupeSorted(entry.replayTelemetryRefs),
      caretakerLineageRefs: dedupeSorted(entry.caretakerLineageRefs),
      harmonizationRefs: dedupeSorted(entry.harmonizationRefs),
      survivabilityRefs: dedupeSorted(entry.survivabilityRefs),
      evidenceRefs: dedupeSorted(entry.evidenceRefs),
      ambiguityRefs: dedupeSorted(entry.ambiguityRefs),
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
    governanceContinuity: entry.governanceContinuity,
    institutionalStability: entry.institutionalStability,
    stewardshipSurvivability: entry.stewardshipSurvivability,
    ignitionReadiness: entry.ignitionReadiness,
    caretakerLineageDurability: entry.caretakerLineageDurability,
    operationalStability: entry.operationalStability,
    activated: entry.activated,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    workflowRefs: entry.workflowRefs,
    governanceContinuityRefs: entry.governanceContinuityRefs,
    replayTelemetryRefs: entry.replayTelemetryRefs,
    caretakerLineageRefs: entry.caretakerLineageRefs,
    harmonizationRefs: entry.harmonizationRefs,
    survivabilityRefs: entry.survivabilityRefs,
    evidenceRefs: entry.evidenceRefs,
    ambiguityRefs: entry.ambiguityRefs,
    ambiguity: entry.ambiguity,
  });
}

function observedDomains(evidence: readonly NormalizedEvidence[]): RuntimeStewardshipIgnitionDomain[] {
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
    | 'workflowRefs'
    | 'governanceContinuityRefs'
    | 'replayTelemetryRefs'
    | 'caretakerLineageRefs'
    | 'harmonizationRefs'
    | 'survivabilityRefs'
    | 'evidenceRefs'
  >,
): number {
  if (evidence.length === 0) return 0;
  return pct((evidence.filter(entry => entry[key].length > 0).length / evidence.length) * 100);
}

function buildLineageFromNormalized(input: {
  ignitionId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): RuntimeStewardshipIgnitionLineage {
  const timeline: RuntimeStewardshipIgnitionLineageEntry[] = input.evidence.map((entry, index) => ({
    position: index + 1,
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    workflowRefCount: entry.workflowRefs.length,
    governanceContinuityRefCount: entry.governanceContinuityRefs.length,
    replayTelemetryRefCount: entry.replayTelemetryRefs.length,
    caretakerLineageRefCount: entry.caretakerLineageRefs.length,
    harmonizationRefCount: entry.harmonizationRefs.length,
    survivabilityRefCount: entry.survivabilityRefs.length,
    evidenceRefCount: entry.evidenceRefs.length,
    ambiguityRefCount: entry.ambiguityRefs.length,
    activated: entry.activated,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    ambiguous: entry.ambiguity !== null,
    evidenceHash: evidenceHash(entry),
  }));
  const body = {
    schema: SCHEMA_LINEAGE,
    ignitionId: input.ignitionId,
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

export function buildRuntimeStewardshipIgnitionLineage(
  input: RuntimeStewardshipIgnitionInput,
): RuntimeStewardshipIgnitionLineage {
  return buildLineageFromNormalized({
    ...input,
    evidence: normalizeEvidence(input.evidence),
  });
}

export function evaluateRuntimeStewardshipIgnition(
  input: RuntimeStewardshipIgnitionInput,
): RuntimeStewardshipIgnitionResult {
  const evidence = normalizeEvidence(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const hasDomains = hasAllRequiredDomains(evidence);
  const traceCoveragePct = evidence.length > 0
    ? pct((evidence.filter(entry => entry.replayTraceId !== null).length / evidence.length) * 100)
    : 0;
  const replayFidelityPct = pct(average(evidence.map(entry => entry.replayFaithfulness)) * 100);
  const telemetryCoveragePct = coveragePct(evidence, 'replayTelemetryRefs');
  const activatedImmutable = evidence.length > 0 && evidence.every(entry => entry.activated && entry.immutable);
  const replayFaithful =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && replayFidelityPct >= MIN_SCORE
      && traceCoveragePct >= MIN_TRACE_COVERAGE
      && telemetryCoveragePct === 100
      && evidence.some(entry => entry.domain === 'replay_stewardship_telemetry');

  const ambiguities = dedupeChronological(evidence.map(entry => entry.ambiguity));
  const ambiguityPreserved = dedupeChronological(evidence.map(entry => entry.ambiguity)).length === ambiguities.length;
  const ambiguousEvidence = evidence.filter(entry => entry.ambiguity !== null);
  const ambiguityCovered = ambiguousEvidence.length === 0
    || ambiguousEvidence.every(entry => entry.ambiguityRefs.length > 0);
  const operationalAmbiguityPreserved = ambiguityPreserved && ambiguityCovered;

  const continuityPct = pct(average(evidence.map(entry => entry.governanceContinuity)) * 100);
  const continuityRefCount = evidence.reduce((sum, entry) => sum + entry.governanceContinuityRefs.length, 0);
  const governanceReconstructable =
    hasDomains
      && continuityPct >= MIN_SCORE
      && coveragePct(evidence, 'governanceContinuityRefs') === 100
      && coveragePct(evidence, 'evidenceRefs') === 100
      && evidence.some(entry => entry.domain === 'governance_continuity_activation');

  const lineageDurabilityPct = pct(average(evidence.map(entry => entry.caretakerLineageDurability)) * 100);
  const caretakerLineageRefCount = evidence.reduce((sum, entry) => sum + entry.caretakerLineageRefs.length, 0);
  const harmonizationRefCount = evidence.reduce((sum, entry) => sum + entry.harmonizationRefs.length, 0);
  const uniqueRecordedAt = new Set(evidence.map(entry => entry.recordedAt));
  const caretakerLineageDurable =
    hasDomains
      && lineageDurabilityPct >= MIN_SCORE
      && coveragePct(evidence, 'caretakerLineageRefs') === 100
      && coveragePct(evidence, 'harmonizationRefs') === 100
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt
      && evidence.some(entry => entry.domain === 'longitudinal_caretaker_lineage');

  const survivabilityPct = pct(average(evidence.map(entry => entry.stewardshipSurvivability)) * 100);
  const survivabilityRefCount = evidence.reduce((sum, entry) => sum + entry.survivabilityRefs.length, 0);
  const survivabilityScored =
    hasDomains
      && survivabilityPct >= MIN_SCORE
      && coveragePct(evidence, 'survivabilityRefs') === 100
      && evidence.some(entry => entry.domain === 'stewardship_survivability_scoring');

  const stabilityPct = pct(average(evidence.map(entry => entry.institutionalStability)) * 100);
  const operationalStabilityPct = pct(average(evidence.map(entry => entry.operationalStability)) * 100);
  const operationallyStable =
    hasDomains
      && stabilityPct >= MIN_SCORE
      && operationalStabilityPct >= MIN_SCORE
      && activatedImmutable
      && evidence.some(entry => entry.domain === 'institutional_stability');

  const readinessPct = pct(average(evidence.map(entry => entry.ignitionReadiness)) * 100);
  const workflowCoveragePct = coveragePct(evidence, 'workflowRefs');
  const ignitionActivated =
    hasDomains
      && readinessPct >= MIN_SCORE
      && workflowCoveragePct === 100
      && activatedImmutable
      && evidence.some(entry => entry.domain === 'stewardship_ignition_workflow');

  const failClosedReady = evidence.length > 0 && evidence.every(entry => entry.failClosedReady);

  const blockers: string[] = [];
  if (!replayFaithful) blockers.push('Stewardship replay is not faithful.');
  if (!operationalAmbiguityPreserved) blockers.push('Operational ambiguity is not preserved.');
  if (!governanceReconstructable) blockers.push('Governance continuity is not reconstructable.');
  if (!failClosedReady) blockers.push('Fail-closed stewardship semantics are not ready.');
  if (!caretakerLineageDurable) blockers.push('Caretaker lineage is not longitudinally durable.');
  if (!operationallyStable) blockers.push('Runtime stewardship is not operationally stable.');
  if (!survivabilityScored) blockers.push('Stewardship survivability is not scored.');
  if (!ignitionActivated) blockers.push('Stewardship ignition is not activated.');

  const failClosed = blockers.length > 0;
  const rawIgnitionScore = pct(
    continuityPct * 0.19
      + replayFidelityPct * 0.17
      + stabilityPct * 0.16
      + survivabilityPct * 0.16
      + readinessPct * 0.16
      + lineageDurabilityPct * 0.16,
  );
  const ignitionScore = failClosed ? Math.min(rawIgnitionScore, 49) : rawIgnitionScore;
  const status: RuntimeStewardshipIgnitionStatus = failClosed
    ? 'STEWARDSHIP_IGNITION_BLOCKED'
    : ambiguities.length > 0 || ignitionScore < 90
      ? 'STEWARDSHIP_IGNITION_DEGRADED'
      : 'STEWARDSHIP_IGNITION_READY';
  const verdict: RuntimeStewardshipIgnitionVerdict = status === 'STEWARDSHIP_IGNITION_BLOCKED'
    ? 'STEWARDSHIP_IGNITION_FAIL_CLOSED'
    : status === 'STEWARDSHIP_IGNITION_READY'
      ? 'STEWARDSHIP_IGNITED'
      : ambiguities.length > 0
        ? 'STEWARDSHIP_IGNITED_WITH_AMBIGUITY'
        : 'STEWARDSHIP_IGNITION_PARTIAL';

  const basis: string[] = [];
  if (replayFaithful) basis.push('stewardship_replay_faithful');
  if (operationalAmbiguityPreserved) basis.push('ambiguity_preserved_operationally');
  if (governanceReconstructable) basis.push('governance_continuity_reconstructable');
  if (!failClosed) basis.push('fail_closed_stewardship_semantics');
  if (caretakerLineageDurable) basis.push('caretaker_lineage_longitudinally_durable');
  if (operationallyStable) basis.push('runtime_stewardship_operationally_stable');
  if (survivabilityScored) basis.push('stewardship_survivability_scored');

  const body = {
    schema: SCHEMA_RESULT,
    ignitionId: input.ignitionId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    ignitionScore,
    blockers,
    ambiguities,
    ambiguityPreserved: operationalAmbiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayStewardship: {
      faithful: replayFaithful,
      fidelityPct: replayFidelityPct,
      traceCoveragePct,
      telemetryCoveragePct,
    },
    governanceContinuity: {
      reconstructable: governanceReconstructable,
      continuityPct,
      continuityRefCount,
    },
    caretakerHarmonization: {
      longitudinallyDurable: caretakerLineageDurable,
      lineageDurabilityPct,
      caretakerLineageRefCount,
      harmonizationRefCount,
    },
    stewardshipSurvivability: {
      scored: survivabilityScored,
      survivabilityPct,
      survivabilityRefCount,
    },
    institutionalStability: {
      stable: operationallyStable,
      stabilityPct,
      operationalStabilityPct,
    },
    ignition: {
      activated: ignitionActivated,
      readinessPct,
      workflowCoveragePct,
    },
    confidence: {
      score: ignitionScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    ignitionHash: sha256ForPayload(body),
  };
}

export function evaluateRuntimeStewardshipIgnitionGate(
  result: RuntimeStewardshipIgnitionResult,
): RuntimeStewardshipIgnitionGateResult {
  const gates: RuntimeStewardshipIgnitionGate[] = [
    {
      id: 'stewardship_replay_faithful',
      pass: result.replayStewardship.faithful,
      observed: result.replayStewardship.fidelityPct,
      required: MIN_SCORE,
    },
    {
      id: 'ambiguity_preserved_operationally',
      pass: result.ambiguityPreserved,
      observed: result.ambiguityPreserved,
      required: true,
    },
    {
      id: 'governance_continuity_reconstructable',
      pass: result.governanceContinuity.reconstructable,
      observed: result.governanceContinuity.continuityPct,
      required: MIN_SCORE,
    },
    {
      id: 'fail_closed_stewardship_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'caretaker_lineage_longitudinally_durable',
      pass: result.caretakerHarmonization.longitudinallyDurable,
      observed: result.caretakerHarmonization.lineageDurabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'runtime_stewardship_operationally_stable',
      pass: result.institutionalStability.stable,
      observed: result.institutionalStability.stabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'stewardship_survivability_scored',
      pass: result.stewardshipSurvivability.scored,
      observed: result.stewardshipSurvivability.survivabilityPct,
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
  scenario: RuntimeStewardshipIgnitionChaosScenarioName,
  result: RuntimeStewardshipIgnitionResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): RuntimeStewardshipIgnitionChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateRuntimeStewardshipIgnitionGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runRuntimeStewardshipIgnitionChaosSimulations(
  input: RuntimeStewardshipIgnitionInput,
): RuntimeStewardshipIgnitionChaosReport {
  const baseline = evaluateRuntimeStewardshipIgnition(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const ignitionWorkflowGap = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'stewardship_ignition_workflow'
      ? { ...entry, workflowRefs: [], activated: false, ignitionReadiness: 0.1 }
      : entry),
  });
  const ignitionGate = evaluateRuntimeStewardshipIgnitionGate(ignitionWorkflowGap);

  const governanceDrop = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'governance_continuity_activation'
      ? { ...entry, governanceContinuityRefs: [], evidenceRefs: [], governanceContinuity: 0.1 }
      : entry),
  });
  const governanceGate = evaluateRuntimeStewardshipIgnitionGate(governanceDrop);

  const replayDrop = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      replayTraceId: null,
      replayTelemetryRefs: entry.domain === 'replay_stewardship_telemetry' ? [] : entry.replayTelemetryRefs,
      replayFaithfulness: entry.domain === 'replay_stewardship_telemetry' ? 0.1 : entry.replayFaithfulness,
    })),
  });
  const replayGate = evaluateRuntimeStewardshipIgnitionGate(replayDrop);

  const caretakerGap = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'caretaker_harmonization'
      ? {
        ...entry,
        caretakerLineageRefs: [],
        harmonizationRefs: [],
        caretakerLineageDurability: 0.1,
      }
      : entry),
  });
  const caretakerGate = evaluateRuntimeStewardshipIgnitionGate(caretakerGap);

  const survivabilityDrop = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'stewardship_survivability_scoring'
      ? { ...entry, survivabilityRefs: [], stewardshipSurvivability: 0.1 }
      : entry),
  });
  const survivabilityGate = evaluateRuntimeStewardshipIgnitionGate(survivabilityDrop);

  const ambiguitySuppression = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      ambiguity: null,
      ambiguityRefs: [],
    })),
  });
  const ambiguityGate = evaluateRuntimeStewardshipIgnitionGate(ambiguitySuppression);
  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;

  const failClosedDisabled = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, failClosedReady: false })),
  });
  const failClosedGate = evaluateRuntimeStewardshipIgnitionGate(failClosedDisabled);

  const lineageCollapse = evaluateRuntimeStewardshipIgnition({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      recordedAt: '2026-05-11T02:00:00.000Z',
      caretakerLineageRefs: [],
      caretakerLineageDurability: 0.2,
      harmonizationRefs: [],
    })),
  });
  const lineageGate = evaluateRuntimeStewardshipIgnitionGate(lineageCollapse);

  const scenarios: RuntimeStewardshipIgnitionChaosScenarioResult[] = [
    chaosScenario(
      'IGNITION_WORKFLOW_GAP',
      ignitionWorkflowGap,
      !ignitionWorkflowGap.ignition.activated || ignitionGate.failedGateIds.includes('fail_closed_stewardship_semantics'),
      ignitionGate.failedGateIds,
    ),
    chaosScenario(
      'GOVERNANCE_CONTINUITY_DROP',
      governanceDrop,
      governanceGate.failedGateIds.includes('governance_continuity_reconstructable'),
      governanceGate.failedGateIds,
    ),
    chaosScenario(
      'REPLAY_TELEMETRY_DROP',
      replayDrop,
      replayGate.failedGateIds.includes('stewardship_replay_faithful'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'CARETAKER_HARMONIZATION_GAP',
      caretakerGap,
      caretakerGate.failedGateIds.includes('caretaker_lineage_longitudinally_durable'),
      caretakerGate.failedGateIds,
    ),
    chaosScenario(
      'SURVIVABILITY_SCORE_DROP',
      survivabilityDrop,
      survivabilityGate.failedGateIds.includes('stewardship_survivability_scored'),
      survivabilityGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed,
      ambiguitySuppressed ? ['ambiguity_preserved_operationally'] : ambiguityGate.failedGateIds,
    ),
    chaosScenario(
      'FAIL_CLOSED_DISABLED',
      failClosedDisabled,
      failClosedGate.failedGateIds.includes('fail_closed_stewardship_semantics'),
      failClosedGate.failedGateIds,
    ),
    chaosScenario(
      'LINEAGE_DURABILITY_COLLAPSE',
      lineageCollapse,
      lineageGate.failedGateIds.includes('caretaker_lineage_longitudinally_durable'),
      lineageGate.failedGateIds,
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
