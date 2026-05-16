/**
 * runtimeActivationConvergence.ts - W2-PR152A
 *
 * Pure constitutional runtime activation synthesizer. It converges supplied
 * evidence for runtime freeze integrity, activation readiness, replay-ledger
 * durability, ecosystem ignition, governance immutability, stewardship
 * continuity, and runtime truth verification into one fail-closed activation
 * verdict.
 *
 * No fetches, no DB writes, no ledger writes. Callers provide evidence; this
 * module verifies the convergence contract and exposes deterministic lineage.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type RuntimeActivationDomain =
  | 'runtime_freeze_integrity'
  | 'institutional_activation_readiness'
  | 'replay_ledger_durability'
  | 'ecosystem_ignition'
  | 'governance_immutability'
  | 'stewardship_continuity'
  | 'runtime_truth_verification';

export interface RuntimeActivationEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeActivationDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayIntegrity: number;
  runtimeActivation: number;
  institutionalSurvivability: number;
  ecosystemTrustActivation: number;
  ambiguityHonesty: number;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguity: string | null;
}

export interface RuntimeActivationLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeActivationDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  immutable: boolean;
  failClosedReady: boolean;
  ambiguous: boolean;
  evidenceHash: string;
}

export interface RuntimeActivationLineage {
  schema: 'vitalcv.runtime-activation-lineage.v1';
  activationId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly RuntimeActivationDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly RuntimeActivationLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type RuntimeActivationStatus =
  | 'RUNTIME_ACTIVATION_READY'
  | 'RUNTIME_ACTIVATION_DEGRADED'
  | 'RUNTIME_ACTIVATION_BLOCKED';

export type RuntimeActivationVerdict =
  | 'CONSTITUTIONAL_RUNTIME_ACTIVATED'
  | 'CONSTITUTIONAL_RUNTIME_ACTIVATED_WITH_AMBIGUITY'
  | 'CONSTITUTIONAL_RUNTIME_PARTIAL'
  | 'CONSTITUTIONAL_RUNTIME_FAIL_CLOSED';

export interface RuntimeActivationConvergenceResult {
  schema: 'vitalcv.runtime-activation-convergence.v1';
  activationId: string;
  generatedAt: string;
  status: RuntimeActivationStatus;
  verdict: RuntimeActivationVerdict;
  failClosed: boolean;
  activationScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: RuntimeActivationLineage;
  replayIntegrity: {
    globallyImmutable: boolean;
    integrityPct: number;
    traceCoveragePct: number;
    nonImmutableEvidenceIds: readonly string[];
  };
  runtimeActivation: {
    evidenceDerived: boolean;
    fidelityPct: number;
  };
  institutionalSurvivability: {
    survivable: boolean;
    survivabilityPct: number;
  };
  ecosystemTrust: {
    longitudinallyMeasurable: boolean;
    activationPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  ambiguityHonesty: {
    permanentlyDurable: boolean;
    honestyPct: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  convergenceHash: string;
}

export type RuntimeActivationGateId =
  | 'replay_integrity_globally_immutable'
  | 'ambiguity_honesty_permanently_durable'
  | 'institutional_activation_survivable'
  | 'fail_closed_runtime_semantics'
  | 'ecosystem_trust_longitudinally_measurable'
  | 'runtime_activation_evidence_derived'
  | 'runtime_activation_lineage_reconstructable';

export interface RuntimeActivationGate {
  id: RuntimeActivationGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface RuntimeActivationGateResult {
  schema: 'vitalcv.runtime-activation-ci-gate.v1';
  pass: boolean;
  gates: readonly RuntimeActivationGate[];
  failedGateIds: readonly RuntimeActivationGateId[];
  gateHash: string;
}

export type RuntimeActivationChaosScenarioName =
  | 'REPLAY_IMMUTABILITY_DROP'
  | 'AMBIGUITY_HONESTY_SUPPRESSION'
  | 'LINEAGE_GAP'
  | 'SURVIVABILITY_COLLAPSE'
  | 'ECOSYSTEM_TRUST_COLLAPSE'
  | 'FAIL_CLOSED_DISABLED'
  | 'EVIDENCE_DERIVATION_GAP';

export interface RuntimeActivationChaosScenarioResult {
  scenario: RuntimeActivationChaosScenarioName;
  signalSurfaced: boolean;
  status: RuntimeActivationStatus;
  failedGateIds: readonly RuntimeActivationGateId[];
  surfacedSignals: readonly string[];
}

export interface RuntimeActivationChaosReport {
  schema: 'vitalcv.runtime-activation-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly RuntimeActivationChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface RuntimeActivationConvergenceInput {
  activationId: string;
  generatedAt: string;
  evidence: readonly RuntimeActivationEvidence[];
}

const SCHEMA_LINEAGE = 'vitalcv.runtime-activation-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-activation-convergence.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-activation-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-activation-chaos.v1' as const;
const REQUIRED_DOMAINS: readonly RuntimeActivationDomain[] = Object.freeze([
  'ecosystem_ignition',
  'governance_immutability',
  'institutional_activation_readiness',
  'replay_ledger_durability',
  'runtime_freeze_integrity',
  'runtime_truth_verification',
  'stewardship_continuity',
]);
const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;

export const RUNTIME_ACTIVATION_GATE_IDS: readonly RuntimeActivationGateId[] = Object.freeze([
  'replay_integrity_globally_immutable',
  'ambiguity_honesty_permanently_durable',
  'institutional_activation_survivable',
  'fail_closed_runtime_semantics',
  'ecosystem_trust_longitudinally_measurable',
  'runtime_activation_evidence_derived',
  'runtime_activation_lineage_reconstructable',
]);

export const RUNTIME_ACTIVATION_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: RuntimeActivationDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  replayIntegrity: number;
  runtimeActivation: number;
  institutionalSurvivability: number;
  ecosystemTrustActivation: number;
  ambiguityHonesty: number;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
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

function normalizeEvidence(evidence: readonly RuntimeActivationEvidence[]): NormalizedEvidence[] {
  return evidence
    .map((entry, index) => ({
      evidenceId: requiredString(entry.evidenceId, `missing-evidence-${index}`),
      recordedAt: requiredString(entry.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: entry.domain,
      sourceSystemId: requiredString(entry.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanString(entry.replayTraceId),
      replayIntegrity: clamp01(entry.replayIntegrity),
      runtimeActivation: clamp01(entry.runtimeActivation),
      institutionalSurvivability: clamp01(entry.institutionalSurvivability),
      ecosystemTrustActivation: clamp01(entry.ecosystemTrustActivation),
      ambiguityHonesty: clamp01(entry.ambiguityHonesty),
      immutable: entry.immutable === true,
      failClosedReady: entry.failClosedReady === true,
      evidenceRefs: cleanRefs(entry.evidenceRefs),
      lineageRefs: cleanRefs(entry.lineageRefs),
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
    replayIntegrity: evidence.replayIntegrity,
    runtimeActivation: evidence.runtimeActivation,
    institutionalSurvivability: evidence.institutionalSurvivability,
    ecosystemTrustActivation: evidence.ecosystemTrustActivation,
    ambiguityHonesty: evidence.ambiguityHonesty,
    immutable: evidence.immutable,
    failClosedReady: evidence.failClosedReady,
    evidenceRefs: evidence.evidenceRefs,
    lineageRefs: evidence.lineageRefs,
    ambiguity: evidence.ambiguity,
  });
}

function domainsObserved(evidence: readonly NormalizedEvidence[]): RuntimeActivationDomain[] {
  const observed = new Set(evidence.map(entry => entry.domain));
  return REQUIRED_DOMAINS.filter(domain => observed.has(domain));
}

function buildLineageFromNormalized(input: {
  activationId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): RuntimeActivationLineage {
  const timeline: RuntimeActivationLineageEntry[] = input.evidence.map((entry, index) => ({
    position: index + 1,
    evidenceId: entry.evidenceId,
    recordedAt: entry.recordedAt,
    domain: entry.domain,
    sourceSystemId: entry.sourceSystemId,
    replayTraceId: entry.replayTraceId,
    evidenceRefCount: entry.evidenceRefs.length,
    lineageRefCount: entry.lineageRefs.length,
    immutable: entry.immutable,
    failClosedReady: entry.failClosedReady,
    ambiguous: entry.ambiguity !== null,
    evidenceHash: evidenceHash(entry),
  }));
  const observedDomains = domainsObserved(input.evidence);
  const sourceSystemIds = dedupeSorted(input.evidence.map(entry => entry.sourceSystemId));
  const body = {
    schema: SCHEMA_LINEAGE,
    activationId: input.activationId,
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

export function buildRuntimeActivationLineage(
  input: RuntimeActivationConvergenceInput,
): RuntimeActivationLineage {
  return buildLineageFromNormalized({
    ...input,
    evidence: normalizeEvidence(input.evidence),
  });
}

function lineageReconstructable(
  evidence: readonly NormalizedEvidence[],
  lineage: RuntimeActivationLineage,
): boolean {
  return evidence.length >= REQUIRED_DOMAINS.length
    && lineage.domainsObserved.length === REQUIRED_DOMAINS.length
    && evidence.every(entry => entry.evidenceRefs.length > 0)
    && evidence.every(entry => entry.lineageRefs.length > 0);
}

export function evaluateRuntimeActivationConvergence(
  input: RuntimeActivationConvergenceInput,
): RuntimeActivationConvergenceResult {
  const evidence = normalizeEvidence(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const total = evidence.length;
  const traceCoveragePct = total > 0
    ? pct((evidence.filter(entry => entry.replayTraceId !== null).length / total) * 100)
    : 0;
  const replayIntegrityPct = pct(average(evidence.map(entry => entry.replayIntegrity)) * 100);
  const nonImmutableEvidenceIds = evidence
    .filter(entry => !entry.immutable || entry.replayTraceId === null)
    .map(entry => entry.evidenceId);
  const globallyImmutable =
    total >= REQUIRED_DOMAINS.length
      && nonImmutableEvidenceIds.length === 0
      && traceCoveragePct >= MIN_TRACE_COVERAGE
      && replayIntegrityPct >= MIN_SCORE;
  const activationPct = pct(average(evidence.map(entry => entry.runtimeActivation)) * 100);
  const activationEvidenceDerived =
    total >= REQUIRED_DOMAINS.length
      && activationPct >= MIN_SCORE
      && evidence.every(entry => entry.evidenceRefs.length > 0)
      && evidence.every(entry => entry.failClosedReady);
  const survivabilityPct = pct(average(evidence.map(entry => entry.institutionalSurvivability)) * 100);
  const activationSurvivable = total >= REQUIRED_DOMAINS.length && survivabilityPct >= MIN_SCORE;
  const ecosystemTrustPct = pct(average(evidence.map(entry => entry.ecosystemTrustActivation)) * 100);
  const uniqueRecordedAt = new Set(evidence.map(entry => entry.recordedAt));
  const ecosystemTrustLongitudinallyMeasurable =
    total >= REQUIRED_DOMAINS.length
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt
      && ecosystemTrustPct >= MIN_SCORE;
  const honestyPct = pct(average(evidence.map(entry => entry.ambiguityHonesty)) * 100);
  const ambiguities = dedupeChronological(evidence.map(entry => entry.ambiguity));
  const ambiguityPreserved = dedupeChronological(evidence.map(entry => entry.ambiguity)).length === ambiguities.length;
  const ambiguityHonestyDurable = honestyPct >= MIN_SCORE && ambiguityPreserved;
  const reconstructable = lineageReconstructable(evidence, lineage);
  const failClosedReady = total >= REQUIRED_DOMAINS.length && evidence.every(entry => entry.failClosedReady);

  const blockers: string[] = [];
  if (!globallyImmutable) blockers.push('Replay integrity is not globally immutable.');
  if (!activationEvidenceDerived) blockers.push('Runtime activation evidence is not derived.');
  if (!activationSurvivable) blockers.push('Institutional activation is not survivable.');
  if (!ecosystemTrustLongitudinallyMeasurable) blockers.push('Ecosystem trust is not longitudinally measurable.');
  if (!reconstructable) blockers.push('Runtime activation lineage is not reconstructable.');
  if (!ambiguityHonestyDurable) blockers.push('Ambiguity honesty is not permanently durable.');
  if (!failClosedReady) blockers.push('Fail-closed runtime semantics are not ready.');

  const failClosed = blockers.length > 0;
  const rawActivationScore = pct(
    replayIntegrityPct * 0.24
      + activationPct * 0.22
      + survivabilityPct * 0.2
      + ecosystemTrustPct * 0.18
      + honestyPct * 0.16,
  );
  const activationScore = failClosed ? Math.min(rawActivationScore, 49) : rawActivationScore;
  const status: RuntimeActivationStatus = failClosed
    ? 'RUNTIME_ACTIVATION_BLOCKED'
    : ambiguities.length > 0 || activationScore < 92
      ? 'RUNTIME_ACTIVATION_DEGRADED'
      : 'RUNTIME_ACTIVATION_READY';
  const verdict: RuntimeActivationVerdict = status === 'RUNTIME_ACTIVATION_BLOCKED'
    ? 'CONSTITUTIONAL_RUNTIME_FAIL_CLOSED'
    : status === 'RUNTIME_ACTIVATION_READY'
      ? 'CONSTITUTIONAL_RUNTIME_ACTIVATED'
      : ambiguities.length > 0
        ? 'CONSTITUTIONAL_RUNTIME_ACTIVATED_WITH_AMBIGUITY'
        : 'CONSTITUTIONAL_RUNTIME_PARTIAL';
  const basis: string[] = [];
  if (globallyImmutable) basis.push('replay_integrity_globally_immutable');
  if (activationEvidenceDerived) basis.push('runtime_activation_evidence_derived');
  if (activationSurvivable) basis.push('institutional_activation_survivable');
  if (ambiguityHonestyDurable) basis.push('ambiguity_honesty_permanently_durable');
  if (ecosystemTrustLongitudinallyMeasurable) basis.push('ecosystem_trust_longitudinally_measurable');
  if (reconstructable) basis.push('runtime_activation_lineage_reconstructable');
  if (!failClosed) basis.push('fail_closed_runtime_semantics');

  const body = {
    schema: SCHEMA_RESULT,
    activationId: input.activationId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    activationScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayIntegrity: {
      globallyImmutable,
      integrityPct: replayIntegrityPct,
      traceCoveragePct,
      nonImmutableEvidenceIds,
    },
    runtimeActivation: {
      evidenceDerived: activationEvidenceDerived,
      fidelityPct: activationPct,
    },
    institutionalSurvivability: {
      survivable: activationSurvivable,
      survivabilityPct,
    },
    ecosystemTrust: {
      longitudinallyMeasurable: ecosystemTrustLongitudinallyMeasurable,
      activationPct: ecosystemTrustPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    ambiguityHonesty: {
      permanentlyDurable: ambiguityHonestyDurable,
      honestyPct,
    },
    confidence: {
      score: activationScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    convergenceHash: sha256ForPayload(body),
  };
}

export function evaluateRuntimeActivationGate(
  result: RuntimeActivationConvergenceResult,
): RuntimeActivationGateResult {
  const gates: RuntimeActivationGate[] = [
    {
      id: 'replay_integrity_globally_immutable',
      pass: result.replayIntegrity.globallyImmutable,
      observed: result.replayIntegrity.integrityPct,
      required: MIN_SCORE,
    },
    {
      id: 'ambiguity_honesty_permanently_durable',
      pass: result.ambiguityHonesty.permanentlyDurable,
      observed: result.ambiguityHonesty.honestyPct,
      required: MIN_SCORE,
    },
    {
      id: 'institutional_activation_survivable',
      pass: result.institutionalSurvivability.survivable,
      observed: result.institutionalSurvivability.survivabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'fail_closed_runtime_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'ecosystem_trust_longitudinally_measurable',
      pass: result.ecosystemTrust.longitudinallyMeasurable,
      observed: result.ecosystemTrust.activationPct,
      required: MIN_SCORE,
    },
    {
      id: 'runtime_activation_evidence_derived',
      pass: result.runtimeActivation.evidenceDerived,
      observed: result.runtimeActivation.fidelityPct,
      required: MIN_SCORE,
    },
    {
      id: 'runtime_activation_lineage_reconstructable',
      pass: result.lineage.domainsObserved.length === REQUIRED_DOMAINS.length
        && result.lineage.timeline.every(entry => entry.evidenceRefCount > 0 && entry.lineageRefCount > 0),
      observed: result.lineage.domainsObserved.length,
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
  scenario: RuntimeActivationChaosScenarioName,
  result: RuntimeActivationConvergenceResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): RuntimeActivationChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateRuntimeActivationGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runRuntimeActivationChaosSimulations(
  input: RuntimeActivationConvergenceInput,
): RuntimeActivationChaosReport {
  const baseline = evaluateRuntimeActivationConvergence(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;
  const replayDrop = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'replay_ledger_durability'
      ? { ...entry, replayIntegrity: 0.2, immutable: false, replayTraceId: null }
      : entry),
  });
  const replayGate = evaluateRuntimeActivationGate(replayDrop);

  const ambiguitySuppression = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      ambiguity: null,
      ambiguityHonesty: 0.2,
    })),
  });
  const ambiguityGate = evaluateRuntimeActivationGate(ambiguitySuppression);

  const lineageGap = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => entry.domain === 'governance_immutability'
      ? { ...entry, evidenceRefs: [], lineageRefs: [] }
      : entry),
  });
  const lineageGate = evaluateRuntimeActivationGate(lineageGap);

  const survivabilityCollapse = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, institutionalSurvivability: 0.1 })),
  });
  const survivabilityGate = evaluateRuntimeActivationGate(survivabilityCollapse);

  const ecosystemTrustCollapse = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => ({
      ...entry,
      recordedAt: input.evidence[0]?.recordedAt ?? input.generatedAt,
      ecosystemTrustActivation: 0.1,
    })),
  });
  const ecosystemGate = evaluateRuntimeActivationGate(ecosystemTrustCollapse);

  const failClosedDisabled = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, failClosedReady: false })),
  });
  const failClosedGate = evaluateRuntimeActivationGate(failClosedDisabled);

  const evidenceGap = evaluateRuntimeActivationConvergence({
    ...input,
    evidence: input.evidence.map(entry => ({ ...entry, evidenceRefs: [], runtimeActivation: 0.1 })),
  });
  const evidenceGate = evaluateRuntimeActivationGate(evidenceGap);

  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;
  const scenarios: RuntimeActivationChaosScenarioResult[] = [
    chaosScenario(
      'REPLAY_IMMUTABILITY_DROP',
      replayDrop,
      replayGate.failedGateIds.includes('replay_integrity_globally_immutable'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_HONESTY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed && ambiguityGate.failedGateIds.includes('ambiguity_honesty_permanently_durable'),
      ambiguityGate.failedGateIds,
    ),
    chaosScenario(
      'LINEAGE_GAP',
      lineageGap,
      lineageGate.failedGateIds.includes('runtime_activation_lineage_reconstructable'),
      lineageGate.failedGateIds,
    ),
    chaosScenario(
      'SURVIVABILITY_COLLAPSE',
      survivabilityCollapse,
      survivabilityGate.failedGateIds.includes('institutional_activation_survivable'),
      survivabilityGate.failedGateIds,
    ),
    chaosScenario(
      'ECOSYSTEM_TRUST_COLLAPSE',
      ecosystemTrustCollapse,
      ecosystemGate.failedGateIds.includes('ecosystem_trust_longitudinally_measurable'),
      ecosystemGate.failedGateIds,
    ),
    chaosScenario(
      'FAIL_CLOSED_DISABLED',
      failClosedDisabled,
      failClosedGate.failedGateIds.includes('fail_closed_runtime_semantics'),
      failClosedGate.failedGateIds,
    ),
    chaosScenario(
      'EVIDENCE_DERIVATION_GAP',
      evidenceGap,
      evidenceGate.failedGateIds.includes('runtime_activation_evidence_derived'),
      evidenceGate.failedGateIds,
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
