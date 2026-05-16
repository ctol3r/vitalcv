/**
 * runtimeStewardshipOperations.ts - W2-PR165A
 *
 * Pure runtime stewardship operations evaluator. It turns supplied runbook,
 * replay-monitoring, caretaker workflow, telemetry, succession, survivability,
 * and longitudinal continuity evidence into deterministic lineage, gates, and
 * fail-closed operations verdicts.
 *
 * No fetches, no DB writes, no audit writes. Governance continuity primitives
 * feed this layer; this layer operationalizes their runtime readiness.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type RuntimeStewardshipOperationsDomain =
  | 'operational_runbook'
  | 'replay_stewardship_monitoring'
  | 'runtime_caretaker_workflow'
  | 'stewardship_telemetry'
  | 'succession_continuity_planning'
  | 'runtime_survivability'
  | 'longitudinal_continuity';

export interface RuntimeStewardshipOperationsEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeStewardshipOperationsDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayFaithfulness: number;
  runtimeContinuity: number;
  successionSurvivability: number;
  operationalStability: number;
  runtimeSurvivability: number;
  longitudinalDurability: number;
  runbookRefs: readonly string[];
  caretakerWorkflowRefs: readonly string[];
  successionPlanRefs: readonly string[];
  telemetryRefs: readonly string[];
  evidenceRefs: readonly string[];
  continuityLineageRefs: readonly string[];
  ambiguityRefs: readonly string[];
  ambiguity: string | null;
  failClosedReady: boolean;
}

export interface RuntimeStewardshipOperationsLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeStewardshipOperationsDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  runbookRefCount: number;
  caretakerWorkflowRefCount: number;
  successionPlanRefCount: number;
  telemetryRefCount: number;
  evidenceRefCount: number;
  continuityLineageRefCount: number;
  ambiguityRefCount: number;
  failClosedReady: boolean;
  ambiguous: boolean;
  evidenceHash: string;
}

export interface RuntimeStewardshipOperationsLineage {
  schema: 'vitalcv.runtime-stewardship-operations-lineage.v1';
  operationsId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly RuntimeStewardshipOperationsDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly RuntimeStewardshipOperationsLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type RuntimeStewardshipOperationsStatus =
  | 'STEWARDSHIP_OPERATIONS_READY'
  | 'STEWARDSHIP_OPERATIONS_DEGRADED'
  | 'STEWARDSHIP_OPERATIONS_BLOCKED';

export type RuntimeStewardshipOperationsVerdict =
  | 'STEWARDSHIP_OPERATIONS_FINALIZED'
  | 'STEWARDSHIP_OPERATIONS_FINALIZED_WITH_AMBIGUITY'
  | 'STEWARDSHIP_OPERATIONS_PARTIAL'
  | 'STEWARDSHIP_OPERATIONS_FAIL_CLOSED';

export interface RuntimeStewardshipOperationsResult {
  schema: 'vitalcv.runtime-stewardship-operations.v1';
  operationsId: string;
  generatedAt: string;
  status: RuntimeStewardshipOperationsStatus;
  verdict: RuntimeStewardshipOperationsVerdict;
  failClosed: boolean;
  operationsScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: RuntimeStewardshipOperationsLineage;
  replayStewardship: {
    faithful: boolean;
    fidelityPct: number;
    traceCoveragePct: number;
  };
  runtimeContinuity: {
    measurable: boolean;
    continuityPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  caretakerOperations: {
    workflowsReady: boolean;
    runbookCoveragePct: number;
    caretakerWorkflowCount: number;
  };
  successionContinuity: {
    survivable: boolean;
    survivabilityPct: number;
    successionPlanCount: number;
  };
  operationalStability: {
    stable: boolean;
    stabilityPct: number;
    telemetryCoveragePct: number;
  };
  runtimeSurvivability: {
    measurable: boolean;
    survivabilityPct: number;
  };
  continuityLineage: {
    reconstructable: boolean;
    evidenceRefCount: number;
    lineageRefCount: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  operationsHash: string;
}

export type RuntimeStewardshipOperationsGateId =
  | 'stewardship_replay_faithful'
  | 'ambiguity_preserved_operationally'
  | 'continuity_lineage_reconstructable'
  | 'fail_closed_stewardship_semantics'
  | 'runtime_survivability_measurable'
  | 'operational_continuity_longitudinally_durable'
  | 'succession_continuity_survivable';

export interface RuntimeStewardshipOperationsGate {
  id: RuntimeStewardshipOperationsGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface RuntimeStewardshipOperationsGateResult {
  schema: 'vitalcv.runtime-stewardship-operations-ci-gate.v1';
  pass: boolean;
  gates: readonly RuntimeStewardshipOperationsGate[];
  failedGateIds: readonly RuntimeStewardshipOperationsGateId[];
  gateHash: string;
}

export type RuntimeStewardshipOperationsChaosScenarioName =
  | 'RUNBOOK_GAP'
  | 'REPLAY_MONITORING_GAP'
  | 'CARETAKER_WORKFLOW_GAP'
  | 'TELEMETRY_DROP'
  | 'SUCCESSION_PLAN_COLLAPSE'
  | 'AMBIGUITY_SUPPRESSION'
  | 'FAIL_CLOSED_DISABLED'
  | 'LONGITUDINAL_DURABILITY_COLLAPSE';

export interface RuntimeStewardshipOperationsChaosScenarioResult {
  scenario: RuntimeStewardshipOperationsChaosScenarioName;
  signalSurfaced: boolean;
  status: RuntimeStewardshipOperationsStatus;
  failedGateIds: readonly RuntimeStewardshipOperationsGateId[];
  surfacedSignals: readonly string[];
}

export interface RuntimeStewardshipOperationsChaosReport {
  schema: 'vitalcv.runtime-stewardship-operations-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly RuntimeStewardshipOperationsChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface RuntimeStewardshipOperationsInput {
  operationsId: string;
  generatedAt: string;
  evidence: readonly RuntimeStewardshipOperationsEvidence[];
}

const SCHEMA_LINEAGE = 'vitalcv.runtime-stewardship-operations-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-stewardship-operations.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-stewardship-operations-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-stewardship-operations-chaos.v1' as const;
const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;

const REQUIRED_DOMAINS: readonly RuntimeStewardshipOperationsDomain[] = Object.freeze([
  'operational_runbook',
  'replay_stewardship_monitoring',
  'runtime_caretaker_workflow',
  'stewardship_telemetry',
  'succession_continuity_planning',
  'runtime_survivability',
  'longitudinal_continuity',
]);

export const RUNTIME_STEWARDSHIP_OPERATIONS_GATE_IDS: readonly RuntimeStewardshipOperationsGateId[] = Object.freeze([
  'stewardship_replay_faithful',
  'ambiguity_preserved_operationally',
  'continuity_lineage_reconstructable',
  'fail_closed_stewardship_semantics',
  'runtime_survivability_measurable',
  'operational_continuity_longitudinally_durable',
  'succession_continuity_survivable',
]);

export const RUNTIME_STEWARDSHIP_OPERATIONS_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeStewardshipOperationsDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayFaithfulness: number;
  runtimeContinuity: number;
  successionSurvivability: number;
  operationalStability: number;
  runtimeSurvivability: number;
  longitudinalDurability: number;
  runbookRefs: readonly string[];
  caretakerWorkflowRefs: readonly string[];
  successionPlanRefs: readonly string[];
  telemetryRefs: readonly string[];
  evidenceRefs: readonly string[];
  continuityLineageRefs: readonly string[];
  ambiguityRefs: readonly string[];
  ambiguity: string | null;
  failClosedReady: boolean;
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
  evidence: readonly RuntimeStewardshipOperationsEvidence[],
): NormalizedEvidence[] {
  return evidence
    .map((entry, index) => ({
      evidenceId: requiredString(entry.evidenceId, `missing-stewardship-evidence-${index}`),
      recordedAt: requiredString(entry.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: entry.domain,
      sourceSystemId: requiredString(entry.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanString(entry.replayTraceId),
      replayFaithfulness: clamp01(entry.replayFaithfulness),
      runtimeContinuity: clamp01(entry.runtimeContinuity),
      successionSurvivability: clamp01(entry.successionSurvivability),
      operationalStability: clamp01(entry.operationalStability),
      runtimeSurvivability: clamp01(entry.runtimeSurvivability),
      longitudinalDurability: clamp01(entry.longitudinalDurability),
      runbookRefs: dedupeSorted(entry.runbookRefs),
      caretakerWorkflowRefs: dedupeSorted(entry.caretakerWorkflowRefs),
      successionPlanRefs: dedupeSorted(entry.successionPlanRefs),
      telemetryRefs: dedupeSorted(entry.telemetryRefs),
      evidenceRefs: dedupeSorted(entry.evidenceRefs),
      continuityLineageRefs: dedupeSorted(entry.continuityLineageRefs),
      ambiguityRefs: dedupeSorted(entry.ambiguityRefs),
      ambiguity: cleanString(entry.ambiguity),
      failClosedReady: entry.failClosedReady === true,
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
    runtimeContinuity: entry.runtimeContinuity,
    successionSurvivability: entry.successionSurvivability,
    operationalStability: entry.operationalStability,
    runtimeSurvivability: entry.runtimeSurvivability,
    longitudinalDurability: entry.longitudinalDurability,
    runbookRefs: entry.runbookRefs,
    caretakerWorkflowRefs: entry.caretakerWorkflowRefs,
    successionPlanRefs: entry.successionPlanRefs,
    telemetryRefs: entry.telemetryRefs,
    evidenceRefs: entry.evidenceRefs,
    continuityLineageRefs: entry.continuityLineageRefs,
    ambiguityRefs: entry.ambiguityRefs,
    ambiguity: entry.ambiguity,
    failClosedReady: entry.failClosedReady,
  });
}

function observedDomains(
  evidence: readonly NormalizedEvidence[],
): RuntimeStewardshipOperationsDomain[] {
  const present = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.filter(domain => present.has(domain));
}

function hasAllRequiredDomains(evidence: readonly NormalizedEvidence[]): boolean {
  const present = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.every(domain => present.has(domain));
}

function buildLineageFromNormalized(input: {
  operationsId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): RuntimeStewardshipOperationsLineage {
  const timeline: RuntimeStewardshipOperationsLineageEntry[] = input.evidence.map((entry, index) => ({
    position: index + 1,
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    runbookRefCount: entry.runbookRefs.length,
    caretakerWorkflowRefCount: entry.caretakerWorkflowRefs.length,
    successionPlanRefCount: entry.successionPlanRefs.length,
    telemetryRefCount: entry.telemetryRefs.length,
    evidenceRefCount: entry.evidenceRefs.length,
    continuityLineageRefCount: entry.continuityLineageRefs.length,
    ambiguityRefCount: entry.ambiguityRefs.length,
    failClosedReady: entry.failClosedReady,
    ambiguous: entry.ambiguity !== null,
    evidenceHash: evidenceHash(entry),
  }));
  const body = {
    schema: SCHEMA_LINEAGE,
    operationsId: input.operationsId,
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

export function buildRuntimeStewardshipOperationsLineage(
  input: RuntimeStewardshipOperationsInput,
): RuntimeStewardshipOperationsLineage {
  return buildLineageFromNormalized({
    ...input,
    evidence: normalizeEvidence(input.evidence),
  });
}

function coveragePct(evidence: readonly NormalizedEvidence[], key: keyof Pick<
  NormalizedEvidence,
  | 'runbookRefs'
  | 'caretakerWorkflowRefs'
  | 'successionPlanRefs'
  | 'telemetryRefs'
  | 'evidenceRefs'
  | 'continuityLineageRefs'
>): number {
  if (evidence.length === 0) return 0;
  return pct((evidence.filter(entry => entry[key].length > 0).length / evidence.length) * 100);
}

export function evaluateRuntimeStewardshipOperations(
  input: RuntimeStewardshipOperationsInput,
): RuntimeStewardshipOperationsResult {
  const evidence = normalizeEvidence(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const hasDomains = hasAllRequiredDomains(evidence);
  const traceCoveragePct = evidence.length > 0
    ? pct((evidence.filter(entry => entry.replayTraceId !== null).length / evidence.length) * 100)
    : 0;
  const replayFidelityPct = pct(average(evidence.map(entry => entry.replayFaithfulness)) * 100);
  const faithful =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && replayFidelityPct >= MIN_SCORE
      && traceCoveragePct >= MIN_TRACE_COVERAGE
      && evidence.some(entry => entry.domain === 'replay_stewardship_monitoring');

  const ambiguities = dedupeChronological(evidence.map(entry => entry.ambiguity));
  const ambiguityPreserved = dedupeChronological(evidence.map(entry => entry.ambiguity)).length === ambiguities.length;
  const ambiguousEvidence = evidence.filter(entry => entry.ambiguity !== null);
  const ambiguityCovered = ambiguousEvidence.length === 0
    || ambiguousEvidence.every(entry => entry.ambiguityRefs.length > 0);
  const operationalAmbiguityPreserved = ambiguityPreserved && ambiguityCovered;

  const continuityPct = pct(average(evidence.map(entry => entry.runtimeContinuity)) * 100);
  const uniqueRecordedAt = new Set(evidence.map(entry => entry.recordedAt));
  const measurableContinuity =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && continuityPct >= MIN_SCORE
      && evidence.some(entry => entry.domain === 'longitudinal_continuity')
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt;

  const runbookCoveragePct = coveragePct(evidence, 'runbookRefs');
  const caretakerWorkflowCount = evidence.reduce((sum, entry) => sum + entry.caretakerWorkflowRefs.length, 0);
  const workflowsReady =
    hasDomains
      && runbookCoveragePct === 100
      && evidence.every(entry => entry.caretakerWorkflowRefs.length > 0)
      && evidence.some(entry => entry.domain === 'runtime_caretaker_workflow');

  const successionPlanCount = evidence.reduce((sum, entry) => sum + entry.successionPlanRefs.length, 0);
  const successionPct = pct(average(evidence.map(entry => entry.successionSurvivability)) * 100);
  const successionSurvivable =
    hasDomains
      && successionPct >= MIN_SCORE
      && successionPlanCount >= REQUIRED_DOMAINS.length
      && evidence.some(entry => entry.domain === 'succession_continuity_planning');

  const telemetryCoveragePct = coveragePct(evidence, 'telemetryRefs');
  const stabilityPct = pct(average(evidence.map(entry => entry.operationalStability)) * 100);
  const operationallyStable =
    hasDomains
      && stabilityPct >= MIN_SCORE
      && telemetryCoveragePct === 100
      && evidence.some(entry => entry.domain === 'stewardship_telemetry');

  const survivabilityPct = pct(average(evidence.map(entry => entry.runtimeSurvivability)) * 100);
  const runtimeSurvivabilityMeasurable =
    hasDomains
      && survivabilityPct >= MIN_SCORE
      && coveragePct(evidence, 'evidenceRefs') === 100
      && evidence.some(entry => entry.domain === 'runtime_survivability');

  const durabilityPct = pct(average(evidence.map(entry => entry.longitudinalDurability)) * 100);
  const longitudinallyDurable =
    measurableContinuity
      && durabilityPct >= MIN_SCORE
      && operationallyStable;

  const evidenceRefCount = evidence.reduce((sum, entry) => sum + entry.evidenceRefs.length, 0);
  const lineageRefCount = evidence.reduce((sum, entry) => sum + entry.continuityLineageRefs.length, 0);
  const lineageReconstructable =
    evidence.length >= REQUIRED_DOMAINS.length
      && hasDomains
      && evidence.every(entry => entry.evidenceRefs.length > 0)
      && evidence.every(entry => entry.continuityLineageRefs.length > 0)
      && lineage.sourceSystemIds.length > 0;

  const failClosedReady = evidence.length > 0 && evidence.every(entry => entry.failClosedReady);

  const blockers: string[] = [];
  if (!faithful) blockers.push('Replay stewardship is not faithful.');
  if (!operationalAmbiguityPreserved) blockers.push('Operational ambiguity is not preserved.');
  if (!lineageReconstructable) blockers.push('Continuity lineage is not reconstructable.');
  if (!failClosedReady) blockers.push('Fail-closed stewardship semantics are not ready.');
  if (!runtimeSurvivabilityMeasurable) blockers.push('Runtime survivability is not measurable.');
  if (!longitudinallyDurable) blockers.push('Operational continuity is not longitudinally durable.');
  if (!successionSurvivable) blockers.push('Succession continuity is not survivable.');

  const failClosed = blockers.length > 0;
  const rawScore = pct(
    continuityPct * 0.2
      + replayFidelityPct * 0.18
      + successionPct * 0.16
      + stabilityPct * 0.16
      + survivabilityPct * 0.15
      + durabilityPct * 0.15,
  );
  const operationsScore = failClosed ? Math.min(rawScore, 49) : rawScore;
  const status: RuntimeStewardshipOperationsStatus = failClosed
    ? 'STEWARDSHIP_OPERATIONS_BLOCKED'
    : ambiguities.length > 0 || operationsScore < 90
      ? 'STEWARDSHIP_OPERATIONS_DEGRADED'
      : 'STEWARDSHIP_OPERATIONS_READY';
  const verdict: RuntimeStewardshipOperationsVerdict = status === 'STEWARDSHIP_OPERATIONS_BLOCKED'
    ? 'STEWARDSHIP_OPERATIONS_FAIL_CLOSED'
    : status === 'STEWARDSHIP_OPERATIONS_READY'
      ? 'STEWARDSHIP_OPERATIONS_FINALIZED'
      : ambiguities.length > 0
        ? 'STEWARDSHIP_OPERATIONS_FINALIZED_WITH_AMBIGUITY'
        : 'STEWARDSHIP_OPERATIONS_PARTIAL';

  const basis: string[] = [];
  if (faithful) basis.push('stewardship_replay_faithful');
  if (operationalAmbiguityPreserved) basis.push('ambiguity_preserved_operationally');
  if (lineageReconstructable) basis.push('continuity_lineage_reconstructable');
  if (!failClosed) basis.push('fail_closed_stewardship_semantics');
  if (runtimeSurvivabilityMeasurable) basis.push('runtime_survivability_measurable');
  if (longitudinallyDurable) basis.push('operational_continuity_longitudinally_durable');
  if (successionSurvivable) basis.push('succession_continuity_survivable');

  const body = {
    schema: SCHEMA_RESULT,
    operationsId: input.operationsId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    operationsScore,
    blockers,
    ambiguities,
    ambiguityPreserved: operationalAmbiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayStewardship: {
      faithful,
      fidelityPct: replayFidelityPct,
      traceCoveragePct,
    },
    runtimeContinuity: {
      measurable: measurableContinuity,
      continuityPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    caretakerOperations: {
      workflowsReady,
      runbookCoveragePct,
      caretakerWorkflowCount,
    },
    successionContinuity: {
      survivable: successionSurvivable,
      survivabilityPct: successionPct,
      successionPlanCount,
    },
    operationalStability: {
      stable: operationallyStable,
      stabilityPct,
      telemetryCoveragePct,
    },
    runtimeSurvivability: {
      measurable: runtimeSurvivabilityMeasurable,
      survivabilityPct,
    },
    continuityLineage: {
      reconstructable: lineageReconstructable,
      evidenceRefCount,
      lineageRefCount,
    },
    confidence: {
      score: operationsScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    operationsHash: sha256ForPayload(body),
  };
}

export function evaluateRuntimeStewardshipOperationsGate(
  result: RuntimeStewardshipOperationsResult,
): RuntimeStewardshipOperationsGateResult {
  const gates: RuntimeStewardshipOperationsGate[] = [
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
      id: 'continuity_lineage_reconstructable',
      pass: result.continuityLineage.reconstructable,
      observed: result.continuityLineage.reconstructable,
      required: true,
    },
    {
      id: 'fail_closed_stewardship_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'runtime_survivability_measurable',
      pass: result.runtimeSurvivability.measurable,
      observed: result.runtimeSurvivability.survivabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'operational_continuity_longitudinally_durable',
      pass: result.runtimeContinuity.measurable && result.runtimeContinuity.continuityPct >= MIN_SCORE,
      observed: result.runtimeContinuity.continuityPct,
      required: MIN_SCORE,
    },
    {
      id: 'succession_continuity_survivable',
      pass: result.successionContinuity.survivable,
      observed: result.successionContinuity.survivabilityPct,
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
  scenario: RuntimeStewardshipOperationsChaosScenarioName,
  result: RuntimeStewardshipOperationsResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): RuntimeStewardshipOperationsChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateRuntimeStewardshipOperationsGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runRuntimeStewardshipOperationsChaosSimulations(
  input: RuntimeStewardshipOperationsInput,
): RuntimeStewardshipOperationsChaosReport {
  const baseline = evaluateRuntimeStewardshipOperations(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const runbookGap = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'operational_runbook'
      ? { ...entry, runbookRefs: [], caretakerWorkflowRefs: [] }
      : entry),
  });
  const runbookGate = evaluateRuntimeStewardshipOperationsGate(runbookGap);

  const replayGap = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      replayTraceId: null,
      replayFaithfulness: entry.domain === 'replay_stewardship_monitoring' ? 0.1 : entry.replayFaithfulness,
    })),
  });
  const replayGate = evaluateRuntimeStewardshipOperationsGate(replayGap);

  const caretakerGap = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'runtime_caretaker_workflow'
      ? { ...entry, caretakerWorkflowRefs: [], operationalStability: 0.2 }
      : entry),
  });
  const caretakerGate = evaluateRuntimeStewardshipOperationsGate(caretakerGap);

  const telemetryDrop = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'stewardship_telemetry'
      ? { ...entry, telemetryRefs: [], operationalStability: 0.1 }
      : entry),
  });
  const telemetryGate = evaluateRuntimeStewardshipOperationsGate(telemetryDrop);

  const successionCollapse = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'succession_continuity_planning'
      ? { ...entry, successionPlanRefs: [], successionSurvivability: 0.1 }
      : entry),
  });
  const successionGate = evaluateRuntimeStewardshipOperationsGate(successionCollapse);

  const ambiguitySuppression = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      ambiguity: null,
      ambiguityRefs: [],
    })),
  });
  const ambiguityGate = evaluateRuntimeStewardshipOperationsGate(ambiguitySuppression);
  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;

  const failClosedDisabled = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, failClosedReady: false })),
  });
  const failClosedGate = evaluateRuntimeStewardshipOperationsGate(failClosedDisabled);

  const longitudinalCollapse = evaluateRuntimeStewardshipOperations({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      recordedAt: '2026-05-11T01:00:00.000Z',
      runtimeContinuity: 0.2,
      longitudinalDurability: 0.2,
    })),
  });
  const longitudinalGate = evaluateRuntimeStewardshipOperationsGate(longitudinalCollapse);

  const scenarios: RuntimeStewardshipOperationsChaosScenarioResult[] = [
    chaosScenario(
      'RUNBOOK_GAP',
      runbookGap,
      runbookGate.failedGateIds.includes('operational_continuity_longitudinally_durable')
        || !runbookGap.caretakerOperations.workflowsReady,
      runbookGate.failedGateIds,
    ),
    chaosScenario(
      'REPLAY_MONITORING_GAP',
      replayGap,
      replayGate.failedGateIds.includes('stewardship_replay_faithful'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'CARETAKER_WORKFLOW_GAP',
      caretakerGap,
      !caretakerGap.caretakerOperations.workflowsReady
        || caretakerGate.failedGateIds.includes('operational_continuity_longitudinally_durable'),
      caretakerGate.failedGateIds,
    ),
    chaosScenario(
      'TELEMETRY_DROP',
      telemetryDrop,
      !telemetryDrop.operationalStability.stable
        || telemetryGate.failedGateIds.includes('operational_continuity_longitudinally_durable'),
      telemetryGate.failedGateIds,
    ),
    chaosScenario(
      'SUCCESSION_PLAN_COLLAPSE',
      successionCollapse,
      successionGate.failedGateIds.includes('succession_continuity_survivable'),
      successionGate.failedGateIds,
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
      'LONGITUDINAL_DURABILITY_COLLAPSE',
      longitudinalCollapse,
      longitudinalGate.failedGateIds.includes('operational_continuity_longitudinally_durable'),
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
