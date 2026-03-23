import express from 'express';
import request from 'supertest';

const mockGetIngestRun = jest.fn();
const mockStartIngestRun = jest.fn();
const mockListIngestEvents = jest.fn();

jest.mock('../src/services/ingest/ingestOrchestrator', () => ({
  getIngestRun: (...args: unknown[]) => mockGetIngestRun(...args),
  startIngestRun: (...args: unknown[]) => mockStartIngestRun(...args),
}));

jest.mock('../src/services/ingest/ingestEventStore', () => ({
  listIngestEvents: (...args: unknown[]) => mockListIngestEvents(...args),
}));

import { registerIngestStreamRoutes } from '../src/routes/ingestStream';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerIngestStreamRoutes(app);
  return app;
}

describe('ingest stream routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts an ingest run and returns the persisted run id', async () => {
    mockStartIngestRun.mockResolvedValue({
      id: 'run-123',
      npi: '1558302470',
      status: 'RUNNING',
    });

    const response = await request(buildTestApp()).post('/api/ingest/1558302470');

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      runId: 'run-123',
      npi: '1558302470',
      status: 'running',
    });
  });

  it('serializes SSE events with sequence ids and replays from Last-Event-ID', async () => {
    mockGetIngestRun
      .mockResolvedValueOnce({
        id: 'run-123',
        npi: '1558302470',
        status: 'RUNNING',
      })
      .mockResolvedValueOnce({
        id: 'run-123',
        npi: '1558302470',
        status: 'DONE',
      });
    mockListIngestEvents.mockResolvedValue([
      {
        id: 'event-3',
        runId: 'run-123',
        sequence: 3,
        type: 'done',
        timestamp: '2026-03-22T12:05:00.000Z',
        payload: {
          status: 'SUCCESS',
          entityId: 'entity-1',
          sourcesCompleted: 3,
          sourcesFailed: 0,
          claimCount: 4,
          credentialCount: 3,
          checkedAt: '2026-03-22T12:05:00.000Z',
        },
      },
    ]);

    const response = await request(buildTestApp())
      .get('/api/ingest/run-123/stream')
      .set('Last-Event-ID', '2');

    expect(response.status).toBe(200);
    expect(mockListIngestEvents).toHaveBeenCalledWith('run-123', { afterSequence: 2 });
    expect(response.text).toContain('id: 3');
    expect(response.text).toContain('event: done');
    expect(response.text).toContain('"credentialCount":3');
  });
});
