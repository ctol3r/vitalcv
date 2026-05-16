/**
 * ecosystemTrustBootstrap.ts - W2-PR135A
 *
 * Pure trust bootstrap evaluator for initial ecosystem activation. It consumes
 * supplied bootstrap telemetry and evaluates replay-aware onboarding,
 * institutional trust seeding, activation visibility, cross-org survivability,
 * and longitudinal ecosystem trust.
 *
 * No fetches, no DB writes, no invitation sends, no live onboarding side
 * effects. Runtime surfaces can call this boundary checker later.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type EcosystemTrustBootstrapParticipantRole =
  | 'ANCHOR_INSTITUTION'
  | 'ISSUER'
  | 'VERIFIER'
  | 'EMPLOYER'
  | 'CLINICIAN';

export type EcosystemTrustBootstrapSignalType =
  | 'anchor_seed_created'
  | 'issuer_invited'
  | 'verifier_onboarded'
  | 'employer_seeded'
  | 'clinician_cohort_seeded'
  | 'bootstrap_activation_observed';

export interface EcosystemTrustBootstrapSignal {
  signalId: string;
  recordedAt: string;
  ecosystemId: string;
  institutionId: string;
  participantOrgId: string;
  participantRole: EcosystemTrustBootstrapParticipantRole;
  signalType: EcosystemTrustBootstrapSignalType;
  replaySafe: boolean;
  replayTraceId: string | null;
  replayOnboardingFidelity: number;
  trustSeedStrength: number;
  activationVisibility: number;
  crossOrgSurvivability: number;
  ecosystemTrust: number;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  ambiguity: string | null;
}

export interface EcosystemTrustBootstrapLineageEntry {
  position: number;
  signalId: string;
  recordedAt: string;
  institutionId: string;
  participantOrgId: string;
  participantRole: EcosystemTrustBootstrapParticipantRole;
  signalType: EcosystemTrustBootstrapSignalType;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  ambiguous: boolean;
  signalHash: string;
}

export interface EcosystemTrustBootstrapLineage {
  schema: 'vitalcv.ecosystem-trust-bootstrap-lineage.v1';
  bootstrapId: string;
  ecosystemId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  participantOrgIds: readonly string[];
  rolesObserved: readonly EcosystemTrustBootstrapParticipantRole[];
  timeline: readonly EcosystemTrustBootstrapLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export type EcosystemTrustBootstrapStatus =
  | 'BOOTSTRAP_READY'
  | 'BOOTSTRAP_DEGRADED'
  | 'BOOTSTRAP_BLOCKED';

export type EcosystemTrustBootstrapVerdict =
  | 'BOOTSTRAP_ACTIVATED'
  | 'BOOTSTRAP_READY_WITH_AMBIGUITY'
  | 'BOOTSTRAP_PARTIAL'
  | 'BOOTSTRAP_FAIL_CLOSED';

export interface EcosystemTrustBootstrapResult {
  schema: 'vitalcv.ecosystem-trust-bootstrap.v1';
  bootstrapId: string;
  ecosystemId: string;
  generatedAt: string;
  status: EcosystemTrustBootstrapStatus;
  verdict: EcosystemTrustBootstrapVerdict;
  failClosed: boolean;
  bootstrapScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: EcosystemTrustBootstrapLineage;
  replayOnboarding: {
    replaySafe: boolean;
    fidelityPct: number;
    traceCoveragePct: number;
    unsafeSignalIds: readonly string[];
  };
  onboarding: {
    lineageReconstructable: boolean;
    participantOrgIds: readonly string[];
    rolesObserved: readonly EcosystemTrustBootstrapParticipantRole[];
  };
  trustSeeding: {
    measurable: boolean;
    seedStrengthPct: number;
  };
  activation: {
    visible: boolean;
    visibilityPct: number;
  };
  ecosystemTrust: {
    longitudinallyVisible: boolean;
    trustPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  survivability: {
    measurable: boolean;
    survivabilityPct: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  bootstrapHash: string;
}

export type EcosystemTrustBootstrapGateId =
  | 'bootstrap_replay_safe'
  | 'ambiguity_preserved_cross_org'
  | 'onboarding_lineage_reconstructable'
  | 'fail_closed_activation_semantics'
  | 'ecosystem_trust_longitudinally_visible'
  | 'institutional_seeding_measurable'
  | 'cross_org_survivability_measurable';

export interface EcosystemTrustBootstrapGate {
  id: EcosystemTrustBootstrapGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface EcosystemTrustBootstrapGateResult {
  schema: 'vitalcv.ecosystem-trust-bootstrap-ci-gate.v1';
  pass: boolean;
  gates: readonly EcosystemTrustBootstrapGate[];
  failedGateIds: readonly EcosystemTrustBootstrapGateId[];
  gateHash: string;
}

export type EcosystemTrustBootstrapChaosScenarioName =
  | 'REPLAY_ONBOARDING_DROP'
  | 'AMBIGUITY_SUPPRESSION'
  | 'ONBOARDING_LINEAGE_GAP'
  | 'TRUST_SEEDING_LOSS'
  | 'ACTIVATION_VISIBILITY_COLLAPSE'
  | 'ECOSYSTEM_TRUST_LONGITUDINAL_COLLAPSE'
  | 'CROSS_ORG_SURVIVABILITY_LOSS';

export interface EcosystemTrustBootstrapChaosScenarioResult {
  scenario: EcosystemTrustBootstrapChaosScenarioName;
  signalSurfaced: boolean;
  status: EcosystemTrustBootstrapStatus;
  failedGateIds: readonly EcosystemTrustBootstrapGateId[];
  surfacedSignals: readonly string[];
}

export interface EcosystemTrustBootstrapChaosReport {
  schema: 'vitalcv.ecosystem-trust-bootstrap-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly EcosystemTrustBootstrapChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface EcosystemTrustBootstrapInput {
  bootstrapId: string;
  ecosystemId: string;
  generatedAt: string;
  signals: readonly EcosystemTrustBootstrapSignal[];
}

const SCHEMA_LINEAGE = 'vitalcv.ecosystem-trust-bootstrap-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.ecosystem-trust-bootstrap.v1' as const;
const SCHEMA_GATE = 'vitalcv.ecosystem-trust-bootstrap-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.ecosystem-trust-bootstrap-chaos.v1' as const;
const REQUIRED_ROLES: readonly EcosystemTrustBootstrapParticipantRole[] = Object.freeze([
  'ANCHOR_INSTITUTION',
  'CLINICIAN',
  'EMPLOYER',
  'ISSUER',
  'VERIFIER',
]);
const MIN_SIGNALS = 5;
const MIN_REPLAY_ONBOARDING_PCT = 75;
const MIN_SEED_STRENGTH_PCT = 75;
const MIN_ACTIVATION_VISIBILITY_PCT = 75;
const MIN_SURVIVABILITY_PCT = 75;
const MIN_ECOSYSTEM_TRUST_PCT = 75;

export const ECOSYSTEM_TRUST_BOOTSTRAP_GATE_IDS: readonly EcosystemTrustBootstrapGateId[] = Object.freeze([
  'bootstrap_replay_safe',
  'ambiguity_preserved_cross_org',
  'onboarding_lineage_reconstructable',
  'fail_closed_activation_semantics',
  'ecosystem_trust_longitudinally_visible',
  'institutional_seeding_measurable',
  'cross_org_survivability_measurable',
]);

export const ECOSYSTEM_TRUST_BOOTSTRAP_SENTINELS = Object.freeze({
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
  participantRole: EcosystemTrustBootstrapParticipantRole;
  signalType: EcosystemTrustBootstrapSignalType;
  replaySafe: boolean;
  replayTraceId: string | null;
  replayOnboardingFidelity: number;
  trustSeedStrength: number;
  activationVisibility: number;
  crossOrgSurvivability: number;
  ecosystemTrust: number;
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

function normalizeSignals(signals: readonly EcosystemTrustBootstrapSignal[]): NormalizedSignal[] {
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
      replayOnboardingFidelity: clamp01(signal.replayOnboardingFidelity),
      trustSeedStrength: clamp01(signal.trustSeedStrength),
      activationVisibility: clamp01(signal.activationVisibility),
      crossOrgSurvivability: clamp01(signal.crossOrgSurvivability),
      ecosystemTrust: clamp01(signal.ecosystemTrust),
      evidenceRefs: cleanRefs(signal.evidenceRefs),
      lineageRefs: cleanRefs(signal.lineageRefs),
      ambiguity: cleanString(signal.ambiguity),
    }))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.signalId.localeCompare(right.signalId));
}

function rolesObserved(signals: readonly NormalizedSignal[]): EcosystemTrustBootstrapParticipantRole[] {
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
    replayOnboardingFidelity: signal.replayOnboardingFidelity,
    trustSeedStrength: signal.trustSeedStrength,
    activationVisibility: signal.activationVisibility,
    crossOrgSurvivability: signal.crossOrgSurvivability,
    ecosystemTrust: signal.ecosystemTrust,
    evidenceRefs: signal.evidenceRefs,
    lineageRefs: signal.lineageRefs,
    ambiguity: signal.ambiguity,
  });
}

function buildLineageFromNormalized(input: {
  bootstrapId: string;
  ecosystemId: string;
  generatedAt: string;
  signals: readonly NormalizedSignal[];
}): EcosystemTrustBootstrapLineage {
  const timeline: EcosystemTrustBootstrapLineageEntry[] = input.signals.map((signal, index) => ({
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
    bootstrapId: input.bootstrapId,
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

export function buildEcosystemTrustBootstrapLineage(
  input: EcosystemTrustBootstrapInput,
): EcosystemTrustBootstrapLineage {
  return buildLineageFromNormalized({
    ...input,
    signals: normalizeSignals(input.signals),
  });
}

export function evaluateEcosystemTrustBootstrap(
  input: EcosystemTrustBootstrapInput,
): EcosystemTrustBootstrapResult {
  const signals = normalizeSignals(input.signals);
  const lineage = buildLineageFromNormalized({ ...input, signals });
  const total = signals.length;
  const traceCoveragePct = total > 0
    ? pct((signals.filter(signal => signal.replayTraceId !== null).length / total) * 100)
    : 0;
  const fidelityPct = pct(average(signals.map(signal => signal.replayOnboardingFidelity)) * 100);
  const unsafeSignalIds = signals
    .filter(signal => !signal.replaySafe || signal.replayTraceId === null)
    .map(signal => signal.signalId);
  const activationObserved = signals.some(signal => signal.signalType === 'bootstrap_activation_observed');
  const replaySafe =
    total >= MIN_SIGNALS
      && unsafeSignalIds.length === 0
      && traceCoveragePct >= 85
      && fidelityPct >= MIN_REPLAY_ONBOARDING_PCT;
  const participantOrgIds = lineage.participantOrgIds;
  const observedRoles = lineage.rolesObserved;
  const lineageReconstructable =
    total >= MIN_SIGNALS
      && observedRoles.length === REQUIRED_ROLES.length
      && participantOrgIds.length >= REQUIRED_ROLES.length
      && signals.every(signal => signal.evidenceRefs.length > 0)
      && signals.every(signal => signal.lineageRefs.length > 0);
  const seedStrengthPct = pct(average(signals.map(signal => signal.trustSeedStrength)) * 100);
  const seedTypesPresent =
    signals.some(signal => signal.signalType === 'anchor_seed_created')
      && signals.some(signal => signal.signalType === 'issuer_invited')
      && signals.some(signal => signal.signalType === 'employer_seeded')
      && signals.some(signal => signal.signalType === 'clinician_cohort_seeded');
  const seedingMeasurable = seedTypesPresent && seedStrengthPct >= MIN_SEED_STRENGTH_PCT;
  const activationVisibilityPct = pct(average(signals.map(signal => signal.activationVisibility)) * 100);
  const activationVisible = activationObserved && activationVisibilityPct >= MIN_ACTIVATION_VISIBILITY_PCT;
  const survivabilityPct = pct(average(signals.map(signal => signal.crossOrgSurvivability)) * 100);
  const survivabilityMeasurable = total >= MIN_SIGNALS && survivabilityPct >= MIN_SURVIVABILITY_PCT;
  const ecosystemTrustPct = pct(average(signals.map(signal => signal.ecosystemTrust)) * 100);
  const uniqueRecordedAt = new Set(signals.map(signal => signal.recordedAt));
  const ecosystemTrustLongitudinallyVisible =
    total >= MIN_SIGNALS
      && uniqueRecordedAt.size >= 3
      && lineage.firstRecordedAt !== null
      && lineage.lastRecordedAt !== null
      && lineage.firstRecordedAt !== lineage.lastRecordedAt
      && ecosystemTrustPct >= MIN_ECOSYSTEM_TRUST_PCT;
  const ambiguities = dedupeChronological(signals.map(signal => signal.ambiguity));
  const ambiguityPreserved = dedupeChronological(signals.map(signal => signal.ambiguity)).length === ambiguities.length;

  const blockers: string[] = [];
  if (!replaySafe) blockers.push('Bootstrap replay onboarding is not safe.');
  if (!lineageReconstructable) blockers.push('Onboarding lineage is not reconstructable.');
  if (!seedingMeasurable) blockers.push('Institutional trust seeding is not measurable.');
  if (!activationVisible) blockers.push('Ecosystem activation is not visible.');
  if (!ecosystemTrustLongitudinallyVisible) blockers.push('Ecosystem trust is not longitudinally visible.');
  if (!survivabilityMeasurable) blockers.push('Cross-org survivability is not measurable.');

  const failClosed = blockers.length > 0;
  const rawBootstrapScore = pct(
    fidelityPct * 0.24
      + seedStrengthPct * 0.22
      + activationVisibilityPct * 0.2
      + survivabilityPct * 0.18
      + ecosystemTrustPct * 0.16,
  );
  const bootstrapScore = failClosed ? Math.min(rawBootstrapScore, 49) : rawBootstrapScore;
  const status: EcosystemTrustBootstrapStatus = failClosed
    ? 'BOOTSTRAP_BLOCKED'
    : ambiguities.length > 0 || bootstrapScore < 90
      ? 'BOOTSTRAP_DEGRADED'
      : 'BOOTSTRAP_READY';
  const verdict: EcosystemTrustBootstrapVerdict = status === 'BOOTSTRAP_BLOCKED'
    ? 'BOOTSTRAP_FAIL_CLOSED'
    : status === 'BOOTSTRAP_READY'
      ? 'BOOTSTRAP_ACTIVATED'
      : ambiguities.length > 0
        ? 'BOOTSTRAP_READY_WITH_AMBIGUITY'
        : 'BOOTSTRAP_PARTIAL';
  const basis: string[] = [];
  if (replaySafe) basis.push('bootstrap_replay_safe');
  if (ambiguityPreserved) basis.push('ambiguity_preserved_cross_org');
  if (lineageReconstructable) basis.push('onboarding_lineage_reconstructable');
  if (!failClosed) basis.push('fail_closed_activation_semantics');
  if (ecosystemTrustLongitudinallyVisible) basis.push('ecosystem_trust_longitudinally_visible');
  if (seedingMeasurable) basis.push('institutional_seeding_measurable');
  if (survivabilityMeasurable) basis.push('cross_org_survivability_measurable');
  if (activationVisible) basis.push('ecosystem_activation_visible');

  const body = {
    schema: SCHEMA_RESULT,
    bootstrapId: input.bootstrapId,
    ecosystemId: input.ecosystemId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    bootstrapScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayOnboarding: {
      replaySafe,
      fidelityPct,
      traceCoveragePct,
      unsafeSignalIds,
    },
    onboarding: {
      lineageReconstructable,
      participantOrgIds,
      rolesObserved: observedRoles,
    },
    trustSeeding: {
      measurable: seedingMeasurable,
      seedStrengthPct,
    },
    activation: {
      visible: activationVisible,
      visibilityPct: activationVisibilityPct,
    },
    ecosystemTrust: {
      longitudinallyVisible: ecosystemTrustLongitudinallyVisible,
      trustPct: ecosystemTrustPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    survivability: {
      measurable: survivabilityMeasurable,
      survivabilityPct,
    },
    confidence: {
      score: bootstrapScore,
      basis,
    },
  };

  return {
    ...body,
    lineage,
    bootstrapHash: sha256ForPayload(body),
  };
}

export function evaluateEcosystemTrustBootstrapGate(
  result: EcosystemTrustBootstrapResult,
): EcosystemTrustBootstrapGateResult {
  const gates: EcosystemTrustBootstrapGate[] = [
    {
      id: 'bootstrap_replay_safe',
      pass: result.replayOnboarding.replaySafe,
      observed: result.replayOnboarding.replaySafe,
      required: true,
    },
    {
      id: 'ambiguity_preserved_cross_org',
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
      id: 'fail_closed_activation_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'ecosystem_trust_longitudinally_visible',
      pass: result.ecosystemTrust.longitudinallyVisible,
      observed: result.ecosystemTrust.longitudinallyVisible,
      required: true,
    },
    {
      id: 'institutional_seeding_measurable',
      pass: result.trustSeeding.measurable,
      observed: result.trustSeeding.measurable,
      required: true,
    },
    {
      id: 'cross_org_survivability_measurable',
      pass: result.survivability.measurable,
      observed: result.survivability.measurable,
      required: true,
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
  scenario: EcosystemTrustBootstrapChaosScenarioName,
  result: EcosystemTrustBootstrapResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): EcosystemTrustBootstrapChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateEcosystemTrustBootstrapGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runEcosystemTrustBootstrapChaosSimulations(
  input: EcosystemTrustBootstrapInput,
): EcosystemTrustBootstrapChaosReport {
  const baseline = evaluateEcosystemTrustBootstrap(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const replayDrop = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => signal.signalType === 'verifier_onboarded'
      ? { ...signal, replaySafe: false, replayTraceId: null, replayOnboardingFidelity: 0.2 }
      : signal),
  });
  const replayGate = evaluateEcosystemTrustBootstrapGate(replayDrop);

  const ambiguitySuppression = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => ({ ...signal, ambiguity: null })),
  });

  const lineageGap = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => signal.signalType === 'employer_seeded'
      ? { ...signal, evidenceRefs: [], lineageRefs: [] }
      : signal),
  });
  const lineageGate = evaluateEcosystemTrustBootstrapGate(lineageGap);

  const seedingLoss = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => ({
      ...signal,
      trustSeedStrength: 0.1,
    })),
  });
  const seedingGate = evaluateEcosystemTrustBootstrapGate(seedingLoss);

  const activationCollapse = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => signal.signalType === 'bootstrap_activation_observed'
      ? { ...signal, activationVisibility: 0.1, signalType: 'verifier_onboarded' as const }
      : { ...signal, activationVisibility: 0.1 }),
  });
  const activationGate = evaluateEcosystemTrustBootstrapGate(activationCollapse);

  const trustCollapse = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => ({
      ...signal,
      recordedAt: input.signals[0]?.recordedAt ?? input.generatedAt,
      ecosystemTrust: 0.1,
    })),
  });
  const trustGate = evaluateEcosystemTrustBootstrapGate(trustCollapse);

  const survivabilityLoss = evaluateEcosystemTrustBootstrap({
    ...input,
    signals: input.signals.map(signal => ({
      ...signal,
      crossOrgSurvivability: 0.1,
    })),
  });
  const survivabilityGate = evaluateEcosystemTrustBootstrapGate(survivabilityLoss);

  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;
  const scenarios: EcosystemTrustBootstrapChaosScenarioResult[] = [
    chaosScenario(
      'REPLAY_ONBOARDING_DROP',
      replayDrop,
      replayGate.failedGateIds.includes('bootstrap_replay_safe'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed,
      ambiguitySuppressed ? ['ambiguity_preserved_cross_org'] : [],
    ),
    chaosScenario(
      'ONBOARDING_LINEAGE_GAP',
      lineageGap,
      lineageGate.failedGateIds.includes('onboarding_lineage_reconstructable'),
      lineageGate.failedGateIds,
    ),
    chaosScenario(
      'TRUST_SEEDING_LOSS',
      seedingLoss,
      seedingGate.failedGateIds.includes('institutional_seeding_measurable'),
      seedingGate.failedGateIds,
    ),
    chaosScenario(
      'ACTIVATION_VISIBILITY_COLLAPSE',
      activationCollapse,
      activationGate.failedGateIds.includes('fail_closed_activation_semantics'),
      activationGate.failedGateIds,
    ),
    chaosScenario(
      'ECOSYSTEM_TRUST_LONGITUDINAL_COLLAPSE',
      trustCollapse,
      trustGate.failedGateIds.includes('ecosystem_trust_longitudinally_visible'),
      trustGate.failedGateIds,
    ),
    chaosScenario(
      'CROSS_ORG_SURVIVABILITY_LOSS',
      survivabilityLoss,
      survivabilityGate.failedGateIds.includes('cross_org_survivability_measurable'),
      survivabilityGate.failedGateIds,
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
