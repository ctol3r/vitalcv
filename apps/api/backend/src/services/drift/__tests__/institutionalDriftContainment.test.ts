import {
  buildDriftContainmentSnapshot,
  buildDriftTrajectory,
  detectDriftNormalization,
  escalateDrift,
  evaluateDriftContainmentGate,
  evaluateDriftDecayBoundaries,
  evaluateInstitutionalFatigue,
  evaluateReplayDegradationBound,
  runDriftChaosSimulations,
  type DriftSample,
} from '../institutionalDriftContainment';

function sample(overrides: Partial<DriftSample> = {}): DriftSample {
  return {
    recordedAt: '2026-05-01T00:00:00.000Z',
    samplerId: 'sampler-A',
    governanceIntegrity: 0.9,
    replayFidelity: 0.92,
    evidenceCohesion: 0.88,
    ambiguityVisibility: 0.85,
    ambiguityRefs: ['ambiguity-1'],
    evidenceRefs: ['evidence-1'],
    ...overrides,
  };
}

describe('drift trajectory', () => {
  it('orders samples chronologically and is deterministic', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-1',
      samples: [
        sample({ recordedAt: '2026-05-08T00:00:00.000Z', samplerId: 'late' }),
        sample({ recordedAt: '2026-05-01T00:00:00.000Z', samplerId: 'early' }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z', samplerId: 'middle' }),
      ],
    });
    const repeat = buildDriftTrajectory({
      trajectoryId: 'traj-1',
      samples: [
        sample({ recordedAt: '2026-05-04T00:00:00.000Z', samplerId: 'middle' }),
        sample({ recordedAt: '2026-05-08T00:00:00.000Z', samplerId: 'late' }),
        sample({ recordedAt: '2026-05-01T00:00:00.000Z', samplerId: 'early' }),
      ],
    });

    expect(trajectory.samples.map((entry) => entry.samplerId)).toEqual(['early', 'middle', 'late']);
    expect(trajectory.windowStartedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(trajectory.windowEndedAt).toBe('2026-05-08T00:00:00.000Z');
    expect(trajectory.trajectoryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(trajectory.trajectoryHash).toBe(repeat.trajectoryHash);
  });

  it('clamps metrics into [0,1] so unbounded inputs cannot poison the trajectory', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-clamp',
      samples: [
        sample({ governanceIntegrity: 1.5, replayFidelity: -0.4 }),
      ],
    });

    expect(trajectory.samples[0]?.governanceIntegrity).toBe(1);
    expect(trajectory.samples[0]?.replayFidelity).toBe(0);
  });
});

describe('drift normalization detection', () => {
  it('detects normalization pressure when metrics monotonically degrade', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-norm',
      samples: [
        sample({ recordedAt: '2026-05-01T00:00:00.000Z', governanceIntegrity: 0.95, evidenceCohesion: 0.94 }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z', governanceIntegrity: 0.86, evidenceCohesion: 0.85 }),
        sample({ recordedAt: '2026-05-08T00:00:00.000Z', governanceIntegrity: 0.78, evidenceCohesion: 0.78 }),
      ],
    });

    const verdict = detectDriftNormalization({ trajectory });

    expect(verdict.normalizationDetected).toBe(true);
    expect(verdict.normalizationPressure).toBeGreaterThanOrEqual(0.4);
    expect(verdict.basis).toEqual(expect.arrayContaining([
      expect.stringMatching(/^governanceIntegrity_declined/),
      'governanceIntegrity_monotonic_decline',
    ]));
    expect(verdict.ambiguities.length).toBeGreaterThan(0);
  });

  it('does not raise normalization pressure when the trajectory is stable', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-stable',
      samples: [
        sample({ recordedAt: '2026-05-01T00:00:00.000Z' }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z' }),
        sample({ recordedAt: '2026-05-08T00:00:00.000Z' }),
      ],
    });

    const verdict = detectDriftNormalization({ trajectory });

    expect(verdict.normalizationDetected).toBe(false);
    expect(verdict.normalizationPressure).toBeLessThan(0.4);
  });
});

describe('drift decay boundaries', () => {
  it('reports breaches when tail values drop below institutional floors', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-decay',
      samples: [
        sample({ recordedAt: '2026-05-01T00:00:00.000Z' }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z' }),
        sample({
          recordedAt: '2026-05-08T00:00:00.000Z',
          governanceIntegrity: 0.55,
          replayFidelity: 0.6,
          evidenceCohesion: 0.5,
        }),
      ],
    });

    const verdict = evaluateDriftDecayBoundaries({ trajectory });

    expect(verdict.containmentRequired).toBe(true);
    expect(verdict.breachedBoundaryIds).toEqual(expect.arrayContaining([
      'boundary_governanceIntegrity',
      'boundary_replayFidelity',
      'boundary_evidenceCohesion',
    ]));
    const governanceBoundary = verdict.boundaries.find((b) => b.metric === 'governanceIntegrity');
    expect(governanceBoundary?.breached).toBe(true);
    expect(governanceBoundary?.marginToFloor).toBeLessThan(0);
  });

  it('keeps containment off when all metrics remain above floors', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-decay-ok',
      samples: [sample(), sample(), sample()],
    });
    const verdict = evaluateDriftDecayBoundaries({ trajectory });
    expect(verdict.containmentRequired).toBe(false);
    expect(verdict.breachedBoundaryIds).toEqual([]);
  });
});

describe('replay degradation bound', () => {
  it('triggers containment when replay fidelity collapses below the floor by more than 5 points', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-replay',
      samples: [
        sample(),
        sample(),
        sample({ replayFidelity: 0.5, recordedAt: '2026-05-08T00:00:00.000Z' }),
      ],
    });

    const verdict = evaluateReplayDegradationBound({ trajectory });
    expect(verdict.status).toBe('CONTAINMENT_TRIGGERED');
    expect(verdict.bounded).toBe(false);
    expect(verdict.failClosed).toBe(true);
    expect(verdict.ambiguities.length).toBeGreaterThan(0);
  });

  it('flags approaching bound when fidelity is close to the floor', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-replay-close',
      samples: [
        sample(),
        sample({ replayFidelity: 0.78, recordedAt: '2026-05-04T00:00:00.000Z' }),
        sample({ replayFidelity: 0.77, recordedAt: '2026-05-08T00:00:00.000Z' }),
      ],
    });

    const verdict = evaluateReplayDegradationBound({ trajectory });
    expect(verdict.status).toBe('APPROACHING_BOUND');
    expect(verdict.bounded).toBe(true);
    expect(verdict.failClosed).toBe(false);
  });
});

describe('institutional fatigue', () => {
  it('detects fatigue when most raised signals are suppressed', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-fatigue',
      samples: [
        sample({ recordedAt: '2026-05-01T00:00:00.000Z', ambiguityVisibility: 0.9 }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z', ambiguityVisibility: 0.6 }),
        sample({ recordedAt: '2026-05-08T00:00:00.000Z', ambiguityVisibility: 0.2 }),
      ],
    });

    const verdict = evaluateInstitutionalFatigue({
      trajectory,
      raisedSignals: 12,
      surfacedSignals: 0,
    });

    expect(verdict.fatigueDetected).toBe(true);
    expect(verdict.suppressionMasked).toBe(true);
    expect(verdict.suppressionRatio).toBe(1);
    expect(verdict.basis.length).toBeGreaterThanOrEqual(2);
    expect(verdict.ambiguities).toEqual(expect.arrayContaining([
      expect.stringContaining('Institutional fatigue indicators detected'),
      expect.stringContaining('suppression itself is the escalation event'),
    ]));
  });

  it('reports no fatigue when signals surface and ambiguity is preserved', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-no-fatigue',
      samples: [sample(), sample(), sample()],
    });

    const verdict = evaluateInstitutionalFatigue({
      trajectory,
      raisedSignals: 5,
      surfacedSignals: 5,
    });

    expect(verdict.fatigueDetected).toBe(false);
    expect(verdict.suppressionMasked).toBe(false);
  });
});

describe('drift escalation semantics', () => {
  it('escalates to FAIL_CLOSED when replay containment fires', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-escalate',
      samples: [
        sample(),
        sample(),
        sample({ replayFidelity: 0.3 }),
      ],
    });
    const normalization = detectDriftNormalization({ trajectory });
    const decay = evaluateDriftDecayBoundaries({ trajectory });
    const replayBound = evaluateReplayDegradationBound({ trajectory });
    const fatigue = evaluateInstitutionalFatigue({ trajectory, raisedSignals: 0, surfacedSignals: 0 });

    const step = escalateDrift({
      previousState: 'STABLE',
      normalization,
      decay,
      replayBound,
      fatigue,
      evidenceRefs: ['runbook', 'capsule'],
    });

    expect(step.nextState).toBe('FAIL_CLOSED');
    expect(step.failClosed).toBe(true);
    expect(step.triggers).toEqual(expect.arrayContaining(['replay_degradation_unbounded']));
    expect(step.ambiguities.length).toBeGreaterThan(0);
  });

  it('refuses to escalate without evidence references', () => {
    const trajectory = buildDriftTrajectory({
      trajectoryId: 'traj-no-evidence',
      samples: [
        sample({ governanceIntegrity: 0.95, evidenceCohesion: 0.94 }),
        sample({ governanceIntegrity: 0.86, evidenceCohesion: 0.85, recordedAt: '2026-05-04T00:00:00.000Z' }),
        sample({ governanceIntegrity: 0.78, evidenceCohesion: 0.78, recordedAt: '2026-05-08T00:00:00.000Z' }),
      ],
    });
    const normalization = detectDriftNormalization({ trajectory });
    const decay = evaluateDriftDecayBoundaries({ trajectory });
    const replayBound = evaluateReplayDegradationBound({ trajectory });
    const fatigue = evaluateInstitutionalFatigue({ trajectory, raisedSignals: 0, surfacedSignals: 0 });

    const step = escalateDrift({
      previousState: 'STABLE',
      normalization,
      decay,
      replayBound,
      fatigue,
      evidenceRefs: [],
    });

    expect(step.nextState).toBe('FAIL_CLOSED');
    expect(step.failClosed).toBe(true);
    expect(step.blockers).toContain('Drift escalation requires at least one evidence reference.');
  });

  it('produces deterministic step hashes', () => {
    const snapshot1 = buildDriftContainmentSnapshot({
      trajectoryId: 'snap-1',
      samples: [sample(), sample(), sample()],
      evidenceRefs: ['runbook'],
    });
    const snapshot2 = buildDriftContainmentSnapshot({
      trajectoryId: 'snap-1',
      samples: [sample(), sample(), sample()],
      evidenceRefs: ['runbook'],
    });
    expect(snapshot1.escalation.stepHash).toBe(snapshot2.escalation.stepHash);
    expect(snapshot1.trajectory.trajectoryHash).toBe(snapshot2.trajectory.trajectoryHash);
  });
});

describe('drift chaos simulations', () => {
  it('surfaces every drift containment scenario except the baseline', () => {
    const result = runDriftChaosSimulations({});

    expect(result.summary.totalScenarios).toBe(6);
    const baseline = result.verdicts.find((v) => v.scenario === 'BASELINE');
    expect(baseline?.signalSurfaced).toBe(true);
    expect(baseline?.escalationState).toBe('STABLE');

    for (const scenario of ['SLOW_NORMALIZATION', 'DECAY_BOUNDARY_BREACH', 'REPLAY_BOUND_BREACH', 'INSTITUTIONAL_FATIGUE', 'AMBIGUITY_SUPPRESSION'] as const) {
      const verdict = result.verdicts.find((v) => v.scenario === scenario);
      expect(verdict?.signalSurfaced).toBe(true);
      expect(verdict?.escalationState).not.toBe('STABLE');
    }
  });

  it('replay bound breach drives escalation to FAIL_CLOSED', () => {
    const result = runDriftChaosSimulations({});
    const replayBreach = result.verdicts.find((v) => v.scenario === 'REPLAY_BOUND_BREACH');
    expect(replayBreach?.escalationState).toBe('FAIL_CLOSED');
  });
});

describe('drift containment gate', () => {
  it('passes when trajectory is healthy, evidence is present, and no escalation triggers fire', () => {
    const snapshot = buildDriftContainmentSnapshot({
      trajectoryId: 'snap-pass',
      samples: [
        sample({ recordedAt: '2026-05-01T00:00:00.000Z' }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z' }),
        sample({ recordedAt: '2026-05-08T00:00:00.000Z' }),
      ],
      raisedSignals: 5,
      surfacedSignals: 5,
      evidenceRefs: ['runbook'],
    });

    const verdict = evaluateDriftContainmentGate({ snapshot });
    expect(verdict.pass).toBe(true);
    expect(verdict.failedGateIds).toEqual([]);
  });

  it('fails when trajectory cannot reconstruct institutional decay', () => {
    const snapshot = buildDriftContainmentSnapshot({
      trajectoryId: 'snap-fail-evidence',
      samples: [
        sample({ recordedAt: '2026-05-01T00:00:00.000Z', evidenceRefs: [] }),
        sample({ recordedAt: '2026-05-04T00:00:00.000Z', evidenceRefs: [] }),
        sample({ recordedAt: '2026-05-08T00:00:00.000Z', evidenceRefs: [] }),
      ],
      evidenceRefs: ['runbook'],
    });

    const verdict = evaluateDriftContainmentGate({ snapshot });
    expect(verdict.pass).toBe(false);
    expect(verdict.failedGateIds).toContain('institutional_decay_reconstructable');
  });
});
