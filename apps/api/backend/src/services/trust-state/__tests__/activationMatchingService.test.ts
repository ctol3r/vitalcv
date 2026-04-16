import { matchActivationRequirements } from '../activationMatchingService';

describe('activationMatchingService', () => {
  it('returns satisfied units and zero remaining days when all required units are met', () => {
    const result = matchActivationRequirements({
      acceptanceOutput: {
        auditEventId: 'audit-1',
        attribution: { organizationId: 'org-1' },
        persistence: { acceptanceId: 'accept-1' },
        acceptance: {
          acceptedByOrgId: 'org-1',
          acceptedAt: '2026-04-15T12:00:00.000Z',
          acceptanceScope: 'full',
        },
        trustSnapshot: {
          readinessScore: 88,
          blockerCount: 0,
          topBlockers: [],
        },
      },
      activationRequirements: [
        { unit: 'acceptance_recorded', estimatedDays: 0 },
        { unit: 'audit_logged', estimatedDays: 0 },
        { unit: 'organization_bound', estimatedDays: 0 },
        { unit: 'accepted_timestamped', estimatedDays: 0 },
        { unit: 'trust_snapshot_captured', estimatedDays: 0 },
        { unit: 'start_ready', minimumScore: 80, estimatedDays: 0 },
        { unit: 'acceptance_scope_is', expectedScope: 'full', estimatedDays: 0 },
      ],
    });

    expect(result.blockers).toEqual([]);
    expect(result.estimated_days_to_start).toBe(0);
    expect(result.satisfiedUnits.map((unit) => unit.unit)).toEqual([
      'acceptance_recorded',
      'audit_logged',
      'organization_bound',
      'accepted_timestamped',
      'trust_snapshot_captured',
      'start_ready',
      'acceptance_scope_is',
    ]);
  });

  it('fails closed when required activation units are missing', () => {
    const result = matchActivationRequirements({
      acceptanceOutput: {
        auditEventId: null,
        attribution: { organizationId: null },
        persistence: { acceptanceId: null },
        acceptance: {
          acceptedByOrgId: null,
          acceptedAt: null,
          acceptanceScope: 'pilot',
        },
        trustSnapshot: null,
      },
      activationRequirements: [
        { unit: 'acceptance_recorded', estimatedDays: 1 },
        { unit: 'organization_bound', estimatedDays: 2 },
        { unit: 'trust_snapshot_captured', estimatedDays: 1 },
      ],
    });

    expect(result.satisfiedUnits).toEqual([]);
    expect(result.blockers).toEqual([
      {
        unit: 'acceptance_recorded',
        label: 'Acceptance recorded',
        detail: 'Acceptance output does not include a persisted acceptance ID.',
        estimatedDays: 1,
      },
      {
        unit: 'organization_bound',
        label: 'Organization bound',
        detail: 'Acceptance output is not bound to an organization.',
        estimatedDays: 2,
      },
      {
        unit: 'trust_snapshot_captured',
        label: 'Trust snapshot captured',
        detail: 'Acceptance output does not include a trust snapshot.',
        estimatedDays: 1,
      },
    ]);
    expect(result.estimated_days_to_start).toBe(4);
  });

  it('blocks start_ready when score is below threshold or blockers remain', () => {
    const result = matchActivationRequirements({
      acceptanceOutput: {
        trustSnapshot: {
          readinessScore: 72,
          blockerCount: 2,
          topBlockers: ['License expired'],
        },
      },
      activationRequirements: [
        { unit: 'start_ready', minimumScore: 80, estimatedDays: 5 },
      ],
    });

    expect(result.satisfiedUnits).toEqual([]);
    expect(result.blockers).toEqual([
      {
        unit: 'start_ready',
        label: 'Start ready',
        detail: 'Readiness score 72 is below the required threshold 80.',
        estimatedDays: 5,
      },
    ]);
    expect(result.estimated_days_to_start).toBe(5);
  });

  it('returns null estimated_days_to_start when any blocking unit lacks a deterministic estimate', () => {
    const result = matchActivationRequirements({
      acceptanceOutput: {
        trustSnapshot: {
          readinessScore: 78,
          blockerCount: 0,
        },
      },
      activationRequirements: [
        { unit: 'readiness_score_at_least', minimumScore: 80, estimatedDays: null },
      ],
    });

    expect(result.blockers).toHaveLength(1);
    expect(result.estimated_days_to_start).toBeNull();
  });

  it('is deterministic across repeated calls with identical input', () => {
    const input = {
      acceptanceOutput: {
        auditEventId: 'audit-1',
        persistence: { acceptanceId: 'accept-1' },
        acceptance: {
          acceptedByOrgId: 'org-1',
          acceptedAt: '2026-04-15T12:00:00.000Z',
          acceptanceScope: 'pilot',
        },
        attribution: { organizationId: 'org-1' },
        trustSnapshot: {
          readinessScore: 85,
          blockerCount: 0,
          topBlockers: [],
        },
      },
      activationRequirements: [
        { unit: 'acceptance_recorded', estimatedDays: 0 },
        { unit: 'acceptance_scope_is', expectedScope: 'full', estimatedDays: 3 },
      ],
    } as const;

    const first = matchActivationRequirements(input);
    const second = matchActivationRequirements(input);

    expect(first).toEqual(second);
    expect(first.blockers).toEqual([
      {
        unit: 'acceptance_scope_is',
        label: 'Acceptance scope matched',
        detail: 'Acceptance scope is pilot; expected full.',
        estimatedDays: 3,
      },
    ]);
  });
});
