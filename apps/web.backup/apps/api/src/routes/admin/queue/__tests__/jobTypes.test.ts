import request from 'supertest';
import express from 'express';
import router from '../jobTypes.js';

const listQueueRoutesMock = jest.fn();
const dlqGroupByMock = jest.fn();
const jobQueueFindManyMock = jest.fn();

jest.mock('../../../../../../services/queue/router.js', () => ({
  listQueueRoutes: (...args: unknown[]) => listQueueRoutesMock(...args),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    dLQJobQueue: {
      groupBy: (...args: unknown[]) => dlqGroupByMock(...args),
    },
    jobQueue: {
      findMany: (...args: unknown[]) => jobQueueFindManyMock(...args),
    },
  })),
}));

describe('admin queue job-types route', () => {
  function buildApp() {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'admin', roles: ['ADMIN'] };
      next();
    });
    app.use(router);
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    listQueueRoutesMock.mockReturnValue([
      {
        type: 'FUSION_UPDATE',
        description: 'fusion',
        category: 'fusion',
        concurrency: { mode: 'global', limit: 2 },
        schema: {},
        handler: jest.fn(),
        critical: true,
      },
    ]);

    dlqGroupByMock.mockResolvedValue([{ type: 'FUSION_UPDATE', _count: { _all: 2 } }]);
    jobQueueFindManyMock.mockResolvedValue([
      {
        id: 'job-1',
        type: 'FUSION_UPDATE',
        status: 'FAILED',
        attempts: 3,
        lastError: 'boom',
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);
  });

  it('returns job metadata with DLQ count and last errors', async () => {
    const app = buildApp();
    const response = await request(app).get('/job-types');

    expect(response.status).toBe(200);
    expect(response.body.jobTypes).toHaveLength(1);
    expect(response.body.jobTypes[0]).toMatchObject({
      type: 'FUSION_UPDATE',
      dlqCount: 2,
      lastErrors: [
        expect.objectContaining({
          id: 'job-1',
          message: 'boom',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
      ],
    });
  });
});

