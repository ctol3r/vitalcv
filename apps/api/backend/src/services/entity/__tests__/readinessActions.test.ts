import { buildReadinessNextActions } from '../readinessActions';

describe('readinessActions', () => {
  it('prioritizes blocking next steps before passive refresh work', () => {
    const actions = buildReadinessNextActions({
      missingBlockingDomains: ['LICENSURE'],
      blockers: ['Proof missing: LICENSURE', 'Expired credentials'],
      gaps: ['Stale: EXCLUSION_CHECK'],
    });

    expect(actions.map((action) => action.id)).toEqual([
      'refresh-licensure',
      'repair-proof-chain',
      'renew-expired-credentials',
      'refresh-stale-data',
    ]);
  });

  it('returns a share action when no blockers remain', () => {
    const actions = buildReadinessNextActions({
      missingBlockingDomains: [],
      blockers: [],
      gaps: [],
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: 'share-ready-passport',
        priority: 'LOW',
      }),
    ]);
  });

  it('generates distinct PECOS actions for not-found versus unresolved enrollment', () => {
    const notFound = buildReadinessNextActions({
      missingBlockingDomains: [],
      blockers: ['Medicare enrollment not found — submit PECOS enrollment (45–60 days)'],
      gaps: [],
      pecosEnrollmentStatus: 'NOT_FOUND',
    });
    const unknown = buildReadinessNextActions({
      missingBlockingDomains: [],
      blockers: [],
      gaps: ['PECOS enrollment outcome unresolved'],
      pecosEnrollmentStatus: 'UNKNOWN',
    });

    expect(notFound.map((action) => action.id)).toContain('submit-pecos-enrollment');
    expect(unknown.map((action) => action.id)).toContain('verify-medicare-enrollment');
  });
});
