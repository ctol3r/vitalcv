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
});
