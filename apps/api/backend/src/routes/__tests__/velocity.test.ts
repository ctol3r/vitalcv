import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    workspaceMembership: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../services/velocity/velocityEngine', () => ({
  computeVelocityMetrics: jest.fn(),
  computeOrganizationVelocityMetrics: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import {
  computeOrganizationVelocityMetrics,
  computeVelocityMetrics,
} from '../../services/velocity/velocityEngine';
import { registerVelocityRoutes } from '../velocity';

const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
  workspaceMembership: { findFirst: jest.Mock };
};

const velocityMock = {
  computeVelocityMetrics: computeVelocityMetrics as jest.Mock,
  computeOrganizationVelocityMetrics: computeOrganizationVelocityMetrics as jest.Mock,
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerVelocityRoutes(app);
  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Unknown error' });
  });
  return app;
}

describe('velocity routes', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.workspaceMembership.findFirst.mockReset();
    velocityMock.computeVelocityMetrics.mockReset();
    velocityMock.computeOrganizationVelocityMetrics.mockReset();
  });

  it('returns public system-only velocity metrics', async () => {
    velocityMock.computeVelocityMetrics.mockResolvedValue({
      scope: 'system',
      avgTimeToStartDays: 8,
      timeToStartSampleSize: 3,
      industryAvgDays: 94,
      compressionRatio: 11.75,
      credentialReadinessRate: 0.5,
      monitoringCoverageRate: 0.6,
      verificationReuseRate: 0.7,
      totalApplications: 10,
      totalAccepted: 4,
      totalDecisionCapsules: 5,
      trend: [],
      readinessDistribution: [],
      verificationReuseEvents: [],
      monitoringAlerts: [],
      startAccelerationEstimates: [],
      computedAt: '2026-03-13T00:00:00.000Z',
    });

    const response = await request(createApp())
      .get('/api/velocity')
      .expect(200);

    expect(response.body.scope).toBe('system');
    expect(response.body.byOrganization).toBeUndefined();
    expect(response.headers['x-cache']).toBe('MISS');
  });

  it('rejects org drilldown requests from users outside the organization', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      organizationId: 'other-org',
    });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue(null);

    const response = await request(createApp())
      .get('/api/velocity/org-secure')
      .set('x-clerk-user-id', 'clerk-user-1')
      .expect(403);

    expect(response.body.error).toContain('access');
    expect(velocityMock.computeOrganizationVelocityMetrics).not.toHaveBeenCalled();
  });

  it('returns org drilldown metrics for authorized users', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
    });
    velocityMock.computeOrganizationVelocityMetrics.mockResolvedValue({
      scope: 'organization',
      organization: {
        organizationId: 'org-1',
        organizationName: 'Org One',
      },
      avgTimeToStartDays: 9,
      timeToStartSampleSize: 2,
      industryAvgDays: 94,
      compressionRatio: 10.44,
      credentialReadinessRate: 0.8,
      monitoringCoverageRate: 0.6,
      verificationReuseRate: 0.5,
      totalApplications: 7,
      totalAccepted: 3,
      totalDecisionCapsules: 2,
      trend: [],
      readinessDistribution: [],
      verificationReuseEvents: [],
      monitoringAlerts: [],
      startAccelerationEstimates: [],
      computedAt: '2026-03-13T00:00:00.000Z',
      systemComparison: {
        avgTimeToStartDays: 8,
        timeToStartSampleSize: 4,
        credentialReadinessRate: 0.7,
        monitoringCoverageRate: 0.5,
        verificationReuseRate: 0.4,
      },
    });

    const response = await request(createApp())
      .get('/api/velocity/org-1')
      .set('x-clerk-user-id', 'clerk-user-1')
      .expect(200);

    expect(response.body.organization.organizationName).toBe('Org One');
    expect(response.body.systemComparison.avgTimeToStartDays).toBe(8);
    expect(velocityMock.computeOrganizationVelocityMetrics).toHaveBeenCalledWith('org-1');
  });
});
