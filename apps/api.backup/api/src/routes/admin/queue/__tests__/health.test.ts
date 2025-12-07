import request from 'supertest';
import express from 'express';
import router from '../health.js';

const getQueueHealthSnapshotMock = jest.fn();
const recordQueueHealthMock = jest.fn();

jest.mock('../../../../../../services/queue/models/JobQueue.js', () => ({
  getQueueHealthSnapshot: () => getQueueHealthSnapshotMock(),
}));

jest.mock('../../../../../../services/queue/metrics.js', () => ({
  recordQueueHealth: (...args: unknown[]) => recordQueueHealthMock(...args),
}));

describe('admin queue health route', () => {
  function createApp() {
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
  });

  it('returns queue health snapshot and records metrics', async () => {
    const snapshot = {
      running: 2,
      waiting: 5,
      deadLetter: 1,
      avgLatencyMs: 1250,
      latencySampleSize: 3,
      lastErrors: [
        {
          id: 'job-1',
          type: 'EHR_SYNC',
          attempts: 3,
          lastError: 'boom',
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
    };
    getQueueHealthSnapshotMock.mockResolvedValue(snapshot);

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.jobsRunning).toBe(2);
    expect(res.body.jobsWaiting).toBe(5);
    expect(res.body.deadLetterSize).toBe(1);
    expect(res.body.lastErrors[0].updatedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(recordQueueHealthMock).toHaveBeenCalledWith(snapshot);
  });
});


