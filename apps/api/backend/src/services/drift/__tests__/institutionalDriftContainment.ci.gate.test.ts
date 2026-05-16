import {
  buildDriftContainmentSnapshot,
  evaluateDriftContainmentGate,
  runDriftChaosSimulations,
} from '../institutionalDriftContainment';

describe('CI gate — institutional drift containment', () => {
  it('a healthy longitudinal trajectory satisfies every drift containment gate', () => {
    const snapshot = buildDriftContainmentSnapshot({
      trajectoryId: 'ci-gate-trajectory',
      samples: [
        {
          recordedAt: '2026-05-01T00:00:00.000Z',
          samplerId: 'ci-sampler-A',
          governanceIntegrity: 0.94,
          replayFidelity: 0.95,
          evidenceCohesion: 0.93,
          ambiguityVisibility: 0.91,
          ambiguityRefs: ['baseline-ambiguity'],
          evidenceRefs: ['ci-evidence-1'],
        },
        {
          recordedAt: '2026-05-04T00:00:00.000Z',
          samplerId: 'ci-sampler-A',
          governanceIntegrity: 0.94,
          replayFidelity: 0.95,
          evidenceCohesion: 0.93,
          ambiguityVisibility: 0.91,
          ambiguityRefs: ['baseline-ambiguity'],
          evidenceRefs: ['ci-evidence-2'],
        },
        {
          recordedAt: '2026-05-08T00:00:00.000Z',
          samplerId: 'ci-sampler-A',
          governanceIntegrity: 0.94,
          replayFidelity: 0.95,
          evidenceCohesion: 0.93,
          ambiguityVisibility: 0.91,
          ambiguityRefs: ['baseline-ambiguity'],
          evidenceRefs: ['ci-evidence-3'],
        },
      ],
      raisedSignals: 4,
      surfacedSignals: 4,
      evidenceRefs: ['ci-runbook'],
    });

    const verdict = evaluateDriftContainmentGate({ snapshot });

    expect(verdict.pass).toBe(true);
    expect(verdict.failedGateIds).toEqual([]);
    expect(verdict.gates.map((g) => g.id)).toEqual([
      'trajectory_longitudinally_visible',
      'normalization_pressure_detectable',
      'decay_boundaries_enforced',
      'replay_degradation_bounded',
      'fatigue_suppression_visible',
      'ambiguity_preserved_through_escalation',
      'fail_closed_drift_semantics',
      'institutional_decay_reconstructable',
    ]);
  });

  it('CI gate rejects snapshots where replay degradation is unbounded and ambiguity is hidden', () => {
    const snapshot = buildDriftContainmentSnapshot({
      trajectoryId: 'ci-gate-fail',
      samples: [
        {
          recordedAt: '2026-05-01T00:00:00.000Z',
          samplerId: 'ci-sampler-A',
          governanceIntegrity: 0.94,
          replayFidelity: 0.95,
          evidenceCohesion: 0.93,
          ambiguityVisibility: 0.91,
          ambiguityRefs: ['baseline-ambiguity'],
          evidenceRefs: [],
        },
        {
          recordedAt: '2026-05-04T00:00:00.000Z',
          samplerId: 'ci-sampler-A',
          governanceIntegrity: 0.6,
          replayFidelity: 0.5,
          evidenceCohesion: 0.5,
          ambiguityVisibility: 0.2,
          ambiguityRefs: [],
          evidenceRefs: [],
        },
      ],
      raisedSignals: 8,
      surfacedSignals: 0,
      evidenceRefs: [],
    });

    const verdict = evaluateDriftContainmentGate({ snapshot });

    expect(verdict.pass).toBe(false);
    expect(verdict.failedGateIds).toEqual(expect.arrayContaining([
      'trajectory_longitudinally_visible',
      'institutional_decay_reconstructable',
    ]));
  });

  it('CI gate runs the drift chaos suite and confirms no scenario is silent', () => {
    const result = runDriftChaosSimulations({});
    expect(result.summary.silentCount).toBe(0);
    expect(result.summary.surfacedCount).toBe(result.summary.totalScenarios);
  });
});
