import { sha256ForPayload } from '../../utils/deterministic';

export type PmfVerificationSignalType =
  | 'deployment_readiness'
  | 'replay_friction'
  | 'adoption_survivability'
  | 'pmf_evidence';

export interface PmfVerificationSignal {
  id: string;
  recordedAt: string;
  institutionId: string;
  verifierId: string;
  signalType: PmfVerificationSignalType;
  institutionalReadiness: number;
  replayFriction: number;
  adoptionSurvivability: number;
  deploymentReadiness: number;
  pmfEvidenceStrength: number;
  evidenceRefs: string[];
  ambiguity: string | null;
}

export interface PmfVerificationLineageEntry {
  position: number;
  signalId: string;
  recordedAt: string;
  institutionId: string;
  verifierId: string;
  signalType: PmfVerificationSignalType;
  institutionalReadiness: number;
  replayFriction: number;
  adoptionSurvivability: number;
  deploymentReadiness: number;
  pmfEvidenceStrength: number;
  evidenceRefs: string[];
  ambiguity: string | null;
  signalHash: string;
}

export interface PmfVerificationLineage {
  schema: 'vitalcv.pmf-verification-lineage.v1';
  verificationId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  timeline: PmfVerificationLineageEntry[];
  lineageHash: string;
}

export interface BuildPmfVerificationLineageInput {
  verificationId: string;
  signals: PmfVerificationSignal[];
}

export type PmfVerificationStatus = 'PMF_VERIFIED' | 'PMF_BLOCKED';
export type PmfVerificationVerdict =
  | 'PMF_READY'
  | 'PMF_PARTIAL'
  | 'PMF_NOT_READY'
  | 'PMF_BLOCKED';

export type PmfReplayFrictionTrend =
  | 'IMPROVING'
  | 'REGRESSING'
  | 'STABLE'
  | 'UNKNOWN';

export interface PmfReadinessScore {
  score: number;
  longitudinallyVisible: boolean;
  evidenceRefs: string[];
}

export interface PmfReplayFrictionValidation {
  score: number;
  trend: PmfReplayFrictionTrend;
  measurable: boolean;
  evidenceRefs: string[];
}

export interface PmfAdoptionSurvivabilityAnalytics {
  score: number;
  evidenceRefs: string[];
}

export interface PmfEvidenceSynthesis {
  score: number;
  evidenceDerived: boolean;
  evidenceRefs: string[];
}

export interface PmfVerificationConfidence {
  score: number;
  label: 'HIGH_EVIDENCE' | 'PARTIAL_EVIDENCE' | 'BLOCKED';
  basis: string[];
  confidenceHash: string;
}

export interface InstitutionalPmfVerification {
  schema: 'vitalcv.institutional-pmf-verification.v1';
  verificationId: string;
  institutionId: string;
  verifierId: string;
  verifiedAt: string;
  status: PmfVerificationStatus;
  verdict: PmfVerificationVerdict;
  pmfScore: number;
  failClosed: boolean;
  blockers: string[];
  ambiguities: string[];
  ambiguityPreserved: boolean;
  lineage: PmfVerificationLineage;
  institutionalReadiness: PmfReadinessScore;
  replayFriction: PmfReplayFrictionValidation;
  adoptionSurvivability: PmfAdoptionSurvivabilityAnalytics;
  evidenceSynthesis: PmfEvidenceSynthesis;
  confidence: PmfVerificationConfidence;
  verificationHash: string;
}

export interface VerifyInstitutionalPmfInput {
  verificationId: string;
  institutionId: string;
  verifierId: string;
  verifiedAt: string;
  signals: PmfVerificationSignal[];
}

export type PmfVerificationGateId =
  | 'pmf_claims_evidence_derived'
  | 'replay_friction_measurable'
  | 'ambiguity_preserved_in_scoring'
  | 'fail_closed_pmf_semantics'
  | 'adoption_readiness_longitudinally_visible'
  | 'pmf_lineage_reconstructable'
  | 'pmf_confidence_evidence_derived';

export interface PmfVerificationGate {
  id: PmfVerificationGateId;
  pass: boolean;
  reason: string;
}

export interface PmfVerificationGateVerdict {
  pass: boolean;
  gates: PmfVerificationGate[];
  failedGateIds: PmfVerificationGateId[];
}

export type PmfVerificationChaosScenario =
  | 'BASELINE'
  | 'REPLAY_FRICTION_REGRESSION'
  | 'READINESS_COLLAPSE'
  | 'ADOPTION_SURVIVABILITY_LOSS'
  | 'EVIDENCE_GAP'
  | 'AMBIGUITY_SUPPRESSION';

export interface PmfVerificationChaosVerdict {
  scenario: PmfVerificationChaosScenario;
  signalSurfaced: boolean;
  status: PmfVerificationStatus;
  verdict: PmfVerificationVerdict;
  failedGateIds: PmfVerificationGateId[];
}

export interface PmfVerificationChaosResult {
  verdicts: PmfVerificationChaosVerdict[];
  summary: {
    totalScenarios: number;
    surfacedCount: number;
    silentCount: number;
  };
}

export interface RunPmfVerificationChaosInput {
  verificationId: string;
  institutionId: string;
  verifierId: string;
  verifiedAt: string;
  baselineSignals: PmfVerificationSignal[];
}

const MIN_LINEAGE_SIGNALS = 3;
const MIN_EVIDENCE_REFS_PER_SIGNAL = 1;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function roundScore(value: number): number {
  return Math.round(value);
}

function cleanRefs(refs: readonly string[]): string[] {
  return Array.from(
    new Set(
      refs
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function cleanAmbiguities(signals: readonly PmfVerificationSignal[]): string[] {
  return Array.from(
    new Set(
      signals
        .map((signal) => signal.ambiguity?.trim() ?? '')
        .filter((ambiguity) => ambiguity.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function allEvidenceRefs(entries: readonly PmfVerificationLineageEntry[]): string[] {
  return cleanRefs(entries.flatMap((entry) => entry.evidenceRefs));
}

function evidenceFor(
  entries: readonly PmfVerificationLineageEntry[],
  signalType: PmfVerificationSignalType,
): string[] {
  const refs = allEvidenceRefs(entries.filter((entry) => entry.signalType === signalType));
  return refs.length > 0 ? refs : allEvidenceRefs(entries);
}

export function buildPmfVerificationLineage(
  input: BuildPmfVerificationLineageInput,
): PmfVerificationLineage {
  const timeline = [...input.signals]
    .sort((left, right) => (
      Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
      || left.id.localeCompare(right.id)
    ))
    .map((signal, position): PmfVerificationLineageEntry => {
      const body = {
        signalId: signal.id,
        recordedAt: signal.recordedAt,
        institutionId: signal.institutionId,
        verifierId: signal.verifierId,
        signalType: signal.signalType,
        institutionalReadiness: clamp01(signal.institutionalReadiness),
        replayFriction: clamp01(signal.replayFriction),
        adoptionSurvivability: clamp01(signal.adoptionSurvivability),
        deploymentReadiness: clamp01(signal.deploymentReadiness),
        pmfEvidenceStrength: clamp01(signal.pmfEvidenceStrength),
        evidenceRefs: cleanRefs(signal.evidenceRefs),
        ambiguity: signal.ambiguity?.trim() || null,
      };

      return {
        position,
        ...body,
        signalHash: sha256ForPayload(body),
      };
    });
  const body = {
    schema: 'vitalcv.pmf-verification-lineage.v1' as const,
    verificationId: input.verificationId,
    firstRecordedAt: timeline[0]?.recordedAt ?? null,
    lastRecordedAt: timeline[timeline.length - 1]?.recordedAt ?? null,
    timeline,
  };

  return {
    ...body,
    lineageHash: sha256ForPayload(body),
  };
}

function lineageReconstructable(lineage: PmfVerificationLineage): boolean {
  return (
    lineage.timeline.length >= MIN_LINEAGE_SIGNALS
    && Boolean(lineage.firstRecordedAt)
    && Boolean(lineage.lastRecordedAt)
    && lineage.timeline.every((entry) => entry.evidenceRefs.length >= MIN_EVIDENCE_REFS_PER_SIGNAL)
  );
}

function replayFrictionTrend(entries: readonly PmfVerificationLineageEntry[]): PmfReplayFrictionTrend {
  if (entries.length < 2) return 'UNKNOWN';
  const start = entries[0]?.replayFriction ?? 0;
  const end = entries[entries.length - 1]?.replayFriction ?? 0;
  const delta = end - start;

  if (delta <= -0.05) return 'IMPROVING';
  if (delta >= 0.05) return 'REGRESSING';
  return 'STABLE';
}

function buildReadiness(lineage: PmfVerificationLineage): PmfReadinessScore {
  const entries = lineage.timeline;
  return {
    score: roundScore(average(entries.map((entry) => entry.institutionalReadiness)) * 100),
    longitudinallyVisible: lineageReconstructable(lineage),
    evidenceRefs: evidenceFor(entries, 'deployment_readiness'),
  };
}

function buildReplayFriction(lineage: PmfVerificationLineage): PmfReplayFrictionValidation {
  const entries = lineage.timeline;
  return {
    score: roundScore(average(entries.map((entry) => entry.replayFriction)) * 100),
    trend: replayFrictionTrend(entries),
    measurable:
      lineage.timeline.length >= MIN_LINEAGE_SIGNALS
      && lineage.timeline.every((entry) => Number.isFinite(entry.replayFriction))
      && lineage.timeline.every((entry) => entry.evidenceRefs.length >= MIN_EVIDENCE_REFS_PER_SIGNAL),
    evidenceRefs: evidenceFor(entries, 'replay_friction'),
  };
}

function buildAdoptionSurvivability(lineage: PmfVerificationLineage): PmfAdoptionSurvivabilityAnalytics {
  return {
    score: roundScore(average(lineage.timeline.map((entry) => entry.adoptionSurvivability)) * 100),
    evidenceRefs: evidenceFor(lineage.timeline, 'adoption_survivability'),
  };
}

function buildEvidenceSynthesis(lineage: PmfVerificationLineage): PmfEvidenceSynthesis {
  const evidenceRefs = allEvidenceRefs(lineage.timeline);
  const signalTypes = new Set(lineage.timeline.map((entry) => entry.signalType));
  return {
    score: roundScore(average(lineage.timeline.map((entry) => entry.pmfEvidenceStrength)) * 100),
    evidenceDerived:
      lineageReconstructable(lineage)
      && signalTypes.has('pmf_evidence')
      && evidenceRefs.length > 0,
    evidenceRefs,
  };
}

function computePmfScore(input: {
  institutionalReadiness: PmfReadinessScore;
  replayFriction: PmfReplayFrictionValidation;
  adoptionSurvivability: PmfAdoptionSurvivabilityAnalytics;
  evidenceSynthesis: PmfEvidenceSynthesis;
  lineage: PmfVerificationLineage;
}): number {
  const deploymentReadiness = roundScore(
    average(input.lineage.timeline.map((entry) => entry.deploymentReadiness)) * 100,
  );
  const replayEfficiency = 100 - input.replayFriction.score;

  return roundScore(
    input.institutionalReadiness.score * 0.25
    + replayEfficiency * 0.2
    + input.adoptionSurvivability.score * 0.2
    + deploymentReadiness * 0.2
    + input.evidenceSynthesis.score * 0.15,
  );
}

function verdictFor(input: {
  status: PmfVerificationStatus;
  pmfScore: number;
  adoptionSurvivability: PmfAdoptionSurvivabilityAnalytics;
  institutionalReadiness: PmfReadinessScore;
}): PmfVerificationVerdict {
  if (input.status === 'PMF_BLOCKED') return 'PMF_BLOCKED';
  if (
    input.pmfScore >= 80
    && input.adoptionSurvivability.score >= 70
    && input.institutionalReadiness.score >= 75
  ) {
    return 'PMF_READY';
  }
  if (input.pmfScore >= 60) return 'PMF_PARTIAL';
  return 'PMF_NOT_READY';
}

function buildBlockers(input: {
  lineage: PmfVerificationLineage;
  replayFriction: PmfReplayFrictionValidation;
  evidenceSynthesis: PmfEvidenceSynthesis;
}): string[] {
  const blockers: string[] = [];

  if (!lineageReconstructable(input.lineage)) {
    blockers.push('PMF lineage is not reconstructable.');
  }

  if (!input.replayFriction.measurable) {
    blockers.push('Replay friction is not longitudinally measurable.');
  }

  if (!input.evidenceSynthesis.evidenceDerived) {
    blockers.push('PMF evidence synthesis is not evidence-derived.');
  }

  return blockers;
}

function buildConfidence(input: {
  lineage: PmfVerificationLineage;
  replayFriction: PmfReplayFrictionValidation;
  institutionalReadiness: PmfReadinessScore;
  adoptionSurvivability: PmfAdoptionSurvivabilityAnalytics;
  evidenceSynthesis: PmfEvidenceSynthesis;
  ambiguityCount: number;
  status: PmfVerificationStatus;
}): PmfVerificationConfidence {
  const basis: string[] = [];
  let score = 10;

  if (lineageReconstructable(input.lineage)) {
    score += 20;
    basis.push('pmf_lineage_reconstructable');
  }

  if (input.replayFriction.measurable) {
    score += 20;
    basis.push('replay_friction_measurable');
  }

  if (input.institutionalReadiness.score >= 75) {
    score += 15;
    basis.push('deployment_readiness_evidenced');
  }

  if (input.adoptionSurvivability.score >= 70) {
    score += 15;
    basis.push('adoption_survivability_evidenced');
  }

  if (input.evidenceSynthesis.evidenceDerived) {
    score += 20;
    basis.push('pmf_evidence_synthesized');
  }

  if (input.ambiguityCount > 0) {
    score += 5;
    basis.push('ambiguity_preserved_in_scoring');
  }

  score = Math.max(0, Math.min(100, score - input.ambiguityCount * 2));

  const label: PmfVerificationConfidence['label'] = input.status === 'PMF_BLOCKED'
    ? 'BLOCKED'
    : score >= 85
      ? 'HIGH_EVIDENCE'
      : 'PARTIAL_EVIDENCE';

  return {
    score,
    label,
    basis,
    confidenceHash: sha256ForPayload({
      schema: 'vitalcv.pmf-verification-confidence.v1',
      score,
      label,
      basis,
    }),
  };
}

export function verifyInstitutionalPmf(
  input: VerifyInstitutionalPmfInput,
): InstitutionalPmfVerification {
  const lineage = buildPmfVerificationLineage({
    verificationId: input.verificationId,
    signals: input.signals,
  });
  const institutionalReadiness = buildReadiness(lineage);
  const replayFriction = buildReplayFriction(lineage);
  const adoptionSurvivability = buildAdoptionSurvivability(lineage);
  const evidenceSynthesis = buildEvidenceSynthesis(lineage);
  const ambiguities = cleanAmbiguities(input.signals);
  const blockers = buildBlockers({
    lineage,
    replayFriction,
    evidenceSynthesis,
  });
  const status: PmfVerificationStatus = blockers.length === 0
    ? 'PMF_VERIFIED'
    : 'PMF_BLOCKED';
  const pmfScore = status === 'PMF_VERIFIED'
    ? computePmfScore({
        institutionalReadiness,
        replayFriction,
        adoptionSurvivability,
        evidenceSynthesis,
        lineage,
      })
    : 0;
  const confidence = buildConfidence({
    lineage,
    replayFriction,
    institutionalReadiness,
    adoptionSurvivability,
    evidenceSynthesis,
    ambiguityCount: ambiguities.length,
    status,
  });
  const verdict = verdictFor({
    status,
    pmfScore,
    adoptionSurvivability,
    institutionalReadiness,
  });
  const body = {
    schema: 'vitalcv.institutional-pmf-verification.v1' as const,
    verificationId: input.verificationId,
    institutionId: input.institutionId,
    verifierId: input.verifierId,
    verifiedAt: input.verifiedAt,
    status,
    verdict,
    pmfScore,
    failClosed: status === 'PMF_BLOCKED',
    blockers,
    ambiguities,
    ambiguityPreserved: ambiguities.every((ambiguity) =>
      lineage.timeline.some((entry) => entry.ambiguity === ambiguity),
    ),
    lineage,
    institutionalReadiness,
    replayFriction,
    adoptionSurvivability,
    evidenceSynthesis,
    confidence,
  };

  return {
    ...body,
    verificationHash: sha256ForPayload(body),
  };
}

export function evaluatePmfVerificationGate(input: {
  verification: InstitutionalPmfVerification;
}): PmfVerificationGateVerdict {
  const { verification } = input;
  const gates: PmfVerificationGate[] = [
    {
      id: 'pmf_claims_evidence_derived',
      pass:
        verification.evidenceSynthesis.evidenceDerived
        && verification.evidenceSynthesis.score >= 75,
      reason: 'PMF claims must be synthesized from evidence-bearing deployment signals.',
    },
    {
      id: 'replay_friction_measurable',
      pass: verification.replayFriction.measurable,
      reason: 'Replay friction must be measurable across the PMF verification window.',
    },
    {
      id: 'ambiguity_preserved_in_scoring',
      pass: verification.ambiguityPreserved,
      reason: 'PMF scoring must preserve ambiguity rather than treating it as clean evidence.',
    },
    {
      id: 'fail_closed_pmf_semantics',
      pass:
        verification.status === 'PMF_VERIFIED'
        && !verification.failClosed
        && verification.blockers.length === 0,
      reason: 'CI passes only verified PMF outcomes; unsupported PMF claims must fail closed.',
    },
    {
      id: 'adoption_readiness_longitudinally_visible',
      pass:
        verification.institutionalReadiness.longitudinallyVisible
        && Boolean(verification.lineage.firstRecordedAt)
        && Boolean(verification.lineage.lastRecordedAt),
      reason: 'Adoption readiness must be longitudinally visible.',
    },
    {
      id: 'pmf_lineage_reconstructable',
      pass: lineageReconstructable(verification.lineage),
      reason: 'PMF verification lineage must be reconstructable.',
    },
    {
      id: 'pmf_confidence_evidence_derived',
      pass:
        verification.confidence.score >= 85
        && verification.confidence.basis.includes('pmf_evidence_synthesized')
        && !verification.confidence.basis.includes('operator_asserted'),
      reason: 'PMF confidence must be derived from readiness, replay, adoption, and evidence synthesis.',
    },
  ];
  const failedGateIds = gates
    .filter((gate) => !gate.pass)
    .map((gate) => gate.id);

  return {
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };
}

function cloneSignal(
  signal: PmfVerificationSignal,
  overrides: Partial<PmfVerificationSignal>,
): PmfVerificationSignal {
  return {
    ...signal,
    evidenceRefs: [...signal.evidenceRefs],
    ...overrides,
  };
}

export function runPmfVerificationChaosSimulations(
  input: RunPmfVerificationChaosInput,
): PmfVerificationChaosResult {
  const scenarios: PmfVerificationChaosScenario[] = [
    'BASELINE',
    'REPLAY_FRICTION_REGRESSION',
    'READINESS_COLLAPSE',
    'ADOPTION_SURVIVABILITY_LOSS',
    'EVIDENCE_GAP',
    'AMBIGUITY_SUPPRESSION',
  ];
  const baselineAmbiguityCount = cleanAmbiguities(input.baselineSignals).length;

  const verdicts = scenarios.map((scenario): PmfVerificationChaosVerdict => {
    const signals = (() => {
      if (scenario === 'REPLAY_FRICTION_REGRESSION') {
        return input.baselineSignals.map((signal, index) =>
          cloneSignal(signal, {
            replayFriction: index === input.baselineSignals.length - 1 ? 0.86 : 0.7,
            ambiguity: signal.signalType === 'replay_friction'
              ? 'replay friction regressed during deployment rehearsal'
              : signal.ambiguity,
          }),
        );
      }

      if (scenario === 'READINESS_COLLAPSE') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, {
            institutionalReadiness: 0.34,
            deploymentReadiness: 0.32,
          }),
        );
      }

      if (scenario === 'ADOPTION_SURVIVABILITY_LOSS') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, { adoptionSurvivability: 0.24 }),
        );
      }

      if (scenario === 'EVIDENCE_GAP') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, { evidenceRefs: [] }),
        );
      }

      if (scenario === 'AMBIGUITY_SUPPRESSION') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, { ambiguity: null }),
        );
      }

      return input.baselineSignals;
    })();
    const verification = verifyInstitutionalPmf({
      verificationId: `${input.verificationId}-${scenario.toLowerCase()}`,
      institutionId: input.institutionId,
      verifierId: input.verifierId,
      verifiedAt: input.verifiedAt,
      signals,
    });
    const gate = evaluatePmfVerificationGate({ verification });
    const signalSurfaced = (() => {
      if (scenario === 'BASELINE') return gate.pass;
      if (scenario === 'REPLAY_FRICTION_REGRESSION') {
        return verification.replayFriction.trend === 'REGRESSING'
          || verification.replayFriction.score >= 60;
      }
      if (scenario === 'READINESS_COLLAPSE') {
        return verification.institutionalReadiness.score < 50
          || verification.verdict !== 'PMF_READY';
      }
      if (scenario === 'ADOPTION_SURVIVABILITY_LOSS') {
        return verification.adoptionSurvivability.score < 50
          || verification.verdict !== 'PMF_READY';
      }
      if (scenario === 'EVIDENCE_GAP') {
        return verification.status === 'PMF_BLOCKED' && !gate.pass;
      }
      return baselineAmbiguityCount > 0 && verification.ambiguities.length === 0;
    })();

    return {
      scenario,
      signalSurfaced,
      status: verification.status,
      verdict: verification.verdict,
      failedGateIds: gate.failedGateIds,
    };
  });
  const surfacedCount = verdicts.filter((verdict) => verdict.signalSurfaced).length;

  return {
    verdicts,
    summary: {
      totalScenarios: verdicts.length,
      surfacedCount,
      silentCount: verdicts.length - surfacedCount,
    },
  };
}
