import { runDailyAnalyticsRollup } from '../analytics/dailyRollup';

describe('runDailyAnalyticsRollup', () => {
  it('aggregates metrics per org and global scope', async () => {
    const upsert = jest.fn().mockResolvedValue(null);
    const mockClient = {
      application: {
        findMany: jest.fn().mockResolvedValue([
          { job: { partnerId: 'org-1' } },
          { job: { partnerId: 'org-1' } },
          { job: { partnerId: 'org-2' } },
        ]),
      },
      privilegeGranted: {
        findMany: jest.fn().mockResolvedValue([
          { orgId: 'org-1' },
        ]),
      },
      payerEnrollment: {
        findMany: jest.fn().mockResolvedValue([
          { orgId: 'org-2' },
        ]),
      },
      ehrFacadeAudit: {
        findMany: jest.fn().mockResolvedValue([
          { orgId: null },
        ]),
      },
      analyticsEvent: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where?.eventType === 'PsvCompleted') {
            return Promise.resolve([
              { orgId: 'org-1' },
              { orgId: null },
            ]);
          }
          if (where?.eventType === 'PrivilegeApproved') {
            return Promise.resolve([
              { orgId: 'org-1' },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      analyticsDailyRollup: {
        upsert,
      },
    } as any;

    const date = new Date('2025-11-14T12:00:00Z');
    await runDailyAnalyticsRollup(date, mockClient);

    expect(upsert).toHaveBeenCalled();
    const org1Call = upsert.mock.calls.find(
      ([args]: any[]) => args.where.date_orgId.orgId === 'org-1'
    );
    expect(org1Call).toBeDefined();
    expect(org1Call[0].create.applications).toBe(2);
    expect(org1Call[0].create.privilegesGranted).toBe(1);
    expect(org1Call[0].create.verifications).toBe(1);
    expect(org1Call[0].create.vcsIssued).toBe(1);

    const org2Call = upsert.mock.calls.find(
      ([args]: any[]) => args.where.date_orgId.orgId === 'org-2'
    );
    expect(org2Call).toBeDefined();
    expect(org2Call[0].create.applications).toBe(1);
    expect(org2Call[0].create.payerEnrollments).toBe(1);

    const globalCall = upsert.mock.calls.find(
      ([args]: any[]) => args.where.date_orgId.orgId === null
    );
    expect(globalCall).toBeDefined();
    expect(globalCall[0].create.applications).toBe(3);
    expect(globalCall[0].create.privilegesGranted).toBe(1);
    expect(globalCall[0].create.verifications).toBe(2);
    expect(globalCall[0].create.ehrFetches).toBe(1);
    expect(globalCall[0].create.payerEnrollments).toBe(1);
    expect(globalCall[0].create.vcsIssued).toBe(1);
  });
});

