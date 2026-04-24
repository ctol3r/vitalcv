import { SourceStatus } from '../../../../../../../packages/trust-contract/src/index';
import {
  evaluateAcceptanceGraph,
  predictAcceptance,
  type OrganizationRequirements,
} from '../acceptanceGraph';
import type { StoredDecisionCapsule } from '../decisionCapsuleLearning';

describe('acceptanceGraph', () => {
  const org: OrganizationRequirements = {
    orgId: 'org-1',
    name: 'General Hospital',
    rules: [
      { claimType: 'identity.name', requiredFreshnessMs: 30 * 86400000, isCritical: true },
      { claimType: 'oig.exclusion', requiredFreshnessMs: 30 * 86400000, isCritical: true },
      { claimType: 'pecos.enrollment', requiredFreshnessMs: 90 * 86400000, isCritical: false },
    ],
  };

  const matchingCapsules: StoredDecisionCapsule[] = [
    {
      capsuleId: 'cap-1',
      hash: 'a'.repeat(64),
      payload: {
        clinicianId: '1003000126',
        orgId: 'org-1',
        role: 'RN',
        recognitionState: 'DECISION_GRADE',
        acceptanceState: 'PROCEED',
        startabilityState: 'READY_TO_START',
        blockers: [],
        outcome: 'ACCEPTED',
        timestamp: '2026-04-22T12:00:00.000Z',
      },
    },
    {
      capsuleId: 'cap-2',
      hash: 'b'.repeat(64),
      payload: {
        clinicianId: '1003000126',
        orgId: 'org-1',
        role: 'RN',
        recognitionState: 'DECISION_GRADE',
        acceptanceState: 'PROCEED',
        startabilityState: 'READY_TO_START',
        blockers: [],
        outcome: 'STARTED',
        timestamp: '2026-04-22T13:00:00.000Z',
      },
    },
    {
      capsuleId: 'cap-3',
      hash: 'c'.repeat(64),
      payload: {
        clinicianId: '1003000126',
        orgId: 'org-2',
        role: 'RN',
        recognitionState: 'DECISION_GRADE',
        acceptanceState: 'PROCEED',
        startabilityState: 'READY_TO_START',
        blockers: [],
        outcome: 'REJECTED',
        timestamp: '2026-04-22T14:00:00.000Z',
      },
    },
  ];

  test('forces explicit adverse evidence to an unlikely acceptance prediction', () => {
    const state = evaluateAcceptanceGraph(
      org,
      [
        { type: 'identity.name', id: 'claim-1', status: SourceStatus.CHECKED, ageMs: 1000 },
        { type: 'oig.exclusion', id: 'claim-2', status: SourceStatus.BLOCKED_SIGNAL, ageMs: 1000 },
      ],
      matchingCapsules,
    );
    const prediction = predictAcceptance(state);

    expect(state.blockers).toHaveLength(1);
    expect(prediction.score).toBe(0);
    expect(prediction.band).toBe('UNLIKELY_TO_ACCEPT');
    expect(prediction.explanation).toMatch(/adverse signal/i);
  });

  test('treats an expired DEA as a non-overridable hard blocker', () => {
    const state = evaluateAcceptanceGraph(
      {
        ...org,
        rules: [
          ...org.rules,
          { claimType: 'identity.dea_registration', requiredFreshnessMs: 30 * 86400000, isCritical: true },
        ],
      },
      [
        { type: 'identity.name', id: 'claim-1', status: SourceStatus.CHECKED, ageMs: 1000 },
        {
          type: 'identity.dea_registration',
          id: 'claim-dea',
          status: SourceStatus.CHECKED,
          ageMs: 1000,
          hardBlockReason: 'EXPIRED_DEA',
        },
      ],
      matchingCapsules,
    );
    const prediction = predictAcceptance(state);

    expect(state.blockers).toHaveLength(1);
    expect(state.blockers[0]?.detail).toMatch(/DEA registration is expired/i);
    expect(prediction.score).toBe(0);
    expect(prediction.band).toBe('UNLIKELY_TO_ACCEPT');
  });

  test('treats an expired license as a non-overridable hard blocker', () => {
    const state = evaluateAcceptanceGraph(
      {
        ...org,
        rules: [
          ...org.rules,
          { claimType: 'identity.state_license', requiredFreshnessMs: 30 * 86400000, isCritical: true },
        ],
      },
      [
        { type: 'identity.name', id: 'claim-1', status: SourceStatus.CHECKED, ageMs: 1000 },
        {
          type: 'identity.state_license',
          id: 'claim-license',
          status: SourceStatus.CHECKED,
          ageMs: 1000,
          hardBlockReason: 'EXPIRED_LICENSE',
        },
      ],
      matchingCapsules,
    );
    const prediction = predictAcceptance(state);

    expect(state.blockers).toHaveLength(1);
    expect(state.blockers[0]?.detail).toMatch(/license is expired/i);
    expect(prediction.score).toBe(0);
    expect(prediction.band).toBe('UNLIKELY_TO_ACCEPT');
  });

  test('returns the same acceptance prediction for the same evaluated graph', () => {
    const state = evaluateAcceptanceGraph(
      org,
      [
        { type: 'identity.name', id: 'claim-1', status: SourceStatus.CHECKED, ageMs: 1000 },
        { type: 'oig.exclusion', id: 'claim-2', status: SourceStatus.CHECKED, ageMs: 1000 },
        { type: 'pecos.enrollment', id: 'claim-3', status: SourceStatus.CHECKED, ageMs: 1000 },
      ],
      matchingCapsules,
    );

    expect(predictAcceptance(state)).toEqual(predictAcceptance(state));
  });

  test('caps inferred acceptance at 0.8 until all requirements are validated', () => {
    const state = evaluateAcceptanceGraph(
      org,
      [
        { type: 'identity.name', id: 'claim-1', status: SourceStatus.CHECKED, ageMs: 1000 },
        { type: 'oig.exclusion', id: 'claim-2', status: SourceStatus.CHECKED, ageMs: 1000 },
      ],
      matchingCapsules,
    );
    const prediction = predictAcceptance(state);

    expect(state.historicalCapsuleCount).toBe(2);
    expect(state.historicalAcceptanceRate).toBe(1);
    expect(prediction.score).toBeLessThanOrEqual(0.8);
    expect(prediction.missingRequirementCount).toBe(1);
    expect(prediction.band).toBe('LIKELY_TO_ACCEPT');
  });

  test('only counts matching-org historical capsules in the acceptance history', () => {
    const state = evaluateAcceptanceGraph(
      org,
      [
        { type: 'identity.name', id: 'claim-1', status: SourceStatus.CHECKED, ageMs: 1000 },
        { type: 'oig.exclusion', id: 'claim-2', status: SourceStatus.CHECKED, ageMs: 1000 },
        { type: 'pecos.enrollment', id: 'claim-3', status: SourceStatus.CHECKED, ageMs: 1000 },
      ],
      matchingCapsules,
    );
    const prediction = predictAcceptance(state);

    expect(state.historicalCapsuleCount).toBe(2);
    expect(state.historicalAcceptanceRate).toBe(1);
    expect(prediction.score).toBeGreaterThan(0.8);
    expect(prediction.band).toBe('LIKELY_TO_ACCEPT');
  });
});
