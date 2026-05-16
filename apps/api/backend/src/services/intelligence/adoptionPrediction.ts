import { sha256ForPayload } from '../../utils/deterministic';

export type AdoptionSignalType =
  | 'onboarding_step'
  | 'replay_training'
  | 'resistance_event'
  | 'activation_event'
  | 'pmf_signal';

export interface AdoptionTrajectorySignal {
  id: string;
  recordedAt: string;
  institutionId: string;
  verifierId: string;
  signalType: AdoptionSignalType;
  adoptionMomentum: number;
  replayFriction: number;
  institutionalResistance: number;
  verifierActivation: number;
  pmfSignal: number;
  evidenceRefs: string[];
  ambiguity: string | null;
}

export interface AdoptionTrajectoryEntry {
  position: number;
  signalId: string;
  recordedAt: string;
  institutionId: string;
  verifierId: string;
  signalType: AdoptionSignalType;
  adoptionMomentum: number;
  replayFriction: number;
  institutionalResistance: number;
  verifierActivation: number;
  pmfSignal: number;
  evidenceRefs: string[];
  ambiguity: string | null;
  signalHash: string;
}

export interface AdoptionTrajectory {
  schema: 'vitalcv.adoption-trajectory.v1';
  predictionId: string;
  windowStartedAt: string | null;
  windowEndedAt: string | null;
  signals: AdoptionTrajectoryEntry[];
  trajectoryHash: string;
}

export interface BuildAdoptionTrajectoryInput {
  predictionId: string;
  signals: AdoptionTrajectorySignal[];
}

export type AdoptionProbabilityBand =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'BLOCKED';

export type AdoptionPredictionStatus =
  | 'PREDICTION_READY'
  | 'PREDICTION_BLOCKED';

export type ReplayFrictionTrend =
  | 'IMPROVING'
  | 'WORSENING'
  | 'STABLE'
  | 'UNKNOWN';

export interface ReplayFrictionPrediction {
  score: number;
  trend: ReplayFrictionTrend;
  measurable: boolean;
  evidenceRefs: string[];
}

export interface InstitutionalResistancePrediction {
  score: number;
  forecast: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceRefs: string[];
}

export interface VerifierActivationPrediction {
  probability: number;
  evidenceRefs: string[];
}

export interface PmfSurvivabilityPrediction {
  probability: number;
  modeled: boolean;
  evidenceRefs: string[];
}

export interface AdoptionPredictionConfidence {
  score: number;
  label: 'HIGH_EVIDENCE' | 'PARTIAL_EVIDENCE' | 'BLOCKED';
  basis: string[];
  confidenceHash: string;
}

export interface InstitutionalAdoptionPrediction {
  schema: 'vitalcv.institutional-adoption-prediction.v1';
  predictionId: string;
  institutionId: string;
  verifierId: string;
  generatedAt: string;
  status: AdoptionPredictionStatus;
  adoptionProbability: number;
  probabilityBand: AdoptionProbabilityBand;
  failClosed: boolean;
  blockers: string[];
  ambiguities: string[];
  ambiguityPreserved: boolean;
  trajectory: AdoptionTrajectory;
  replayFriction: ReplayFrictionPrediction;
  institutionalResistance: InstitutionalResistancePrediction;
  verifierActivation: VerifierActivationPrediction;
  pmfSurvivability: PmfSurvivabilityPrediction;
  confidence: AdoptionPredictionConfidence;
  predictionHash: string;
}

export interface PredictInstitutionalAdoptionInput {
  predictionId: string;
  institutionId: string;
  verifierId: string;
  generatedAt: string;
  signals: AdoptionTrajectorySignal[];
}

export type AdoptionPredictionGateId =
  | 'prediction_probabilistically_honest'
  | 'replay_friction_measurable'
  | 'ambiguity_preserved_in_forecast'
  | 'fail_closed_prediction_semantics'
  | 'adoption_trajectory_reconstructable'
  | 'confidence_evidence_derived'
  | 'pmf_survivability_modeled';

export interface AdoptionPredictionGate {
  id: AdoptionPredictionGateId;
  pass: boolean;
  reason: string;
}

export interface AdoptionPredictionGateVerdict {
  pass: boolean;
  gates: AdoptionPredictionGate[];
  failedGateIds: AdoptionPredictionGateId[];
}

export type AdoptionPredictionChaosScenario =
  | 'BASELINE'
  | 'REPLAY_FRICTION_SPIKE'
  | 'RESISTANCE_SURGE'
  | 'ACTIVATION_DROP'
  | 'PMF_SIGNAL_LOSS'
  | 'AMBIGUITY_SUPPRESSION';

export interface AdoptionPredictionChaosVerdict {
  scenario: AdoptionPredictionChaosScenario;
  signalSurfaced: boolean;
  status: AdoptionPredictionStatus;
  probabilityBand: AdoptionProbabilityBand;
  failedGateIds: AdoptionPredictionGateId[];
}

export interface AdoptionPredictionChaosResult {
  verdicts: AdoptionPredictionChaosVerdict[];
  summary: {
    totalScenarios: number;
    surfacedCount: number;
    silentCount: number;
  };
}

export interface RunAdoptionPredictionChaosInput {
  predictionId: string;
  institutionId: string;
  verifierId: string;
  generatedAt: string;
  baselineSignals: AdoptionTrajectorySignal[];
}

const MIN_TRAJECTORY_SIGNALS = 3;
const MIN_EVIDENCE_REFS_PER_SIGNAL = 1;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function roundProbability(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
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

function cleanAmbiguities(signals: readonly AdoptionTrajectorySignal[]): string[] {
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

function allEvidenceRefs(entries: readonly AdoptionTrajectoryEntry[]): string[] {
  return cleanRefs(entries.flatMap((entry) => entry.evidenceRefs));
}

function probabilityBand(
  probability: number,
  status: AdoptionPredictionStatus,
): AdoptionProbabilityBand {
  if (status === 'PREDICTION_BLOCKED') return 'BLOCKED';
  if (probability >= 0.75) return 'HIGH';
  if (probability >= 0.45) return 'MEDIUM';
  return 'LOW';
}

export function buildAdoptionTrajectory(
  input: BuildAdoptionTrajectoryInput,
): AdoptionTrajectory {
  const signals = [...input.signals]
    .sort((left, right) => (
      Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
      || left.id.localeCompare(right.id)
    ))
    .map((signal, position): AdoptionTrajectoryEntry => {
      const body = {
        signalId: signal.id,
        recordedAt: signal.recordedAt,
        institutionId: signal.institutionId,
        verifierId: signal.verifierId,
        signalType: signal.signalType,
        adoptionMomentum: clamp01(signal.adoptionMomentum),
        replayFriction: clamp01(signal.replayFriction),
        institutionalResistance: clamp01(signal.institutionalResistance),
        verifierActivation: clamp01(signal.verifierActivation),
        pmfSignal: clamp01(signal.pmfSignal),
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
    schema: 'vitalcv.adoption-trajectory.v1' as const,
    predictionId: input.predictionId,
    windowStartedAt: signals[0]?.recordedAt ?? null,
    windowEndedAt: signals[signals.length - 1]?.recordedAt ?? null,
    signals,
  };

  return {
    ...body,
    trajectoryHash: sha256ForPayload(body),
  };
}

function replayFrictionTrend(entries: readonly AdoptionTrajectoryEntry[]): ReplayFrictionTrend {
  if (entries.length < 2) return 'UNKNOWN';
  const start = entries[0]?.replayFriction ?? 0;
  const end = entries[entries.length - 1]?.replayFriction ?? 0;
  const delta = end - start;
  if (delta <= -0.05) return 'IMPROVING';
  if (delta >= 0.05) return 'WORSENING';
  return 'STABLE';
}

function buildReplayFriction(entries: readonly AdoptionTrajectoryEntry[]): ReplayFrictionPrediction {
  const evidenceRefs = allEvidenceRefs(entries.filter((entry) => entry.signalType === 'replay_training'));
  const fallbackEvidenceRefs = allEvidenceRefs(entries);
  const score = Math.round(average(entries.map((entry) => entry.replayFriction)) * 100);
  const measurable =
    entries.length >= MIN_TRAJECTORY_SIGNALS
    && entries.every((entry) => Number.isFinite(entry.replayFriction))
    && entries.every((entry) => entry.evidenceRefs.length >= MIN_EVIDENCE_REFS_PER_SIGNAL);

  return {
    score,
    trend: replayFrictionTrend(entries),
    measurable,
    evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : fallbackEvidenceRefs,
  };
}

function buildResistance(entries: readonly AdoptionTrajectoryEntry[]): InstitutionalResistancePrediction {
  const score = Math.round(average(entries.map((entry) => entry.institutionalResistance)) * 100);
  const forecast: InstitutionalResistancePrediction['forecast'] =
    score >= 65 ? 'HIGH' : score >= 36 ? 'MEDIUM' : 'LOW';

  return {
    score,
    forecast,
    evidenceRefs: allEvidenceRefs(entries.filter((entry) => entry.signalType === 'resistance_event')),
  };
}

function buildActivation(entries: readonly AdoptionTrajectoryEntry[]): VerifierActivationPrediction {
  const activationEntries = entries.filter((entry) => entry.signalType === 'activation_event');
  return {
    probability: roundProbability(average(entries.map((entry) => entry.verifierActivation))),
    evidenceRefs: allEvidenceRefs(activationEntries.length > 0 ? activationEntries : entries),
  };
}

function buildPmf(entries: readonly AdoptionTrajectoryEntry[]): PmfSurvivabilityPrediction {
  const pmfEntries = entries.filter((entry) => entry.signalType === 'pmf_signal');
  return {
    probability: roundProbability(average(entries.map((entry) => entry.pmfSignal))),
    modeled: pmfEntries.length > 0 && allEvidenceRefs(pmfEntries).length > 0,
    evidenceRefs: allEvidenceRefs(pmfEntries),
  };
}

function trajectoryReconstructable(trajectory: AdoptionTrajectory): boolean {
  return (
    trajectory.signals.length >= MIN_TRAJECTORY_SIGNALS
    && Boolean(trajectory.windowStartedAt)
    && Boolean(trajectory.windowEndedAt)
    && trajectory.signals.every((entry) => entry.evidenceRefs.length >= MIN_EVIDENCE_REFS_PER_SIGNAL)
  );
}

function computeAdoptionProbability(entries: readonly AdoptionTrajectoryEntry[]): number {
  const adoptionMomentum = average(entries.map((entry) => entry.adoptionMomentum));
  const replayEfficiency = 1 - average(entries.map((entry) => entry.replayFriction));
  const resistanceRelief = 1 - average(entries.map((entry) => entry.institutionalResistance));
  const activation = average(entries.map((entry) => entry.verifierActivation));
  const pmf = average(entries.map((entry) => entry.pmfSignal));

  return roundProbability(
    adoptionMomentum * 0.3
    + replayEfficiency * 0.2
    + resistanceRelief * 0.2
    + activation * 0.15
    + pmf * 0.15,
  );
}

function buildBlockers(input: {
  trajectory: AdoptionTrajectory;
  replayFriction: ReplayFrictionPrediction;
  pmfSurvivability: PmfSurvivabilityPrediction;
  evidenceDerived: boolean;
}): string[] {
  const blockers: string[] = [];

  if (!trajectoryReconstructable(input.trajectory)) {
    blockers.push('Adoption trajectory is not reconstructable.');
  }

  if (!input.replayFriction.measurable) {
    blockers.push('Replay friction is not longitudinally measurable.');
  }

  if (!input.pmfSurvivability.modeled) {
    blockers.push('PMF survivability is not modeled.');
  }

  if (!input.evidenceDerived) {
    blockers.push('Prediction confidence is not evidence-derived.');
  }

  return blockers;
}

function buildConfidence(input: {
  trajectory: AdoptionTrajectory;
  replayFriction: ReplayFrictionPrediction;
  pmfSurvivability: PmfSurvivabilityPrediction;
  evidenceDerived: boolean;
  ambiguityCount: number;
  status: AdoptionPredictionStatus;
}): AdoptionPredictionConfidence {
  const basis: string[] = [];
  let score = 10;

  if (trajectoryReconstructable(input.trajectory)) {
    score += 25;
    basis.push('adoption_trajectory_reconstructable');
  }

  if (input.replayFriction.measurable) {
    score += 20;
    basis.push('replay_friction_measurable');
  }

  if (input.pmfSurvivability.modeled) {
    score += 15;
    basis.push('pmf_survivability_modeled');
  }

  if (input.evidenceDerived) {
    score += 20;
    basis.push('evidence_threshold_met');
  }

  if (input.ambiguityCount > 0) {
    score += 5;
    basis.push('ambiguity_preserved_in_forecast');
  }

  score = Math.max(0, Math.min(100, score - input.ambiguityCount * 2));

  const label: AdoptionPredictionConfidence['label'] = input.status === 'PREDICTION_BLOCKED'
    ? 'BLOCKED'
    : score >= 80
      ? 'HIGH_EVIDENCE'
      : 'PARTIAL_EVIDENCE';

  return {
    score,
    label,
    basis,
    confidenceHash: sha256ForPayload({
      schema: 'vitalcv.adoption-prediction-confidence.v1',
      score,
      label,
      basis,
    }),
  };
}

export function predictInstitutionalAdoption(
  input: PredictInstitutionalAdoptionInput,
): InstitutionalAdoptionPrediction {
  const trajectory = buildAdoptionTrajectory({
    predictionId: input.predictionId,
    signals: input.signals,
  });
  const replayFriction = buildReplayFriction(trajectory.signals);
  const institutionalResistance = buildResistance(trajectory.signals);
  const verifierActivation = buildActivation(trajectory.signals);
  const pmfSurvivability = buildPmf(trajectory.signals);
  const ambiguities = cleanAmbiguities(input.signals);
  const evidenceDerived =
    trajectory.signals.length > 0
    && trajectory.signals.every((entry) => entry.evidenceRefs.length >= MIN_EVIDENCE_REFS_PER_SIGNAL);
  const blockers = buildBlockers({
    trajectory,
    replayFriction,
    pmfSurvivability,
    evidenceDerived,
  });
  const status: AdoptionPredictionStatus = blockers.length === 0
    ? 'PREDICTION_READY'
    : 'PREDICTION_BLOCKED';
  const adoptionProbability = status === 'PREDICTION_READY'
    ? computeAdoptionProbability(trajectory.signals)
    : 0;
  const confidence = buildConfidence({
    trajectory,
    replayFriction,
    pmfSurvivability,
    evidenceDerived,
    ambiguityCount: ambiguities.length,
    status,
  });
  const body = {
    schema: 'vitalcv.institutional-adoption-prediction.v1' as const,
    predictionId: input.predictionId,
    institutionId: input.institutionId,
    verifierId: input.verifierId,
    generatedAt: input.generatedAt,
    status,
    adoptionProbability,
    probabilityBand: probabilityBand(adoptionProbability, status),
    failClosed: status === 'PREDICTION_BLOCKED',
    blockers,
    ambiguities,
    ambiguityPreserved: ambiguities.every((ambiguity) =>
      trajectory.signals.some((entry) => entry.ambiguity === ambiguity),
    ),
    trajectory,
    replayFriction,
    institutionalResistance,
    verifierActivation,
    pmfSurvivability,
    confidence,
  };

  return {
    ...body,
    predictionHash: sha256ForPayload(body),
  };
}

export function evaluateAdoptionPredictionGate(input: {
  prediction: InstitutionalAdoptionPrediction;
}): AdoptionPredictionGateVerdict {
  const { prediction } = input;
  const gates: AdoptionPredictionGate[] = [
    {
      id: 'prediction_probabilistically_honest',
      pass:
        prediction.status === 'PREDICTION_READY'
        && prediction.adoptionProbability > 0
        && prediction.adoptionProbability < 0.95,
      reason: 'Adoption prediction must remain probabilistic and avoid false certainty.',
    },
    {
      id: 'replay_friction_measurable',
      pass: prediction.replayFriction.measurable,
      reason: 'Replay friction must be measurable across a longitudinal adoption path.',
    },
    {
      id: 'ambiguity_preserved_in_forecast',
      pass: prediction.ambiguityPreserved,
      reason: 'Adoption forecasts must preserve ambiguity instead of smoothing it away.',
    },
    {
      id: 'fail_closed_prediction_semantics',
      pass:
        prediction.status === 'PREDICTION_READY'
        && !prediction.failClosed
        && prediction.blockers.length === 0,
      reason: 'CI only passes ready predictions; unsupported forecasts must fail closed.',
    },
    {
      id: 'adoption_trajectory_reconstructable',
      pass: trajectoryReconstructable(prediction.trajectory),
      reason: 'Adoption trajectories must be reconstructable from evidence-bearing signals.',
    },
    {
      id: 'confidence_evidence_derived',
      pass:
        prediction.confidence.score >= 80
        && prediction.confidence.basis.includes('evidence_threshold_met')
        && !prediction.confidence.basis.includes('operator_asserted'),
      reason: 'Prediction confidence must be derived from evidence, not operator assertion.',
    },
    {
      id: 'pmf_survivability_modeled',
      pass:
        prediction.pmfSurvivability.modeled
        && prediction.pmfSurvivability.probability > 0
        && prediction.pmfSurvivability.probability < 0.95,
      reason: 'PMF survivability must be explicitly modeled as a probability.',
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
  signal: AdoptionTrajectorySignal,
  overrides: Partial<AdoptionTrajectorySignal>,
): AdoptionTrajectorySignal {
  return {
    ...signal,
    evidenceRefs: [...signal.evidenceRefs],
    ...overrides,
  };
}

export function runAdoptionPredictionChaosSimulations(
  input: RunAdoptionPredictionChaosInput,
): AdoptionPredictionChaosResult {
  const scenarios: AdoptionPredictionChaosScenario[] = [
    'BASELINE',
    'REPLAY_FRICTION_SPIKE',
    'RESISTANCE_SURGE',
    'ACTIVATION_DROP',
    'PMF_SIGNAL_LOSS',
    'AMBIGUITY_SUPPRESSION',
  ];
  const baselineAmbiguityCount = cleanAmbiguities(input.baselineSignals).length;

  const verdicts = scenarios.map((scenario): AdoptionPredictionChaosVerdict => {
    const signals = (() => {
      if (scenario === 'REPLAY_FRICTION_SPIKE') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, {
            replayFriction: signal.id === input.baselineSignals[input.baselineSignals.length - 1]?.id
              ? 0.86
              : 0.72,
            ambiguity: signal.signalType === 'replay_training'
              ? 'replay workflow friction spiked during verifier onboarding'
              : signal.ambiguity,
          }),
        );
      }

      if (scenario === 'RESISTANCE_SURGE') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, {
            institutionalResistance: 0.84,
            ambiguity: signal.signalType === 'onboarding_step'
              ? 'credentialing leadership requested manual fallback before activation'
              : signal.ambiguity,
          }),
        );
      }

      if (scenario === 'ACTIVATION_DROP') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, { verifierActivation: 0.24 }),
        );
      }

      if (scenario === 'PMF_SIGNAL_LOSS') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, { pmfSignal: 0.22 }),
        );
      }

      if (scenario === 'AMBIGUITY_SUPPRESSION') {
        return input.baselineSignals.map((signal) =>
          cloneSignal(signal, { ambiguity: null }),
        );
      }

      return input.baselineSignals;
    })();
    const prediction = predictInstitutionalAdoption({
      predictionId: `${input.predictionId}-${scenario.toLowerCase()}`,
      institutionId: input.institutionId,
      verifierId: input.verifierId,
      generatedAt: input.generatedAt,
      signals,
    });
    const gate = evaluateAdoptionPredictionGate({ prediction });
    const signalSurfaced = (() => {
      if (scenario === 'BASELINE') return gate.pass;
      if (scenario === 'REPLAY_FRICTION_SPIKE') {
        return prediction.replayFriction.trend === 'WORSENING' || prediction.replayFriction.score >= 60;
      }
      if (scenario === 'RESISTANCE_SURGE') {
        return prediction.institutionalResistance.forecast === 'HIGH';
      }
      if (scenario === 'ACTIVATION_DROP') {
        return prediction.verifierActivation.probability < 0.5;
      }
      if (scenario === 'PMF_SIGNAL_LOSS') {
        return prediction.pmfSurvivability.probability < 0.5;
      }
      return baselineAmbiguityCount > 0 && prediction.ambiguities.length === 0;
    })();

    return {
      scenario,
      signalSurfaced,
      status: prediction.status,
      probabilityBand: prediction.probabilityBand,
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
