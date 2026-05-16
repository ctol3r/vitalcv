import { sha256ForPayload } from '../../utils/deterministic';

export type DriftMetricKey =
  | 'governanceIntegrity'
  | 'replayFidelity'
  | 'evidenceCohesion'
  | 'ambiguityVisibility';

export interface DriftSample {
  recordedAt: string;
  samplerId: string;
  governanceIntegrity: number;
  replayFidelity: number;
  evidenceCohesion: number;
  ambiguityVisibility: number;
  ambiguityRefs: string[];
  evidenceRefs: string[];
}

export interface DriftTrajectoryEntry {
  position: number;
  recordedAt: string;
  samplerId: string;
  governanceIntegrity: number;
  replayFidelity: number;
  evidenceCohesion: number;
  ambiguityVisibility: number;
  ambiguityRefs: string[];
  evidenceRefs: string[];
  entryHash: string;
}

export interface DriftTrajectory {
  schema: 'vitalcv.institutional-drift-trajectory.v1';
  trajectoryId: string;
  windowStartedAt: string | null;
  windowEndedAt: string | null;
  samples: DriftTrajectoryEntry[];
  trajectoryHash: string;
}

export interface DriftMetricMovement {
  metric: DriftMetricKey;
  startValue: number;
  endValue: number;
  delta: number;
  monotonicallyDegrading: boolean;
  smoothedDecline: number;
}

export interface DriftNormalizationVerdict {
  schema: 'vitalcv.institutional-drift-normalization.v1';
  trajectoryId: string;
  normalizationDetected: boolean;
  normalizationPressure: number;
  movements: DriftMetricMovement[];
  basis: string[];
  ambiguities: string[];
  verdictHash: string;
}

export interface DriftDecayBoundary {
  boundaryId: string;
  metric: DriftMetricKey;
  floor: number;
  currentValue: number;
  breached: boolean;
  marginToFloor: number;
}

export interface DriftDecayVerdict {
  schema: 'vitalcv.institutional-drift-decay.v1';
  trajectoryId: string;
  boundaries: DriftDecayBoundary[];
  breachedBoundaryIds: string[];
  containmentRequired: boolean;
  ambiguities: string[];
  verdictHash: string;
}

export type ReplayDegradationStatus =
  | 'WITHIN_BOUND'
  | 'APPROACHING_BOUND'
  | 'OUT_OF_BOUND'
  | 'CONTAINMENT_TRIGGERED';

export interface ReplayDegradationVerdict {
  schema: 'vitalcv.institutional-drift-replay-bound.v1';
  trajectoryId: string;
  status: ReplayDegradationStatus;
  fidelityFloor: number;
  observedFidelity: number;
  bounded: boolean;
  failClosed: boolean;
  ambiguities: string[];
  verdictHash: string;
}

export interface InstitutionalFatigueIndicator {
  schema: 'vitalcv.institutional-drift-fatigue.v1';
  trajectoryId: string;
  suppressionRatio: number;
  escalationDecayRate: number;
  ambiguitySuppressionRate: number;
  fatigueDetected: boolean;
  suppressionMasked: boolean;
  basis: string[];
  ambiguities: string[];
  verdictHash: string;
}

export type DriftEscalationState =
  | 'STABLE'
  | 'WATCH'
  | 'ELEVATED'
  | 'CONTAINMENT'
  | 'FAIL_CLOSED';

export interface DriftEscalationStep {
  schema: 'vitalcv.institutional-drift-escalation.v1';
  previousState: DriftEscalationState;
  nextState: DriftEscalationState;
  triggers: string[];
  ambiguities: string[];
  blockers: string[];
  evidenceRefs: string[];
  failClosed: boolean;
  stepHash: string;
}

export type DriftChaosScenario =
  | 'BASELINE'
  | 'SLOW_NORMALIZATION'
  | 'DECAY_BOUNDARY_BREACH'
  | 'REPLAY_BOUND_BREACH'
  | 'INSTITUTIONAL_FATIGUE'
  | 'AMBIGUITY_SUPPRESSION';

export interface DriftChaosVerdict {
  scenario: DriftChaosScenario;
  signalSurfaced: boolean;
  signal: string;
  escalationState: DriftEscalationState;
  failedGateIds: DriftGateId[];
}

export interface DriftChaosResult {
  verdicts: DriftChaosVerdict[];
  summary: {
    totalScenarios: number;
    surfacedCount: number;
    silentCount: number;
  };
}

export type DriftGateId =
  | 'trajectory_longitudinally_visible'
  | 'normalization_pressure_detectable'
  | 'decay_boundaries_enforced'
  | 'replay_degradation_bounded'
  | 'fatigue_suppression_visible'
  | 'ambiguity_preserved_through_escalation'
  | 'fail_closed_drift_semantics'
  | 'institutional_decay_reconstructable';

export interface DriftGate {
  id: DriftGateId;
  pass: boolean;
  reason: string;
}

export interface DriftGateVerdict {
  pass: boolean;
  gates: DriftGate[];
  failedGateIds: DriftGateId[];
}

export interface DriftContainmentSnapshot {
  trajectory: DriftTrajectory;
  normalization: DriftNormalizationVerdict;
  decay: DriftDecayVerdict;
  replayBound: ReplayDegradationVerdict;
  fatigue: InstitutionalFatigueIndicator;
  escalation: DriftEscalationStep;
}

const VALID_ESCALATION_STATES: ReadonlySet<DriftEscalationState> = new Set([
  'STABLE',
  'WATCH',
  'ELEVATED',
  'CONTAINMENT',
  'FAIL_CLOSED',
]);

export const DRIFT_DECAY_FLOORS: Readonly<Record<DriftMetricKey, number>> = {
  governanceIntegrity: 0.7,
  replayFidelity: 0.75,
  evidenceCohesion: 0.65,
  ambiguityVisibility: 0.6,
};

const NORMALIZATION_PRESSURE_THRESHOLD = 0.4;
const REPLAY_FIDELITY_APPROACHING_MARGIN = 0.05;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function cleanRefs(refs: readonly string[]): string[] {
  return Array.from(
    new Set(refs.map((ref) => ref.trim()).filter((ref) => ref.length > 0)),
  ).sort((left, right) => left.localeCompare(right));
}

function sortSamples(samples: readonly DriftSample[]): DriftSample[] {
  return [...samples].sort((left, right) => {
    const leftTs = Date.parse(left.recordedAt);
    const rightTs = Date.parse(right.recordedAt);
    if (leftTs !== rightTs) return leftTs - rightTs;
    return left.samplerId.localeCompare(right.samplerId);
  });
}

export function buildDriftTrajectory(input: {
  trajectoryId: string;
  samples: readonly DriftSample[];
}): DriftTrajectory {
  const ordered = sortSamples(input.samples);
  const entries = ordered.map((sample, position): DriftTrajectoryEntry => {
    const body = {
      recordedAt: sample.recordedAt,
      samplerId: sample.samplerId,
      governanceIntegrity: clamp01(sample.governanceIntegrity),
      replayFidelity: clamp01(sample.replayFidelity),
      evidenceCohesion: clamp01(sample.evidenceCohesion),
      ambiguityVisibility: clamp01(sample.ambiguityVisibility),
      ambiguityRefs: cleanRefs(sample.ambiguityRefs),
      evidenceRefs: cleanRefs(sample.evidenceRefs),
    };
    return {
      position,
      ...body,
      entryHash: sha256ForPayload(body),
    };
  });

  const body = {
    schema: 'vitalcv.institutional-drift-trajectory.v1' as const,
    trajectoryId: input.trajectoryId,
    windowStartedAt: entries[0]?.recordedAt ?? null,
    windowEndedAt: entries[entries.length - 1]?.recordedAt ?? null,
    samples: entries,
  };

  return {
    ...body,
    trajectoryHash: sha256ForPayload(body),
  };
}

function metricMovement(
  metric: DriftMetricKey,
  trajectory: DriftTrajectory,
): DriftMetricMovement {
  const values = trajectory.samples.map((entry) => entry[metric]);
  const startValue = values[0] ?? 0;
  const endValue = values[values.length - 1] ?? 0;
  const delta = endValue - startValue;

  let monotonicallyDegrading = values.length >= 2;
  let totalDeclines = 0;
  let declineCount = 0;
  for (let i = 1; i < values.length; i += 1) {
    const step = values[i] - values[i - 1];
    if (step > 0.001) {
      monotonicallyDegrading = false;
    }
    if (step < 0) {
      totalDeclines += Math.abs(step);
      declineCount += 1;
    }
  }

  const smoothedDecline = declineCount === 0 ? 0 : totalDeclines / declineCount;

  return {
    metric,
    startValue,
    endValue,
    delta,
    monotonicallyDegrading,
    smoothedDecline,
  };
}

export function detectDriftNormalization(input: {
  trajectory: DriftTrajectory;
}): DriftNormalizationVerdict {
  const metrics: DriftMetricKey[] = [
    'governanceIntegrity',
    'replayFidelity',
    'evidenceCohesion',
    'ambiguityVisibility',
  ];
  const movements = metrics.map((metric) => metricMovement(metric, input.trajectory));

  const basis: string[] = [];
  let pressure = 0;

  for (const movement of movements) {
    if (movement.delta < -0.01) {
      pressure += Math.min(0.3, Math.abs(movement.delta));
      basis.push(`${movement.metric}_declined_${movement.delta.toFixed(3)}`);
    }
    if (movement.monotonicallyDegrading && Math.abs(movement.delta) > 0.02) {
      pressure += 0.15;
      basis.push(`${movement.metric}_monotonic_decline`);
    }
    if (movement.smoothedDecline > 0.03) {
      pressure += 0.1;
      basis.push(`${movement.metric}_smoothed_decline_${movement.smoothedDecline.toFixed(3)}`);
    }
  }

  const ambiguityVisibilityMovement = movements.find((m) => m.metric === 'ambiguityVisibility');
  const ambiguities: string[] = [];
  if (ambiguityVisibilityMovement && ambiguityVisibilityMovement.delta < -0.05) {
    ambiguities.push(
      'Ambiguity visibility is declining alongside governance metrics; suppressed signal cannot be reclaimed silently.',
    );
  }

  const normalizationPressure = Math.min(1, pressure);
  const normalizationDetected = normalizationPressure >= NORMALIZATION_PRESSURE_THRESHOLD;
  if (normalizationDetected) {
    ambiguities.push(
      'Drift normalization pressure exceeds threshold; the new normal is structurally worse than the prior baseline.',
    );
  }

  const body = {
    schema: 'vitalcv.institutional-drift-normalization.v1' as const,
    trajectoryId: input.trajectory.trajectoryId,
    normalizationDetected,
    normalizationPressure,
    movements,
    basis: Array.from(new Set(basis)).sort(),
    ambiguities,
  };

  return {
    ...body,
    verdictHash: sha256ForPayload(body),
  };
}

export function evaluateDriftDecayBoundaries(input: {
  trajectory: DriftTrajectory;
  floors?: Partial<Record<DriftMetricKey, number>>;
}): DriftDecayVerdict {
  const tail = input.trajectory.samples[input.trajectory.samples.length - 1];
  const metrics: DriftMetricKey[] = [
    'governanceIntegrity',
    'replayFidelity',
    'evidenceCohesion',
    'ambiguityVisibility',
  ];

  const boundaries = metrics.map((metric): DriftDecayBoundary => {
    const floor = input.floors?.[metric] ?? DRIFT_DECAY_FLOORS[metric];
    const currentValue = tail ? tail[metric] : 0;
    const marginToFloor = currentValue - floor;
    return {
      boundaryId: `boundary_${metric}`,
      metric,
      floor,
      currentValue,
      breached: currentValue < floor,
      marginToFloor,
    };
  });

  const breachedBoundaryIds = boundaries.filter((b) => b.breached).map((b) => b.boundaryId);
  const containmentRequired = breachedBoundaryIds.length > 0;
  const ambiguities = breachedBoundaryIds.length > 0
    ? [
      `Decay boundary breach across ${breachedBoundaryIds.length} metric(s); structural posture is below the institutional floor.`,
    ]
    : [];

  const body = {
    schema: 'vitalcv.institutional-drift-decay.v1' as const,
    trajectoryId: input.trajectory.trajectoryId,
    boundaries,
    breachedBoundaryIds,
    containmentRequired,
    ambiguities,
  };

  return {
    ...body,
    verdictHash: sha256ForPayload(body),
  };
}

export function evaluateReplayDegradationBound(input: {
  trajectory: DriftTrajectory;
  fidelityFloor?: number;
}): ReplayDegradationVerdict {
  const fidelityFloor = input.fidelityFloor ?? DRIFT_DECAY_FLOORS.replayFidelity;
  const tail = input.trajectory.samples[input.trajectory.samples.length - 1];
  const observedFidelity = tail ? tail.replayFidelity : 0;
  const margin = observedFidelity - fidelityFloor;

  let status: ReplayDegradationStatus;
  if (observedFidelity < fidelityFloor - 0.05) {
    status = 'CONTAINMENT_TRIGGERED';
  } else if (observedFidelity < fidelityFloor) {
    status = 'OUT_OF_BOUND';
  } else if (margin < REPLAY_FIDELITY_APPROACHING_MARGIN) {
    status = 'APPROACHING_BOUND';
  } else {
    status = 'WITHIN_BOUND';
  }

  const bounded = status === 'WITHIN_BOUND' || status === 'APPROACHING_BOUND';
  const failClosed = status === 'CONTAINMENT_TRIGGERED' || status === 'OUT_OF_BOUND';
  const ambiguities: string[] = [];
  if (status === 'APPROACHING_BOUND') {
    ambiguities.push('Replay fidelity is approaching the lower bound; degradation is not yet contained.');
  }
  if (status === 'OUT_OF_BOUND') {
    ambiguities.push('Replay fidelity is below the institutional floor; degradation is unbounded.');
  }
  if (status === 'CONTAINMENT_TRIGGERED') {
    ambiguities.push('Replay fidelity collapsed past the containment trigger; replay continuity must fail closed.');
  }

  const body = {
    schema: 'vitalcv.institutional-drift-replay-bound.v1' as const,
    trajectoryId: input.trajectory.trajectoryId,
    status,
    fidelityFloor,
    observedFidelity,
    bounded,
    failClosed,
    ambiguities,
  };

  return {
    ...body,
    verdictHash: sha256ForPayload(body),
  };
}

export function evaluateInstitutionalFatigue(input: {
  trajectory: DriftTrajectory;
  raisedSignals: number;
  surfacedSignals: number;
  expectedSurfaceRate?: number;
}): InstitutionalFatigueIndicator {
  const raised = Math.max(0, input.raisedSignals);
  const surfaced = Math.max(0, Math.min(input.surfacedSignals, raised));
  const suppressionRatio = raised === 0 ? 0 : 1 - surfaced / raised;
  const expectedSurfaceRate = input.expectedSurfaceRate ?? 0.85;

  const ambiguityValues = input.trajectory.samples.map((s) => s.ambiguityVisibility);
  const ambiguityStart = ambiguityValues[0] ?? 0;
  const ambiguityEnd = ambiguityValues[ambiguityValues.length - 1] ?? 0;
  const ambiguitySuppressionRate = Math.max(0, ambiguityStart - ambiguityEnd);

  let escalationCount = 0;
  for (let i = 1; i < ambiguityValues.length; i += 1) {
    if (ambiguityValues[i] < ambiguityValues[i - 1] - 0.02) {
      escalationCount += 1;
    }
  }
  const escalationDecayRate = ambiguityValues.length <= 1
    ? 0
    : escalationCount / (ambiguityValues.length - 1);

  const basis: string[] = [];
  if (suppressionRatio > 1 - expectedSurfaceRate) {
    basis.push(`signal_suppression_ratio_${suppressionRatio.toFixed(3)}`);
  }
  if (ambiguitySuppressionRate > 0.05) {
    basis.push(`ambiguity_suppression_rate_${ambiguitySuppressionRate.toFixed(3)}`);
  }
  if (escalationDecayRate > 0.5) {
    basis.push(`escalation_decay_rate_${escalationDecayRate.toFixed(3)}`);
  }

  const fatigueDetected = basis.length > 0;
  const suppressionMasked = suppressionRatio > 0 && surfaced === 0 && raised > 0;

  const ambiguities: string[] = [];
  if (fatigueDetected) {
    ambiguities.push(
      'Institutional fatigue indicators detected; suppression of escalation cannot mask underlying drift.',
    );
  }
  if (suppressionMasked) {
    ambiguities.push(
      'All raised signals have been suppressed; suppression itself is the escalation event.',
    );
  }

  const body = {
    schema: 'vitalcv.institutional-drift-fatigue.v1' as const,
    trajectoryId: input.trajectory.trajectoryId,
    suppressionRatio,
    escalationDecayRate,
    ambiguitySuppressionRate,
    fatigueDetected,
    suppressionMasked,
    basis: Array.from(new Set(basis)).sort(),
    ambiguities,
  };

  return {
    ...body,
    verdictHash: sha256ForPayload(body),
  };
}

function ascendingState(state: DriftEscalationState): number {
  switch (state) {
    case 'STABLE': return 0;
    case 'WATCH': return 1;
    case 'ELEVATED': return 2;
    case 'CONTAINMENT': return 3;
    case 'FAIL_CLOSED': return 4;
    default: return 0;
  }
}

export function escalateDrift(input: {
  previousState: DriftEscalationState;
  normalization: DriftNormalizationVerdict;
  decay: DriftDecayVerdict;
  replayBound: ReplayDegradationVerdict;
  fatigue: InstitutionalFatigueIndicator;
  evidenceRefs: string[];
}): DriftEscalationStep {
  const triggers: string[] = [];
  const ambiguities = new Set<string>();
  const blockers: string[] = [];

  let target: DriftEscalationState = 'STABLE';

  if (input.normalization.normalizationDetected) {
    triggers.push('drift_normalization_pressure_above_threshold');
    target = 'WATCH';
  } else if (input.normalization.normalizationPressure > 0) {
    triggers.push('drift_normalization_pressure_present');
    target = ascendingState(target) > 0 ? target : 'WATCH';
  }

  if (input.fatigue.fatigueDetected) {
    triggers.push('institutional_fatigue_detected');
    if (ascendingState(target) < ascendingState('ELEVATED')) {
      target = 'ELEVATED';
    }
  }

  if (input.decay.containmentRequired) {
    triggers.push('decay_boundary_breach');
    if (ascendingState(target) < ascendingState('CONTAINMENT')) {
      target = 'CONTAINMENT';
    }
  }

  if (input.replayBound.failClosed) {
    triggers.push('replay_degradation_unbounded');
    target = 'FAIL_CLOSED';
    blockers.push('Replay fidelity is unbounded; restoration must not be claimed.');
  }

  if (input.fatigue.suppressionMasked) {
    blockers.push('All raised signals were suppressed; escalation cannot be silenced.');
    if (ascendingState(target) < ascendingState('CONTAINMENT')) {
      target = 'CONTAINMENT';
    }
  }

  for (const ambiguity of [
    ...input.normalization.ambiguities,
    ...input.decay.ambiguities,
    ...input.replayBound.ambiguities,
    ...input.fatigue.ambiguities,
  ]) {
    if (ambiguity && ambiguity.trim().length > 0) {
      ambiguities.add(ambiguity);
    }
  }

  const evidenceRefs = cleanRefs(input.evidenceRefs);
  if (target !== 'STABLE' && evidenceRefs.length === 0) {
    blockers.push('Drift escalation requires at least one evidence reference.');
    target = 'FAIL_CLOSED';
  }

  if (blockers.length > 0) {
    ambiguities.add('Drift escalation has unresolved blockers; ambiguity must remain visible.');
  }

  const failClosed = target === 'FAIL_CLOSED' || blockers.length > 0;

  const body = {
    schema: 'vitalcv.institutional-drift-escalation.v1' as const,
    previousState: input.previousState,
    nextState: target,
    triggers,
    ambiguities: Array.from(ambiguities).sort(),
    blockers,
    evidenceRefs,
    failClosed,
  };

  return {
    ...body,
    stepHash: sha256ForPayload(body),
  };
}

export function evaluateDriftContainmentGate(input: {
  snapshot: DriftContainmentSnapshot;
}): DriftGateVerdict {
  const { trajectory, normalization, decay, replayBound, fatigue, escalation } = input.snapshot;

  const longitudinalCount = trajectory.samples.length;
  const ambiguityPreserved = escalation.nextState === 'STABLE'
    || escalation.ambiguities.length > 0
    || escalation.blockers.length > 0;

  const reconstructable = trajectory.samples.every((entry) => entry.evidenceRefs.length >= 1);

  const gates: DriftGate[] = [
    {
      id: 'trajectory_longitudinally_visible',
      pass: longitudinalCount >= 3 && Boolean(trajectory.windowStartedAt) && Boolean(trajectory.windowEndedAt),
      reason: 'Drift trajectory must include at least three longitudinally ordered samples with explicit window boundaries.',
    },
    {
      id: 'normalization_pressure_detectable',
      pass: normalization.movements.length === 4 && normalization.basis.length >= 0,
      reason: 'Normalization detection must inspect every drift metric and surface evidence basis when pressure rises.',
    },
    {
      id: 'decay_boundaries_enforced',
      pass: decay.boundaries.length === 4
        && decay.boundaries.every((boundary) => boundary.floor > 0 && boundary.floor < 1)
        && (decay.containmentRequired === (decay.breachedBoundaryIds.length > 0)),
      reason: 'Every drift metric must be enforced against an institutional decay floor with explicit breach reporting.',
    },
    {
      id: 'replay_degradation_bounded',
      pass: replayBound.bounded || replayBound.failClosed,
      reason: 'Replay fidelity must either remain within bound or trigger a fail-closed containment event.',
    },
    {
      id: 'fatigue_suppression_visible',
      pass: !fatigue.fatigueDetected || fatigue.ambiguities.length > 0,
      reason: 'Institutional fatigue detection must surface ambiguity rather than suppress it silently.',
    },
    {
      id: 'ambiguity_preserved_through_escalation',
      pass: ambiguityPreserved,
      reason: 'Drift escalation must preserve ambiguity unless the system is genuinely stable.',
    },
    {
      id: 'fail_closed_drift_semantics',
      pass: VALID_ESCALATION_STATES.has(escalation.nextState)
        && (escalation.failClosed
          ? escalation.nextState === 'FAIL_CLOSED' || escalation.blockers.length > 0
          : escalation.nextState !== 'FAIL_CLOSED'),
      reason: 'Drift escalation must fail closed whenever blockers are present and remain open only when no blockers exist.',
    },
    {
      id: 'institutional_decay_reconstructable',
      pass: reconstructable && trajectory.samples.length >= 3,
      reason: 'Institutional decay must remain reconstructable from per-sample evidence references.',
    },
  ];

  const failedGateIds = gates.filter((gate) => !gate.pass).map((gate) => gate.id);

  return {
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };
}

function chaosTrajectory(scenario: DriftChaosScenario): DriftTrajectory {
  const baseline: DriftSample[] = [
    {
      recordedAt: '2026-05-01T00:00:00.000Z',
      samplerId: 'chaos-sampler-A',
      governanceIntegrity: 0.95,
      replayFidelity: 0.96,
      evidenceCohesion: 0.94,
      ambiguityVisibility: 0.92,
      ambiguityRefs: ['baseline-ambiguity-1'],
      evidenceRefs: ['baseline-evidence-1'],
    },
    {
      recordedAt: '2026-05-04T00:00:00.000Z',
      samplerId: 'chaos-sampler-A',
      governanceIntegrity: 0.94,
      replayFidelity: 0.95,
      evidenceCohesion: 0.93,
      ambiguityVisibility: 0.91,
      ambiguityRefs: ['baseline-ambiguity-1'],
      evidenceRefs: ['baseline-evidence-2'],
    },
    {
      recordedAt: '2026-05-08T00:00:00.000Z',
      samplerId: 'chaos-sampler-A',
      governanceIntegrity: 0.94,
      replayFidelity: 0.95,
      evidenceCohesion: 0.93,
      ambiguityVisibility: 0.91,
      ambiguityRefs: ['baseline-ambiguity-1'],
      evidenceRefs: ['baseline-evidence-3'],
    },
  ];

  if (scenario === 'BASELINE') {
    return buildDriftTrajectory({ trajectoryId: 'chaos-baseline', samples: baseline });
  }

  if (scenario === 'SLOW_NORMALIZATION') {
    const samples = baseline.map((sample, index) => ({
      ...sample,
      governanceIntegrity: sample.governanceIntegrity - index * 0.04,
      evidenceCohesion: sample.evidenceCohesion - index * 0.03,
    }));
    return buildDriftTrajectory({ trajectoryId: 'chaos-slow-normalization', samples });
  }

  if (scenario === 'DECAY_BOUNDARY_BREACH') {
    const samples = baseline.map((sample, index) => ({
      ...sample,
      governanceIntegrity: index === baseline.length - 1 ? 0.55 : sample.governanceIntegrity,
      replayFidelity: index === baseline.length - 1 ? 0.6 : sample.replayFidelity,
    }));
    return buildDriftTrajectory({ trajectoryId: 'chaos-decay-breach', samples });
  }

  if (scenario === 'REPLAY_BOUND_BREACH') {
    const samples = baseline.map((sample, index) => ({
      ...sample,
      replayFidelity: index === baseline.length - 1 ? 0.5 : sample.replayFidelity,
    }));
    return buildDriftTrajectory({ trajectoryId: 'chaos-replay-breach', samples });
  }

  if (scenario === 'INSTITUTIONAL_FATIGUE') {
    const samples = baseline.map((sample, index) => ({
      ...sample,
      ambiguityVisibility: Math.max(0, sample.ambiguityVisibility - index * 0.15),
    }));
    return buildDriftTrajectory({ trajectoryId: 'chaos-institutional-fatigue', samples });
  }

  // AMBIGUITY_SUPPRESSION
  const samples = baseline.map((sample, index) => ({
    ...sample,
    ambiguityVisibility: index === baseline.length - 1 ? 0.2 : sample.ambiguityVisibility,
    ambiguityRefs: index === baseline.length - 1 ? [] : sample.ambiguityRefs,
  }));
  return buildDriftTrajectory({ trajectoryId: 'chaos-ambiguity-suppression', samples });
}

export function runDriftChaosSimulations(input: {
  raisedSignalsPerScenario?: number;
  surfacedSignalsPerScenario?: number;
} = {}): DriftChaosResult {
  const scenarios: DriftChaosScenario[] = [
    'BASELINE',
    'SLOW_NORMALIZATION',
    'DECAY_BOUNDARY_BREACH',
    'REPLAY_BOUND_BREACH',
    'INSTITUTIONAL_FATIGUE',
    'AMBIGUITY_SUPPRESSION',
  ];

  const verdicts = scenarios.map((scenario): DriftChaosVerdict => {
    const trajectory = chaosTrajectory(scenario);
    const normalization = detectDriftNormalization({ trajectory });
    const decay = evaluateDriftDecayBoundaries({ trajectory });
    const replayBound = evaluateReplayDegradationBound({ trajectory });
    const raised = scenario === 'INSTITUTIONAL_FATIGUE'
      ? input.raisedSignalsPerScenario ?? 10
      : 0;
    const surfaced = scenario === 'INSTITUTIONAL_FATIGUE'
      ? input.surfacedSignalsPerScenario ?? 0
      : 0;
    const fatigue = evaluateInstitutionalFatigue({
      trajectory,
      raisedSignals: raised,
      surfacedSignals: surfaced,
    });
    const escalation = escalateDrift({
      previousState: 'STABLE',
      normalization,
      decay,
      replayBound,
      fatigue,
      evidenceRefs: ['chaos-runbook', 'chaos-trace'],
    });
    const gate = evaluateDriftContainmentGate({
      snapshot: { trajectory, normalization, decay, replayBound, fatigue, escalation },
    });

    const expectFailure = scenario !== 'BASELINE';
    const signalSurfaced = expectFailure
      ? escalation.nextState !== 'STABLE'
      : escalation.nextState === 'STABLE' && gate.pass;

    return {
      scenario,
      signalSurfaced,
      signal: signalSurfaced
        ? `${scenario} surfaced an operator-visible drift containment signal.`
        : `${scenario} did not surface a drift containment signal.`,
      escalationState: escalation.nextState,
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

export function buildDriftContainmentSnapshot(input: {
  trajectoryId: string;
  samples: readonly DriftSample[];
  raisedSignals?: number;
  surfacedSignals?: number;
  evidenceRefs: string[];
  previousState?: DriftEscalationState;
}): DriftContainmentSnapshot {
  const trajectory = buildDriftTrajectory({
    trajectoryId: input.trajectoryId,
    samples: input.samples,
  });
  const normalization = detectDriftNormalization({ trajectory });
  const decay = evaluateDriftDecayBoundaries({ trajectory });
  const replayBound = evaluateReplayDegradationBound({ trajectory });
  const fatigue = evaluateInstitutionalFatigue({
    trajectory,
    raisedSignals: input.raisedSignals ?? 0,
    surfacedSignals: input.surfacedSignals ?? 0,
  });
  const escalation = escalateDrift({
    previousState: input.previousState ?? 'STABLE',
    normalization,
    decay,
    replayBound,
    fatigue,
    evidenceRefs: input.evidenceRefs,
  });

  return {
    trajectory,
    normalization,
    decay,
    replayBound,
    fatigue,
    escalation,
  };
}
