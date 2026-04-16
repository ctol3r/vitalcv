import {
  computeDecisionCapsuleLearningSignals,
  computeDeterministicLearningSignals,
} from '../learningSignalsService';

describe('learningSignalsService', () => {
  it('computes deterministic learning functions with bounded probability and weighted time adjustments', () => {
    const result = computeDeterministicLearningSignals({
      capsules: [
        {
          decisionTimestamp: '2026-04-01T00:00:00.000Z',
          decisionAction: 'APPROVE',
          metadata: {
            acceptanceId: 'accept-1',
            blockers: ['DEA_REGISTRATION', 'LICENSURE'],
          },
        },
        {
          decisionTimestamp: '2026-04-05T00:00:00.000Z',
          decisionAction: 'REJECT',
          metadata: {
            blockers: ['LICENSURE'],
          },
        },
        {
          decisionTimestamp: '2026-04-08T00:00:00.000Z',
          decisionAction: 'START_ATTESTATION',
          metadata: {
            acceptanceId: 'accept-1',
            startedAt: '2026-04-08T00:00:00.000Z',
          },
        },
        {
          decisionTimestamp: '2026-04-03T00:00:00.000Z',
          metadata: {
            outcome: 'ACCEPTED',
            acceptanceId: 'accept-2',
            topBlockers: ['DEA_REGISTRATION'],
          },
        },
        {
          decisionTimestamp: '2026-04-06T00:00:00.000Z',
          decisionAction: 'START_ATTESTATION',
          metadata: {
            acceptanceId: 'accept-2',
            startedAt: '2026-04-06T00:00:00.000Z',
          },
        },
      ],
      base_acceptance: 0.5,
      base_startability: 8,
    });

    expect(result).toEqual({
      sample_size: 3,
      acceptance_rate: 0.6667,
      avg_days: 5,
      blocker_frequency: [
        { blocker: 'DEA_REGISTRATION', count: 2, frequency: 0.6667 },
        { blocker: 'LICENSURE', count: 2, frequency: 0.6667 },
      ],
      probability_adjustment: {
        adjusted_acceptance: 0.6667,
        bounded_delta: 0.1667,
      },
      time_adjustment: {
        adjusted_days: 7.1,
        blend_weight: 0.3,
      },
      explainability: {
        acceptance: {
          considered_decisions: 3,
          accepted_decisions: 2,
          formula: 'accepted_decisions / considered_decisions',
        },
        avg_days: {
          matched_start_count: 2,
          formula: 'sum(day_deltas) / matched_start_count',
        },
        blocker_frequency: {
          denominator: 3,
          formula: 'blocker_count / sample_size',
        },
        probability_adjustment: {
          base_acceptance: 0.5,
          observed_acceptance_rate: 0.6667,
          raw_delta: 0.1667,
          bounded_delta: 0.1667,
          max_abs_delta: 0.2,
          formula: 'clamp(observed_acceptance_rate - base_acceptance, -max_abs_delta, max_abs_delta)',
        },
        time_adjustment: {
          base_startability: 8,
          observed_avg_days: 5,
          blend_weight: 0.3,
          sample_cap: 10,
          formula: 'base_startability * (1 - blend_weight) + observed_avg_days * blend_weight',
        },
      },
    });
  });

  it('computes simple deterministic learning signals from decision capsules', () => {
    const signals = computeDecisionCapsuleLearningSignals([
      {
        decisionTimestamp: '2026-04-01T00:00:00.000Z',
        decisionAction: 'APPROVE',
        metadata: {
          acceptanceId: 'accept-1',
          blockers: ['DEA_REGISTRATION', 'LICENSURE'],
        },
      },
      {
        decisionTimestamp: '2026-04-05T00:00:00.000Z',
        decisionAction: 'REJECT',
        metadata: {
          blockers: ['LICENSURE'],
        },
      },
      {
        decisionTimestamp: '2026-04-08T00:00:00.000Z',
        decisionAction: 'START_ATTESTATION',
        metadata: {
          acceptanceId: 'accept-1',
          startedAt: '2026-04-08T00:00:00.000Z',
        },
      },
      {
        decisionTimestamp: '2026-04-03T00:00:00.000Z',
        metadata: {
          outcome: 'ACCEPTED',
          acceptanceId: 'accept-2',
          topBlockers: ['DEA_REGISTRATION'],
        },
      },
      {
        decisionTimestamp: '2026-04-06T00:00:00.000Z',
        decisionAction: 'START_ATTESTATION',
        metadata: {
          acceptanceId: 'accept-2',
          startedAt: '2026-04-06T00:00:00.000Z',
        },
      },
    ]);

    expect(signals).toEqual({
      acceptance_rate: 0.6667,
      avg_days_to_start: 5,
      common_blockers: [
        { blocker: 'DEA_REGISTRATION', count: 2 },
        { blocker: 'LICENSURE', count: 2 },
      ],
    });
  });

  it('bounds probability adjustment and falls back to observed days when no base startability exists', () => {
    const result = computeDeterministicLearningSignals({
      capsules: [
        {
          decisionTimestamp: '2026-04-01T00:00:00.000Z',
          decisionAction: 'APPROVE',
          metadata: {
            acceptanceId: 'accept-1',
          },
        },
        {
          decisionTimestamp: '2026-04-02T00:00:00.000Z',
          decisionAction: 'APPROVE',
          metadata: {
            acceptanceId: 'accept-2',
          },
        },
        {
          decisionTimestamp: '2026-04-03T00:00:00.000Z',
          decisionAction: 'APPROVE',
          metadata: {
            acceptanceId: 'accept-3',
          },
        },
        {
          decisionTimestamp: '2026-04-06T00:00:00.000Z',
          decisionAction: 'START_ATTESTATION',
          metadata: {
            acceptanceId: 'accept-1',
            startedAt: '2026-04-06T00:00:00.000Z',
          },
        },
      ],
      base_acceptance: 0.1,
      base_startability: null,
    });

    expect(result.probability_adjustment).toEqual({
      adjusted_acceptance: 0.3,
      bounded_delta: 0.2,
    });
    expect(result.time_adjustment).toEqual({
      adjusted_days: 5,
      blend_weight: 1,
    });
  });

  it('returns stable empty signals when no deterministic samples exist', () => {
    const signals = computeDecisionCapsuleLearningSignals([
      {
        decisionTimestamp: '2026-04-01T00:00:00.000Z',
        decisionAction: 'START_ATTESTATION',
        metadata: {
          acceptanceId: 'accept-1',
        },
      },
      {
        decisionTimestamp: 'invalid-date',
        metadata: {
          blockers: ['MANUAL_REVIEW'],
        },
      },
    ]);

    expect(signals).toEqual({
      acceptance_rate: 0,
      avg_days_to_start: null,
      common_blockers: [
        { blocker: 'MANUAL_REVIEW', count: 1 },
      ],
    });
  });

  it('sorts common blockers deterministically when counts tie', () => {
    const signals = computeDecisionCapsuleLearningSignals([
      {
        decisionTimestamp: '2026-04-01T00:00:00.000Z',
        metadata: { blockers: ['Z_BLOCKER'] },
      },
      {
        decisionTimestamp: '2026-04-02T00:00:00.000Z',
        metadata: { blockers: ['A_BLOCKER'] },
      },
    ]);

    expect(signals.common_blockers).toEqual([
      { blocker: 'A_BLOCKER', count: 1 },
      { blocker: 'Z_BLOCKER', count: 1 },
    ]);
  });
});
