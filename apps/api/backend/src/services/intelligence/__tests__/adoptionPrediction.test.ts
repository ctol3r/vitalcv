import {
  buildAdoptionTrajectory,
  evaluateAdoptionPredictionGate,
  predictInstitutionalAdoption,
  runAdoptionPredictionChaosSimulations,
  type AdoptionTrajectorySignal,
} from '../adoptionPrediction';

const PREDICTION_ID = 'adoption-prediction-1';
const INSTITUTION_ID = 'institution-1';
const VERIFIER_ID = 'verifier-1';
const GENERATED_AT = '2026-05-10T21:00:00.000Z';

function signal(overrides: Partial<AdoptionTrajectorySignal> = {}): AdoptionTrajectorySignal {
  return {
    id: 'signal-1',
    recordedAt: '2026-05-10T18:00:00.000Z',
    institutionId: INSTITUTION_ID,
    verifierId: VERIFIER_ID,
    signalType: 'onboarding_step',
    adoptionMomentum: 0.82,
    replayFriction: 0.22,
    institutionalResistance: 0.26,
    verifierActivation: 0.78,
    pmfSignal: 0.74,
    evidenceRefs: ['onboarding-log', 'training-attestation'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineSignals(): AdoptionTrajectorySignal[] {
  return [
    signal({
      id: 'activation',
      recordedAt: '2026-05-10T18:30:00.000Z',
      signalType: 'activation_event',
      adoptionMomentum: 0.86,
      replayFriction: 0.16,
      institutionalResistance: 0.2,
      verifierActivation: 0.88,
      pmfSignal: 0.78,
      evidenceRefs: ['verifier-activation-log', 'acceptance-workflow-run'],
    }),
    signal({
      id: 'onboarding',
      recordedAt: '2026-05-10T18:00:00.000Z',
      signalType: 'onboarding_step',
      adoptionMomentum: 0.8,
      replayFriction: 0.28,
      institutionalResistance: 0.32,
      verifierActivation: 0.72,
      pmfSignal: 0.7,
      evidenceRefs: ['onboarding-log', 'operator-training-log'],
    }),
    signal({
      id: 'replay-training',
      recordedAt: '2026-05-10T18:15:00.000Z',
      signalType: 'replay_training',
      adoptionMomentum: 0.84,
      replayFriction: 0.2,
      institutionalResistance: 0.24,
      verifierActivation: 0.8,
      pmfSignal: 0.76,
      evidenceRefs: ['replay-training-score', 'replay-education-completion'],
      ambiguity: 'replay terminology still requires operator coaching',
    }),
    signal({
      id: 'pmf',
      recordedAt: '2026-05-10T18:45:00.000Z',
      signalType: 'pmf_signal',
      adoptionMomentum: 0.88,
      replayFriction: 0.14,
      institutionalResistance: 0.18,
      verifierActivation: 0.86,
      pmfSignal: 0.84,
      evidenceRefs: ['pilot-success-review', 'repeat-verifier-request'],
    }),
  ];
}

describe('adoption trajectory reconstruction', () => {
  it('orders adoption signals chronologically and hashes trajectories deterministically', () => {
    const trajectory = buildAdoptionTrajectory({
      predictionId: PREDICTION_ID,
      signals: baselineSignals(),
    });
    const repeat = buildAdoptionTrajectory({
      predictionId: PREDICTION_ID,
      signals: [...baselineSignals()].reverse(),
    });

    expect(trajectory.signals.map((entry) => entry.signalId)).toEqual([
      'onboarding',
      'replay-training',
      'activation',
      'pmf',
    ]);
    expect(trajectory.windowStartedAt).toBe('2026-05-10T18:00:00.000Z');
    expect(trajectory.windowEndedAt).toBe('2026-05-10T18:45:00.000Z');
    expect(trajectory.trajectoryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(trajectory.trajectoryHash).toBe(repeat.trajectoryHash);
  });
});

describe('institutional adoption prediction', () => {
  it('forecasts adoption probability honestly from adoption, replay-friction, activation, resistance, and PMF signals', () => {
    const prediction = predictInstitutionalAdoption({
      predictionId: PREDICTION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      generatedAt: GENERATED_AT,
      signals: baselineSignals(),
    });

    expect(prediction.status).toBe('PREDICTION_READY');
    expect(prediction.failClosed).toBe(false);
    expect(prediction.adoptionProbability).toBeGreaterThan(0.65);
    expect(prediction.adoptionProbability).toBeLessThan(0.95);
    expect(prediction.probabilityBand).toBe('HIGH');
    expect(prediction.replayFriction.measurable).toBe(true);
    expect(prediction.replayFriction.trend).toBe('IMPROVING');
    expect(prediction.institutionalResistance.forecast).toBe('LOW');
    expect(prediction.verifierActivation.probability).toBeGreaterThan(0.75);
    expect(prediction.pmfSurvivability.probability).toBeGreaterThan(0.75);
    expect(prediction.ambiguities).toContain('replay terminology still requires operator coaching');
    expect(prediction.confidence.basis).toEqual(expect.arrayContaining([
      'adoption_trajectory_reconstructable',
      'replay_friction_measurable',
      'pmf_survivability_modeled',
      'evidence_threshold_met',
    ]));
    expect(prediction.predictionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed when adoption signals are not evidence-derived and replay friction cannot be measured', () => {
    const prediction = predictInstitutionalAdoption({
      predictionId: PREDICTION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      generatedAt: GENERATED_AT,
      signals: [
        signal({
          id: 'unsupported',
          evidenceRefs: [],
          replayFriction: 0.5,
          ambiguity: 'sales intent was asserted without operational evidence',
        }),
      ],
    });

    expect(prediction.status).toBe('PREDICTION_BLOCKED');
    expect(prediction.failClosed).toBe(true);
    expect(prediction.probabilityBand).toBe('BLOCKED');
    expect(prediction.blockers).toContain('Adoption trajectory is not reconstructable.');
    expect(prediction.blockers).toContain('Replay friction is not longitudinally measurable.');
    expect(prediction.blockers).toContain('Prediction confidence is not evidence-derived.');
    expect(prediction.ambiguities).toContain('sales intent was asserted without operational evidence');
  });

  it('models institutional resistance and lowers deployment probability without hiding ambiguity', () => {
    const prediction = predictInstitutionalAdoption({
      predictionId: PREDICTION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      generatedAt: GENERATED_AT,
      signals: baselineSignals().map((entry) => ({
        ...entry,
        institutionalResistance: 0.78,
        replayFriction: 0.48,
        ambiguity: entry.id === 'replay-training'
          ? 'credentialing team distrusts replay semantics during intake'
          : entry.ambiguity,
      })),
    });

    expect(prediction.status).toBe('PREDICTION_READY');
    expect(prediction.institutionalResistance.forecast).toBe('HIGH');
    expect(prediction.adoptionProbability).toBeLessThan(0.65);
    expect(prediction.ambiguities).toContain('credentialing team distrusts replay semantics during intake');
  });
});

describe('adoption prediction chaos simulations', () => {
  it('surfaces replay friction, resistance surge, activation drop, PMF loss, and ambiguity suppression', () => {
    const chaos = runAdoptionPredictionChaosSimulations({
      predictionId: PREDICTION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      generatedAt: GENERATED_AT,
      baselineSignals: baselineSignals(),
    });

    expect(chaos.summary.totalScenarios).toBeGreaterThanOrEqual(5);
    expect(chaos.summary.silentCount).toBe(0);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'REPLAY_FRICTION_SPIKE')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'RESISTANCE_SURGE')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'ACTIVATION_DROP')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'PMF_SIGNAL_LOSS')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'AMBIGUITY_SUPPRESSION')?.signalSurfaced).toBe(true);
  });
});

describe('adoption prediction gate failure mode', () => {
  it('rejects blocked forecasts instead of allowing unsupported adoption optimism', () => {
    const prediction = predictInstitutionalAdoption({
      predictionId: PREDICTION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      generatedAt: GENERATED_AT,
      signals: [
        signal({
          id: 'unsupported-optimism',
          adoptionMomentum: 0.95,
          verifierActivation: 0.92,
          pmfSignal: 0.9,
          evidenceRefs: [],
          replayFriction: 0.6,
          ambiguity: null,
        }),
      ],
    });
    const gate = evaluateAdoptionPredictionGate({ prediction });

    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'prediction_probabilistically_honest',
      'replay_friction_measurable',
      'fail_closed_prediction_semantics',
      'adoption_trajectory_reconstructable',
    ]));
  });
});
