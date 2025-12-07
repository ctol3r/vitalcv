import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { runDailyAnalyticsRollup, type AnalyticsPrisma } from '../dailyRollup';

const mockClient = {
  application: { findMany: jest.fn() },
  privilegeGranted: { findMany: jest.fn() },
  payerEnrollment: { findMany: jest.fn() },
  ehrFacadeAudit: { findMany: jest.fn() },
  analyticsEvent: { findMany: jest.fn() },
  analyticsDailyRollup: { upsert: jest.fn() },
} satisfies AnalyticsPrisma;

describe('runDailyAnalyticsRollup', () => {
  beforeEach(() => {
    Object.values(mockClient).forEach((model: any) => {
      if (model.findMany) model.findMany.mockReset();
      if (model.upsert) model.upsert.mockReset();
    });
  });

  it('aggregates metrics per org and global bucket', async () => {
    mockClient.application.findMany.mockResolvedValue([
      { job: { partnerId: 'org-1' } },
      { job: { partnerId: 'org-2' } },
    ]);
    mockClient.privilegeGranted.findMany.mockResolvedValue([{ orgId: 'org-1' }]);
    mockClient.payerEnrollment.findMany.mockResolvedValue([{ orgId: 'org-1' }]);
    mockClient.ehrFacadeAudit.findMany.mockResolvedValue([{ orgId: 'org-2' }]);
    mockClient.analyticsEvent.findMany
      .mockResolvedValueOnce([{ orgId: 'org-1' }]) // PsvCompleted
      .mockResolvedValueOnce([{ orgId: 'org-2' }]); // PrivilegeApproved

    mockClient.analyticsDailyRollup.upsert.mockResolvedValue({});

    await runDailyAnalyticsRollup(new Date('2025-11-14T12:00:00Z'), mockClient);

    expect(mockClient.analyticsDailyRollup.upsert).toHaveBeenCalledTimes(3);

    const payloads = mockClient.analyticsDailyRollup.upsert.mock.calls.map(
      (call) => call[0]
    );

    const org1 = payloads.find((entry) => entry.where.date_orgId.orgId === 'org-1');
    const org2 = payloads.find((entry) => entry.where.date_orgId.orgId === 'org-2');
    const global = payloads.find((entry) => entry.where.date_orgId.orgId === null);

    expect(org1?.create).toMatchObject({
      applications: 1,
      privilegesGranted: 1,
      payerEnrollments: 1,
      verifications: 1,
    });

    expect(org2?.create).toMatchObject({
      applications: 1,
      ehrFetches: 1,
      vcsIssued: 1,
    });

    expect(global?.create).toMatchObject({
      applications: 2,
      privilegesGranted: 1,
      verifications: 1,
      payerEnrollments: 1,
      ehrFetches: 1,
      vcsIssued: 1,
    });
  });

  it('handles empty datasets by still writing zeros for global scope', async () => {
    mockClient.application.findMany.mockResolvedValue([]);
    mockClient.privilegeGranted.findMany.mockResolvedValue([]);
    mockClient.payerEnrollment.findMany.mockResolvedValue([]);
    mockClient.ehrFacadeAudit.findMany.mockResolvedValue([]);
    mockClient.analyticsEvent.findMany.mockResolvedValue([]);
    mockClient.analyticsDailyRollup.upsert.mockResolvedValue({});

    await runDailyAnalyticsRollup(new Date('2025-11-14T12:00:00Z'), mockClient);

    expect(mockClient.analyticsDailyRollup.upsert).toHaveBeenCalledTimes(1);
    const call = mockClient.analyticsDailyRollup.upsert.mock.calls[0][0];
    expect(call.where.date_orgId.orgId).toBeNull();
    expect(call.create).toMatchObject({
      applications: 0,
      privilegesGranted: 0,
      verifications: 0,
      payerEnrollments: 0,
      ehrFetches: 0,
      vcsIssued: 0,
    });
  });
});


