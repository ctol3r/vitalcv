jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    opportunity: {
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    application: {
      findMany: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    trustAlertRecord: {
      findMany: jest.fn(),
    },
    decisionCapsule: {
      findMany: jest.fn(),
    },
    startAttestation: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  computeOrganizationVelocityMetrics,
  computeVelocityMetrics,
} from '../velocityEngine';

const prismaMock = prisma as unknown as {
  opportunity: { findMany: jest.Mock };
  organization: { findUnique: jest.Mock };
  application: { findMany: jest.Mock };
  verificationArtifact: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  trustAlertRecord: { findMany: jest.Mock };
  decisionCapsule: { findMany: jest.Mock };
  startAttestation: { findMany: jest.Mock };
};

describe('velocityEngine', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-13T00:00:00Z'));

    prismaMock.opportunity.findMany.mockReset();
    prismaMock.organization.findUnique.mockReset();
    prismaMock.application.findMany.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.verificationArtifact.count.mockReset();
    prismaMock.trustAlertRecord.findMany.mockReset();
    prismaMock.decisionCapsule.findMany.mockReset();
    prismaMock.startAttestation.findMany.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes system metrics from attested starts, trust snapshots, alerts, and reused credentials', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { opportunityId: 'opp-1', status: 'ACCEPTED', npi: '1234567890' },
      { opportunityId: 'opp-2', status: 'PENDING', npi: '2234567890' },
    ]);
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        npi: '1234567890',
        trustState: 'L3',
        rawPayload: null,
        verifiedAt: new Date('2026-03-01T00:00:00Z'),
      },
      {
        npi: '2234567890',
        trustState: 'L1',
        rawPayload: null,
        verifiedAt: new Date('2026-03-02T00:00:00Z'),
      },
    ]);
    prismaMock.verificationArtifact.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prismaMock.trustAlertRecord.findMany.mockResolvedValue([
      { createdAt: new Date('2026-01-15T00:00:00Z') },
    ]);
    prismaMock.decisionCapsule.findMany.mockResolvedValue([
      {
        decisionTimestamp: new Date('2026-02-10T00:00:00Z'),
        credentialIds: ['cred-1'],
        metadata: {},
      },
      {
        decisionTimestamp: new Date('2026-02-25T00:00:00Z'),
        credentialIds: ['cred-1', 'cred-2'],
        metadata: {},
      },
    ]);
    prismaMock.startAttestation.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-02-09T00:00:00Z'),
        acceptance: { acceptedAt: new Date('2026-02-01T00:00:00Z') },
      },
      {
        startedAt: new Date('2026-02-01T00:00:00Z'),
        acceptance: { acceptedAt: new Date('2026-02-02T00:00:00Z') },
      },
    ]);

    const metrics = await computeVelocityMetrics();

    expect(metrics.scope).toBe('system');
    expect(metrics.avgTimeToStartDays).toBe(8);
    expect(metrics.timeToStartSampleSize).toBe(1);
    expect(metrics.insufficientDataReason).toBeUndefined();
    expect(metrics.credentialReadinessRate).toBe(0.5);
    expect(metrics.monitoringCoverageRate).toBe(0.5);
    expect(metrics.verificationReuseRate).toBe(0.5);
    expect(metrics.totalDecisionCapsules).toBe(2);

    const febTrend = metrics.trend.find((point) => point.month === '2026-02');
    expect(febTrend).toEqual({
      month: '2026-02',
      avgDays: 8,
      sampleSize: 1,
    });

    const readinessL3 = metrics.readinessDistribution.find((point) => point.band === 'L3');
    const readinessL1 = metrics.readinessDistribution.find((point) => point.band === 'L1');
    expect(readinessL3).toEqual({ band: 'L3', count: 1, rate: 0.5 });
    expect(readinessL1).toEqual({ band: 'L1', count: 1, rate: 0.5 });

    const febReuse = metrics.verificationReuseEvents.find((point) => point.month === '2026-02');
    const janAlerts = metrics.monitoringAlerts.find((point) => point.month === '2026-01');
    expect(febReuse?.count).toBe(2);
    expect(janAlerts?.count).toBe(1);

    const febAcceleration = metrics.startAccelerationEstimates.find((point) => point.month === '2026-02');
    expect(febAcceleration).toEqual({
      month: '2026-02',
      avgDays: 8,
      daysSaved: 86,
      sampleSize: 1,
    });
  });

  it('returns null time-to-start metrics when there are no attested starts', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { opportunityId: 'opp-1', status: 'ACCEPTED', npi: '1234567890' },
    ]);
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);
    prismaMock.verificationArtifact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.trustAlertRecord.findMany.mockResolvedValue([]);
    prismaMock.decisionCapsule.findMany.mockResolvedValue([]);
    prismaMock.startAttestation.findMany.mockResolvedValue([]);

    const metrics = await computeVelocityMetrics();

    expect(metrics.avgTimeToStartDays).toBeNull();
    expect(metrics.timeToStartSampleSize).toBe(0);
    expect(metrics.insufficientDataReason).toBe('No attested employer starts found for this scope.');
    expect(metrics.compressionRatio).toBeNull();
  });

  it('scopes organization reuse analytics to matched org metadata instead of guessing', async () => {
    prismaMock.opportunity.findMany.mockImplementation(async ({ where }: { where?: { organizationId?: string } }) => (
      where?.organizationId === 'org-1'
        ? [{ id: 'opp-1', organization: { name: 'Org One' } }]
        : []
    ));
    prismaMock.organization.findUnique.mockResolvedValue(null);
    prismaMock.application.findMany.mockImplementation(async ({ where }: { where?: { opportunity?: { organizationId?: string } } }) => {
      if (where?.opportunity?.organizationId === 'org-1') {
        return [
          { opportunityId: 'opp-1', status: 'ACCEPTED', npi: '1234567890' },
          { opportunityId: 'opp-1', status: 'ACCEPTED', npi: '2234567890' },
        ];
      }

      return [
        { opportunityId: 'opp-1', status: 'ACCEPTED', npi: '1234567890' },
        { opportunityId: 'opp-1', status: 'ACCEPTED', npi: '2234567890' },
        { opportunityId: 'opp-9', status: 'ACCEPTED', npi: '3234567890' },
      ];
    });
    prismaMock.verificationArtifact.findMany.mockImplementation(async ({
      where,
    }: {
      where: { npi?: { in?: string[] }; source?: string };
    }) => {
      if (where.source !== 'TRUST_STATE_ENGINE') {
        return [];
      }

      const requested = new Set(where.npi?.in ?? []);
      return [
        { npi: '1234567890', trustState: 'L3', rawPayload: null, verifiedAt: new Date('2026-03-01T00:00:00Z') },
        { npi: '2234567890', trustState: 'L2', rawPayload: null, verifiedAt: new Date('2026-03-02T00:00:00Z') },
        { npi: '3234567890', trustState: 'L1', rawPayload: null, verifiedAt: new Date('2026-03-03T00:00:00Z') },
      ].filter((record) => requested.has(record.npi));
    });
    prismaMock.verificationArtifact.count.mockImplementation(async ({
      where,
    }: {
      where: { npi?: { in?: string[] }; monitoring?: boolean };
    }) => {
      const size = new Set(where.npi?.in ?? []).size;
      if (where.monitoring) {
        return size === 2 ? 1 : 2;
      }
      return size === 2 ? 2 : 3;
    });
    prismaMock.trustAlertRecord.findMany.mockImplementation(async ({
      where,
    }: {
      where: { subject?: { in?: string[] } };
    }) => {
      const size = new Set(where.subject?.in ?? []).size;
      return size === 2
        ? [{ createdAt: new Date('2026-02-01T00:00:00Z') }]
        : [
            { createdAt: new Date('2026-02-01T00:00:00Z') },
            { createdAt: new Date('2026-02-02T00:00:00Z') },
          ];
    });
    prismaMock.decisionCapsule.findMany.mockImplementation(async ({
      where,
    }: {
      where: { subjectNpi?: { in?: string[] } };
    }) => {
      const requested = new Set(where.subjectNpi?.in ?? []);
      return [
        {
          decisionTimestamp: new Date('2026-02-05T00:00:00Z'),
          credentialIds: ['cred-1'],
          metadata: { opportunityId: 'opp-1' },
          subjectNpi: '1234567890',
        },
        {
          decisionTimestamp: new Date('2026-02-07T00:00:00Z'),
          credentialIds: ['cred-1'],
          metadata: { organizationId: 'org-1' },
          subjectNpi: '2234567890',
        },
        {
          decisionTimestamp: new Date('2026-02-09T00:00:00Z'),
          credentialIds: ['cred-1'],
          metadata: { organizationId: 'org-2' },
          subjectNpi: '3234567890',
        },
      ].filter((capsule) => requested.has(capsule.subjectNpi));
    });
    prismaMock.startAttestation.findMany.mockImplementation(async ({
      where,
    }: {
      where?: { acceptance?: { employerId?: string } };
    }) => (
      where?.acceptance?.employerId === 'org-1'
        ? [{
            startedAt: new Date('2026-02-11T00:00:00Z'),
            acceptance: { acceptedAt: new Date('2026-02-01T00:00:00Z') },
          }]
        : [
            {
              startedAt: new Date('2026-02-11T00:00:00Z'),
              acceptance: { acceptedAt: new Date('2026-02-01T00:00:00Z') },
            },
            {
              startedAt: new Date('2026-02-08T00:00:00Z'),
              acceptance: { acceptedAt: new Date('2026-02-03T00:00:00Z') },
            },
          ]
    ));

    const metrics = await computeOrganizationVelocityMetrics('org-1');

    expect(metrics.organization).toEqual({
      organizationId: 'org-1',
      organizationName: 'Org One',
    });
    expect(metrics.avgTimeToStartDays).toBe(10);
    expect(metrics.totalApplications).toBe(2);
    expect(metrics.totalDecisionCapsules).toBe(2);
    expect(metrics.verificationReuseRate).toBe(1);
    expect(metrics.systemComparison.avgTimeToStartDays).toBe(7.5);

    const febReuse = metrics.verificationReuseEvents.find((point) => point.month === '2026-02');
    expect(febReuse?.count).toBe(2);
  });
});
