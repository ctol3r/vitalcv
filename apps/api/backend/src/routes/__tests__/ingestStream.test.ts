import type { Request, Response } from 'express';

jest.mock('../../services/ingest/ingestOrchestrator', () => ({
  getIngestRun: jest.fn(),
  startBatchIngestRuns: jest.fn(),
  startIngestRun: jest.fn(),
}));

jest.mock('../../services/feedback/prismaEventStore', () => ({
  emitLearningEvent: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import { startBatchIngestRuns } from '../../services/ingest/ingestOrchestrator';
import { registerIngestStreamRoutes } from '../ingestStream';

const startBatchIngestRunsMock = startBatchIngestRuns as jest.MockedFunction<typeof startBatchIngestRuns>;

function buildPostHandler(path: string) {
  const post = jest.fn();
  registerIngestStreamRoutes({ post, get: jest.fn() } as never);
  const postCall = post.mock.calls.find((call) => call[0] === path);
  if (!postCall) {
    throw new Error(`route ${path} was not registered`);
  }
  return postCall[1] as (req: Request, res: Response) => Promise<void>;
}

function buildResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('POST /api/ingest/batch', () => {
  beforeEach(() => {
    startBatchIngestRunsMock.mockReset();
  });

  it('sanitizes and deduplicates batch NPIs before starting runs', async () => {
    startBatchIngestRunsMock.mockResolvedValue([
      {
        npi: '1234567890',
        run: {
          id: 'run-1',
          npi: '1234567890',
          status: 'PENDING',
          entityId: null,
          lastError: null,
          startedAt: '2026-04-14T00:00:00.000Z',
          completedAt: null,
          createdAt: '2026-04-14T00:00:00.000Z',
          updatedAt: '2026-04-14T00:00:00.000Z',
        },
      },
      {
        npi: '1234567891',
        run: {
          id: 'run-2',
          npi: '1234567891',
          status: 'RUNNING',
          entityId: null,
          lastError: null,
          startedAt: '2026-04-14T00:00:00.000Z',
          completedAt: null,
          createdAt: '2026-04-14T00:00:00.000Z',
          updatedAt: '2026-04-14T00:00:00.000Z',
        },
      },
    ]);

    const handler = buildPostHandler('/api/ingest/batch');
    const res = buildResponse();

    await handler({
      body: { npis: ['1234567890', 'bad', '1234567890', ' 1234567891 '] },
    } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(startBatchIngestRunsMock).toHaveBeenCalledWith(['1234567890', '1234567891']);
    expect(res.json).toHaveBeenCalledWith({
      submitted: [
        { npi: '1234567890', runId: 'run-1', status: 'pending' },
        { npi: '1234567891', runId: 'run-2', status: 'running' },
      ],
      submittedCount: 2,
    });
  });

  it('rejects batch requests without any valid NPIs', async () => {
    const handler = buildPostHandler('/api/ingest/batch');
    const res = buildResponse();

    await handler({
      body: { npis: ['bad', 'also-bad'] },
    } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_batch_npis',
      error_description: 'npis must include at least one valid 10-digit NPI (max 25).',
    });
    expect(startBatchIngestRunsMock).not.toHaveBeenCalled();
  });
});
