import express from 'express';
import request from 'supertest';

const mockGetPollingStatus = jest.fn();
const mockGetSourcePollConfigs = jest.fn();
const mockGetRecentPollCycles = jest.fn();
const mockTriggerPoll = jest.fn();
const mockTriggerAllPolls = jest.fn();
const mockProcessBurstEvent = jest.fn();

jest.mock('../../services/polling/pollingScheduler', () => ({
  getPollingStatus: (...args: unknown[]) => mockGetPollingStatus(...args),
  getSourcePollConfigs: (...args: unknown[]) => mockGetSourcePollConfigs(...args),
  getRecentPollCycles: (...args: unknown[]) => mockGetRecentPollCycles(...args),
  triggerPoll: (...args: unknown[]) => mockTriggerPoll(...args),
  triggerAllPolls: (...args: unknown[]) => mockTriggerAllPolls(...args),
  processBurstEvent: (...args: unknown[]) => mockProcessBurstEvent(...args),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import { registerPollingRoutes } from '../polling';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPollingRoutes(app);
  return app;
}

describe('polling routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTriggerPoll.mockResolvedValue({
      id: 'poll-1',
      source: 'PECOS_PUBLIC',
      cadence: 'WEEKLY',
      startedAt: '2026-03-24T12:00:00.000Z',
      completedAt: '2026-03-24T12:00:05.000Z',
      durationMs: 5000,
      npisPolled: 1,
      eventsGenerated: 0,
      errors: 0,
      diffs: [],
      status: 'COMPLETED',
    });
    mockProcessBurstEvent.mockResolvedValue({
      source: 'PECOS_PUBLIC',
      totalNpis: 2,
      processedNpis: 2,
      changedCount: 0,
      addedCount: 2,
      errorCount: 0,
      durationMs: 250,
      findings: 1,
    });
  });

  it('triggers the PECOS sync route without remapping the canonical source id', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/polling/trigger/PECOS_PUBLIC');

    expect(response.status).toBe(200);
    expect(mockTriggerPoll).toHaveBeenCalledWith('PECOS_PUBLIC');
    expect(response.body).toMatchObject({
      source: 'PECOS_PUBLIC',
      cadence: 'WEEKLY',
      status: 'COMPLETED',
    });
  });

  it('rejects unknown polling source ids before the scheduler runs', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/polling/trigger/NOT_A_SOURCE');

    expect(response.status).toBe(400);
    expect(mockTriggerPoll).not.toHaveBeenCalled();
    expect(response.body.error).toContain('source must be one of');
  });

  it('passes the PECOS burst route through to the scheduler without aliasing the source id', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/polling/burst')
      .send({
        source: 'PECOS_PUBLIC',
        description: 'Quarterly PECOS sync',
        npis: ['1558302470', '1558395511'],
        batchSize: 25,
        delayMs: 0,
      });

    expect(response.status).toBe(200);
    expect(mockProcessBurstEvent).toHaveBeenCalledWith({
      source: 'PECOS_PUBLIC',
      description: 'Quarterly PECOS sync',
      npis: ['1558302470', '1558395511'],
      batchSize: 25,
      delayMs: 0,
    });
    expect(response.body).toMatchObject({
      source: 'PECOS_PUBLIC',
      processedNpis: 2,
      addedCount: 2,
    });
  });
});
