/**
 * ecosystemExpansionLayer.ts - W2-PR131A
 *
 * Pure institutional ecosystem expansion evaluator. It consumes supplied
 * expansion telemetry across issuers, employers, clinicians, and verifier
 * ecosystems, then computes replay-trust propagation, onboarding lineage,
 * survivability, growth visibility, and drift analytics.
 *
 * No fetches, no DB writes, no onboarding side effects. This is the boundary
 * checker that live onboarding and executive surfaces can call later.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type EcosystemExpansionParticipantRole =
  | 'ISSUER'
  | 'EMPLOYER'
  | 'CLINICIAN'
  | 'VERIFIER';

export type EcosystemExpansionSignalType =
  | 'issuer_invited'
  | 'employer_onboarded'
  | 'clinician_activated'
  | 'verifier_connected'
  | 'replay_trust_propagated'
  | 'survivability_observed'
  | 'expansion_drift_detected';

export interface EcosystemExpansionSignal {
  signalId: string;
  recordedAt: string;
  ecosystemId: string;
  institutionId: string;
  participantOrgId: string;
  participantRole: EcosystemExpansionParticipantRole;
  signalType: EcosystemExpansionSignalType;
  replaySafe: boolean;
  replayTraceId: string | null;
  replayTrustPropagation: number;
  onboardingFidelity: number;
  ecosystemSurvivability: number;
  institutionalGrowth: number;
  /** 0..1 where lower means less expansion drift. */
  expansionDrift: number;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguity: string | null;
}

export interface EcosystemExpansionLineageEntry {
  position: number;
  signalId: string;
  recordedAt: string;
  institutionId: string;
  participantOrgId: string;
  participantRole: EcosystemExpansionParticipantRole;
  signalType: EcosystemExpansionSignalType;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  ambiguous: boolean;
  signalHash: string;
}

export interface EcosystemExpansionLineage {
  schema: 'vitalcv.ecosystem-expansion-lineage.v1';
  expansionId: string;
  ecosystemId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  participantOrgIds: readonly string[];
  rolesObserved: readonly EcosystemExpansionParticipantRole[];
  timeline: readonly EcosystemExpansionLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type EcosystemExpansionStatus =
  | 'EXPANSION_READY'
  | 'EXPANSION_DEGRADED'
  | 'EXPANSION_BLOCKED';

export type EcosystemExpansionVerdict =
  | 'EXPANSION_READY_FOR_SCALE'
  | 'EXPANSION_READY_WITH_AMBIGUITY'
  | 'EXPANSION_PARTIAL'
  | 'EXPANSION_FAIL_CLOSED';

export interface EcosystemExpansionResult {
  schema: 'vitalcv.ecosystem-expansion.v1';
  expansionId: string;
  ecosystemId: string;
  generatedAt: string;
  status: EcosystemExpansionStatus;
  verdict: EcosystemExpansionVerdict;
  failClosed: boolean;
  expansionScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: EcosystemExpansionLineage;
  replayPropagation: {
    replaySafe: boolean;
    propagationPct: number;
    traceCoveragePct: number;
    unsafeSignalIds: readonly string[];
  };
  onboarding: {
    lineageReconstructable: boolean;
    fidelityPct: number;
    participantOrgIds: readonly string[];
    rolesObserved: readonly EcosystemExpansionParticipantRole[];
  };
  survivability: {
    measurable: boolean;
    survivabilityPct: number;
  };
  growth: {
    longitudinallyVisible: boolean;
    growthPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  drift: {
    measurable: boolean;
    driftRiskPct: number;
    direction: 'LOW' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  expansionHash: string;
}

export type EcosystemExpansionGateId =
  | 'ecosystem_growth_replay_safe'
  | 'ambiguity_preserved_during_propagation'
  | 'onboarding_lineage_reconstructable'
  | 'fail_closed_expansion_semantics'
  | 'ecosystem_survivability_measurable'
  | 'institutional_growth_longitudinally_visible'
  | 'expansion_drift_measurable';

export interface EcosystemExpansionGate {
  id: EcosystemExpansionGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface EcosystemExpansionGateResult {
  schema: 'vitalcv.ecosystem-expansion-ci-gate.v1';
  pass: boolean;
  gates: readonly EcosystemExpansionGate[];
  failedGateIds: readonly EcosystemExpansionGateId[];
  gateHash: string;
}

export type EcosystemExpansionChaosScenarioName =
  | 'REPLAY_PROPAGATION_DROP'
  | 'AMBIGUITY_SUPPRESSION'
  | 'ONBOARDING_LINEAGE_GAP'
  | 'SURVIVABILITY_SIGNAL_LOSS'
  | 'GROWTH_LONGITUDINAL_COLLAPSE'
  | 'EXPANSION_DRIFT_SPIKE';

export interface EcosystemExpansionChaosScenarioResult {
  scenario: EcosystemExpansionChaosScenarioName;
  signalSurfaced: boolean;
  status: EcosystemExpansionStatus;
  failedGateIds: readonly EcosystemExpansionGateId[];
  surfacedSignals: readonly string[];
}

export interface EcosystemExpansionChaosReport {
  schema: 'vitalcv.ecosystem-expansion-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly EcosystemExpansionChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface EcosystemExpansionInput {
  expansionId: string;
  ecosystemId: string;
  generatedAt: string;
  signals: readonly EcosystemExpansionSignal[];
}

const SCHEMA_LINEAGE = 'vitalcv.ecosystem-expansion-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.ecosystem-expansion.v1' as const;
const SCHEMA_GATE = 'vitalcv.ecosystem-expansion-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.ecosystem-expansion-chaos.v1' as const;
const REQUIRED_ROLES: readonly EcosystemExpansionParticipantRole[] = Object.freeze([
  'CLINICIAN',
  'EMPLOYER',
  'ISSUER',
  'VERIFIER',
]);
const MIN_SIGNALS = 4;
const MIN_REPLAY_PROPAGATION_PCT = 75;
const MIN_ONBOARDING_FIDELITY_PCT = 75;
const MIN_SURVIVABILITY_PCT = 75;
const MIN_GROWTH_PCT = 75;
const MAX_DRIFT_RISK_PCT = 25;

export const ECOSYSTEM_EXPANSION_GATE_IDS: readonly EcosystemExpansionGateId[] = Object.freeze([
  'ecosystem_growth_replay_safe',
  'ambiguity_preserved_during_propagation',
  'onboarding_lineage_reconstructable',
  'fail_closed_expansion_semantics',
  'ecosystem_survivability_measurable',
  'institutional_growth_longitudinally_visible',
  'expansion_drift_measurable',
]);

export const ECOSYSTEM_EXPANSION_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedSignal {
  signalId: string;
  recordedAt: string;
  ecosystemId: string;
  institutionId: string;
  participantOrgId: string;
  participantRole: EcosystemExpansionParticipantRole;
  signalType: EcosystemExpansionSignalType;
  replaySafe: boolean;
  replayTraceId: string | null;
  replayTrustPropagation: number;
  onboardingFidelity: number;
  ecosystemSurvivability: number;
  institutionalGrowth: number;
  expansionDrift: number;
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

function normalizeSignals(signals: readonly EcosystemExpansionSignal[]): NormalizedSignal[] {
  return signals
    .map((signal, index) => ({
      signalId: requiredString(signal.signalId, `missing-signal-${index}`),
      recordedAt: requiredString(signal.recordedAt, '0000-00-00T00:00:00.000Z'),
      ecosystemId: requiredString(signal.ecosystemId, 'missing-ecosystem'),
      institutionId: requiredString(signal.institutionId, 'missing-institution'),
      participantOrgId: requiredString(signal.participantOrgId, 'missing-participant'),
      participantRole: signal.participantRole,
      signalType: signal.signalType,
      replaySafe: signal.replaySafe === true,
      replayTraceId: cleanString(signal.replayTraceId),
      replayTrustPropagation: clamp01(signal.replayTrustPropagation),
      onboardingFidelity: clamp01(signal.onboardingFidelity),
      ecosystemSurvivability: clamp01(signal.ecosystemSurvivability),
      institutionalGrowth: clamp01(signal.institutionalGrowth),
      expansionDrift: clamp01(signal.expansionDrift),
      evidenceRefs: cleanRefs(signal.evidenceRefs),
      lineageRefs: cleanRefs(signal.lineageRefs),
      ambiguity: cleanString(signal.ambiguity),
    }))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.signalId.localeCompare(right.signalId));
}

function rolesObserved(signals: readonly NormalizedSignal[]): EcosystemExpansionParticipantRole[] {
  const observed = new Set(signals.map(signal => signal.participantRole));
  return REQUIRED_ROLES.filter(role => observed.has(role));
}

function signalHash(signal: NormalizedSignal): string {
  return sha256ForPayload({
    signalId: signal.signalId,
    recordedAt: signal.recordedAt,
    ecosystemId: signal.ecosystemId,
    institutionId: signal.institutionId,
    participantOrgId: signal.participantOrgId,
    participantRole: signal.participantRole,
    signalType: signal.signalType,
    replaySafe: signal.replaySafe,
    replayTraceId: signal.replayTraceId,
    replayTrustPropagation: signal.replayTrustPropagation,
    onboardingFidelity: signal.onboardingFidelity,
    ecosystemSurvivability: signal.ecosystemSurvivability,
    institutionalGrowth: signal.institutionalGrowth,
    expansionDrift: signal.expansionDrift,
    evidenceRefs: signal.evidenceRefs,
    lineageRefs: signal.lineageRefs,
    ambiguity: signal.ambiguity,
  });
}

function buildLineageFromNormalized(input: {
  expansionId: string;
  ecosystemId: string;
  generatedAt: string;
  signals: readonly NormalizedSignal[];
}): EcosystemExpansionLineage {
  const timeline: EcosystemExpansionLineageEntry[] = input.signals.map((signal, index) => ({
    position: index + 1,
    signalId: signal.signalId,
    recordedAt: signal.recordedAt,
    institutionId: signal.institutionId,
    participantOrgId: signal.participantOrgId,
    participantRole: signal.participantRole,
    signalType: signal.signalType,
    replayTraceId: signal.replayTraceId,
    evidenceRefCount: signal.evidenceRefs.length,
    lineageRefCount: signal.lineageRefs.length,
    ambiguous: signal.ambiguity !== null,
    signalHash: signalHash(signal),
  }));
  const participantOrgIds = dedupeSorted(input.signals.map(signal => signal.participantOrgId));
  const observedRoles = rolesObserved(input.signals);
  const body = {
    schema: SCHEMA_LINEAGE,
    expansionId: input.expansionId,
    ecosystemId: input.ecosystemId,
    firstRecordedAt: timeline[0]?.recordedAt ?? null,
    lastRecordedAt: timeline[timeline.length - 1]?.recordedAt ?? null,
    participantOrgIds,
    rolesObserved: observedRoles,
    timeline: timeline.map(entry => ({
      position: entry.position,
      signalId: entry.signalId,
      recordedAt: entry.recordedAt,
      participantOrgId: entry.participantOrgId,
      participantRole: entry.participantRole,
      signalType: entry.signalType,
      signalHash: entry.signalHash,
    })),
  };

  return {
    ...body,
    timeline,
    lineageHash: sha256ForPayload(body),
    generatedAt: input.generatedAt,
  };
}

export function buildEcosystemExpansionLineage(input: EcosystemExpansionInput): EcosystemExpansionLineage {
  return buildLineageFromNormalized({
    ...input,
    signals: normalizeSignals(input.signals),
  });
}

function driftDirection(driftRiskPct: number): EcosystemExpansionResult['drift']['direction'] {
  if (driftRiskPct <= MAX_DRIFT_RISK_PCT) return 'LOW';
  if (driftRiskPct <= 50) return 'ELEVATED';
  return 'HIGH';
}

export function evaluateEcosystemExpansion(input: EcosystemExpansionInput): EcosystemExpansionResult {
  const signals = normalizeSignals(input.signals);
  const lineage = buildLineageFromNormalized({ ...input, signals });
  const total = signals.length;
  const traceCoveragePct = total > 0
    ? pct((signals.filter(signal => signal.replayTraceId !== null).length / total) * 100)
    : 0;
  const propagationPct = pct(average(signals.map(signal => signal.replayTrustPropagation)) * 100);
  const unsafeSignalIds = signals
    .filter(signal => !signal.replaySafe || signal.replayTraceId === null)
    .map(signal => signal.signalId);
  const replayPropagationEventPresent = signals.some(signal => signal.signalType === 'replay_trust_propagated');
  const replaySafe =
    total >= MIN_SIGNALS
      && unsafeSignalIds.length === 0
      && replayPropagationEventPresent
      && traceCoveragePct >= 85
      && propagationPct >= MIN_REPLAY_PROPAGATION_PCT;

  const participantOrgIds = lineage.participantOrgIds;
  const observedRoles = lineage.rolesObserved;
  const onboardingFidelityPct = pct(average(signals.map(signal => signal.onboardingFidelity)) * 100);
  const onboardingLineageReconstructable =
    total >= MIN_SIGNALS
      && observedRoles.length === REQUIRED_ROLES.length
      && participantOrgIds.length >= REQUIRED_ROLES.length
      && signals.every(signal => signal.evidenceRefs.length > 0)
      && signals.every(signal => signal.lineageRefs.length > 0)
      && onboardingFidelityPct >= MIN_ONBOARDING_FIDELITY_PCT;

  const survivabilityPct = pct(average(signals.map(signal => signal.ecosystemSurvivability)) * 100);
  const survivabilityMeasurable = total >= MIN_SIGNALS && survivabilityPct >= MIN_SURVIVABILITY_PCT;
  const growthPct = pct(average(signals.map(signal => signal.institutionalGrowth)) * 100);
  const uniqueRecordedAt = new Set(signals.map(signal => signal.recordedAt));
  const growthLongitudinallyVisible =
    total >= MIN_SIGNALS
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt
      && growthPct >= MIN_GROWTH_PCT;
  const driftRiskPct = pct(average(signals.map(signal => signal.expansionDrift)) * 100);
  const driftMeasurable = total >= MIN_SIGNALS && driftRiskPct <= MAX_DRIFT_RISK_PCT;
  const ambiguities = dedupeChronological(signals.map(signal => signal.ambiguity));
  const ambiguityPreserved = dedupeChronological(signals.map(signal => signal.ambiguity)).length === ambiguities.length;

  const blockers: string[] = [];
  if (!replaySafe) blockers.push('Ecosystem growth is not replay-safe.');
  if (!onboardingLineageReconstructable) blockers.push('Cross-org onboarding lineage is not reconstructable.');
  if (!survivabilityMeasurable) blockers.push('Ecosystem survivability is not measurable.');
  if (!growthLongitudinallyVisible) blockers.push('Institutional growth is not longitudinally visible.');
  if (!driftMeasurable) blockers.push('Expansion drift is not measurable below risk floor.');

  const failClosed = blockers.length > 0;
  const rawExpansionScore = pct(
    propagationPct * 0.26
      + onboardingFidelityPct * 0.22
      + survivabilityPct * 0.2
      + growthPct * 0.18
      + (100 - driftRiskPct) * 0.14,
  );
  const expansionScore = failClosed ? Math.min(rawExpansionScore, 49) : rawExpansionScore;
  const status: EcosystemExpansionStatus = failClosed
    ? 'EXPANSION_BLOCKED'
    : ambiguities.length > 0 || driftRiskPct > 10
      ? 'EXPANSION_DEGRADED'
      : 'EXPANSION_READY';
  const verdict: EcosystemExpansionVerdict = status === 'EXPANSION_BLOCKED'
    ? 'EXPANSION_FAIL_CLOSED'
    : status === 'EXPANSION_READY'
      ? 'EXPANSION_READY_FOR_SCALE'
      : ambiguities.length > 0
        ? 'EXPANSION_READY_WITH_AMBIGUITY'
        : 'EXPANSION_PARTIAL';
  const basis: string[] = [];
  if (replaySafe) basis.push('ecosystem_growth_replay_safe');
  if (ambiguityPreserved) basis.push('ambiguity_preserved_during_propagation');
  if (onboardingLineageReconstructable) basis.push('onboarding_lineage_reconstructable');
  if (!failClosed) basis.push('fail_closed_expansion_semantics');
  if (survivabilityMeasurable) basis.push('ecosystem_survivability_measurable');
  if (growthLongitudinallyVisible) basis.push('institutional_growth_longitudinally_visible');
  if (driftMeasurable) basis.push('expansion_drift_measurable');

  const body = {
    schema: SCHEMA_RESULT,
    expansionId: input.expansionId,
    ecosystemId: input.ecosystemId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    expansionScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayPropagation: {
      replaySafe,
      propagationPct,
      traceCoveragePct,
      unsafeSignalIds,
    },
    onboarding: {
      lineageReconstructable: onboardingLineageReconstructable,
      fidelityPct: onboardingFidelityPct,
      participantOrgIds,
      rolesObserved: observedRoles,
    },
    survivability: {
      measurable: survivabilityMeasurable,
      survivabilityPct,
    },
    growth: {
      longitudinallyVisible: growthLongitudinallyVisible,
      growthPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    drift: {
      measurable: driftMeasurable,
      driftRiskPct,
      direction: total === 0 ? 'UNKNOWN' as const : driftDirection(driftRiskPct),
    },
    confidence: {
      score: expansionScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    expansionHash: sha256ForPayload(body),
  };
}

export function evaluateEcosystemExpansionGate(
  result: EcosystemExpansionResult,
): EcosystemExpansionGateResult {
  const gates: EcosystemExpansionGate[] = [
    {
      id: 'ecosystem_growth_replay_safe',
      pass: result.replayPropagation.replaySafe,
      observed: result.replayPropagation.replaySafe,
      required: true,
    },
    {
      id: 'ambiguity_preserved_during_propagation',
      pass: result.ambiguityPreserved,
      observed: result.ambiguityPreserved,
      required: true,
    },
    {
      id: 'onboarding_lineage_reconstructable',
      pass: result.onboarding.lineageReconstructable,
      observed: result.onboarding.lineageReconstructable,
      required: true,
    },
    {
      id: 'fail_closed_expansion_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'ecosystem_survivability_measurable',
      pass: result.survivability.measurable,
      observed: result.survivability.measurable,
      required: true,
    },
    {
      id: 'institutional_growth_longitudinally_visible',
      pass: result.growth.longitudinallyVisible,
      observed: result.growth.longitudinallyVisible,
      required: true,
    },
    {
      id: 'expansion_drift_measurable',
      pass: result.drift.measurable,
      observed: result.drift.driftRiskPct,
      required: MAX_DRIFT_RISK_PCT,
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
  scenario: EcosystemExpansionChaosScenarioName,
  result: EcosystemExpansionResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): EcosystemExpansionChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateEcosystemExpansionGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runEcosystemExpansionChaosSimulations(
  input: EcosystemExpansionInput,
): EcosystemExpansionChaosReport {
  const baseline = evaluateEcosystemExpansion(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const replayDrop = evaluateEcosystemExpansion({
    ...input,
    signals: input.signals.map(signal => signal.signalType === 'replay_trust_propagated'
      ? { ...signal, replaySafe: false, replayTraceId: null, replayTrustPropagation: 0.2 }
      : signal),
  });
  const replayGate = evaluateEcosystemExpansionGate(replayDrop);

  const ambiguitySuppression = evaluateEcosystemExpansion({
    ...input,
    signals: input.signals.map(signal => ({ ...signal, ambiguity: null })),
  });

  const lineageGap = evaluateEcosystemExpansion({
    ...input,
    signals: input.signals.map(signal => signal.signalType === 'employer_onboarded'
      ? { ...signal, evidenceRefs: [], lineageRefs: [] }
      : signal),
  });
  const lineageGate = evaluateEcosystemExpansionGate(lineageGap);

  const survivabilityLoss = evaluateEcosystemExpansion({
    ...input,
    signals: input.signals.map(signal => ({ ...signal, ecosystemSurvivability: 0.1 })),
  });
  const survivabilityGate = evaluateEcosystemExpansionGate(survivabilityLoss);

  const growthCollapse = evaluateEcosystemExpansion({
    ...input,
    signals: input.signals.map(signal => ({
      ...signal,
      recordedAt: input.signals[0]?.recordedAt ?? input.generatedAt,
      institutionalGrowth: 0.2,
    })),
  });
  const growthGate = evaluateEcosystemExpansionGate(growthCollapse);

  const driftSpike = evaluateEcosystemExpansion({
    ...input,
    signals: input.signals.map(signal => ({ ...signal, expansionDrift: 0.9 })),
  });
  const driftGate = evaluateEcosystemExpansionGate(driftSpike);

  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;
  const scenarios: EcosystemExpansionChaosScenarioResult[] = [
    chaosScenario(
      'REPLAY_PROPAGATION_DROP',
      replayDrop,
      replayGate.failedGateIds.includes('ecosystem_growth_replay_safe'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed,
      ambiguitySuppressed ? ['ambiguity_preserved_during_propagation'] : [],
    ),
    chaosScenario(
      'ONBOARDING_LINEAGE_GAP',
      lineageGap,
      lineageGate.failedGateIds.includes('onboarding_lineage_reconstructable'),
      lineageGate.failedGateIds,
    ),
    chaosScenario(
      'SURVIVABILITY_SIGNAL_LOSS',
      survivabilityLoss,
      survivabilityGate.failedGateIds.includes('ecosystem_survivability_measurable'),
      survivabilityGate.failedGateIds,
    ),
    chaosScenario(
      'GROWTH_LONGITUDINAL_COLLAPSE',
      growthCollapse,
      growthGate.failedGateIds.includes('institutional_growth_longitudinally_visible'),
      growthGate.failedGateIds,
    ),
    chaosScenario(
      'EXPANSION_DRIFT_SPIKE',
      driftSpike,
      driftGate.failedGateIds.includes('expansion_drift_measurable'),
      driftGate.failedGateIds,
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
