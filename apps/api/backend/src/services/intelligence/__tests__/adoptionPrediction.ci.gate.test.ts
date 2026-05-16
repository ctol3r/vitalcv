import {
  evaluateAdoptionPredictionGate,
  predictInstitutionalAdoption,
  type AdoptionTrajectorySignal,
} from '../adoptionPrediction';

const predictionId = 'adoption-ci';
const institutionId = 'institution-ci';
const verifierId = 'verifier-ci';

function signal(overrides: Partial<AdoptionTrajectorySignal>): AdoptionTrajectorySignal {
  return {
    id: overrides.id ?? 'signal-ci',
    recordedAt: overrides.recordedAt ?? '2026-05-10T18:00:00.000Z',
    institutionId,
    verifierId,
    signalType: overrides.signalType ?? 'onboarding_step',
    adoptionMomentum: overrides.adoptionMomentum ?? 0.82,
    replayFriction: overrides.replayFriction ?? 0.2,
    institutionalResistance: overrides.institutionalResistance ?? 0.24,
    verifierActivation: overrides.verifierActivation ?? 0.78,
    pmfSignal: overrides.pmfSignal ?? 0.76,
    evidenceRefs: overrides.evidenceRefs ?? ['ci-evidence-a', 'ci-evidence-b'],
    ambiguity: overrides.ambiguity ?? null,
  };
}

describe('CI gate — institutional adoption prediction', () => {
  it('requires honest probabilities, visible replay friction, preserved ambiguity, reconstructable trajectories, and evidence-derived confidence', () => {
    const prediction = predictInstitutionalAdoption({
      predictionId,
      institutionId,
      verifierId,
      generatedAt: '2026-05-10T21:00:00.000Z',
      signals: [
        signal({
          id: 'ci-onboarding',
          recordedAt: '2026-05-10T18:00:00.000Z',
          signalType: 'onboarding_step',
          replayFriction: 0.28,
        }),
        signal({
          id: 'ci-replay',
          recordedAt: '2026-05-10T18:15:00.000Z',
          signalType: 'replay_training',
          replayFriction: 0.2,
          ambiguity: 'replay education passed but still requires verifier coaching',
        }),
        signal({
          id: 'ci-activation',
          recordedAt: '2026-05-10T18:30:00.000Z',
          signalType: 'activation_event',
          replayFriction: 0.16,
          verifierActivation: 0.86,
        }),
        signal({
          id: 'ci-pmf',
          recordedAt: '2026-05-10T18:45:00.000Z',
          signalType: 'pmf_signal',
          replayFriction: 0.14,
          pmfSignal: 0.84,
        }),
      ],
    });

    const gate = evaluateAdoptionPredictionGate({ prediction });

    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateVerdict) => gateVerdict.id)).toEqual([
      'prediction_probabilistically_honest',
      'replay_friction_measurable',
      'ambiguity_preserved_in_forecast',
      'fail_closed_prediction_semantics',
      'adoption_trajectory_reconstructable',
      'confidence_evidence_derived',
      'pmf_survivability_modeled',
    ]);
  });
});
