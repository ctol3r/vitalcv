import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    actionLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { registerActionLogRoutes } from '../actionLog';

const prismaMock = prisma as unknown as {
  actionLog: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerActionLogRoutes(app);
  return app;
}

describe('employer action endpoint', () => {
  beforeEach(() => {
    prismaMock.actionLog.create.mockReset();
    prismaMock.actionLog.findMany.mockReset();
  });

  it('persists a request_data action to the ActionLog', async () => {
    prismaMock.actionLog.create.mockResolvedValue({});

    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: '1234567890', action: 'request_data', rationale: 'need board details' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      action: 'request_data',
      npi: '1234567890',
      recorded: true,
    });
    expect(prismaMock.actionLog.create).toHaveBeenCalledWith({
      data: {
        npi: '1234567890',
        action: 'request_data',
        rationale: 'need board details',
      },
    });
  });

  it('persists a flag action to the ActionLog', async () => {
    prismaMock.actionLog.create.mockResolvedValue({});

    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: '1234567890', action: 'flag' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      action: 'flag',
      npi: '1234567890',
      recorded: true,
    });
    expect(prismaMock.actionLog.create).toHaveBeenCalledWith({
      data: { npi: '1234567890', action: 'flag', rationale: null },
    });
  });

  it('routes accept to the Acceptance system without writing to ActionLog', async () => {
    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: '1234567890', action: 'accept', rationale: 'all clear' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      routed: 'acceptance_system',
    });
    expect(prismaMock.actionLog.create).not.toHaveBeenCalled();
  });

  it('rejects invalid NPI', async () => {
    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: 'bad', action: 'flag' })
      .expect(400);
    expect(response.body.error).toBe('invalid_npi');
  });

  it('rejects invalid action', async () => {
    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: '1234567890', action: 'delete' })
      .expect(400);
    expect(response.body.error).toBe('invalid_action');
  });

  it('GET returns the most recent action entries for an NPI', async () => {
    const sampleCreatedAt = new Date('2026-04-14T08:00:00.000Z');
    prismaMock.actionLog.findMany.mockResolvedValue([
      {
        id: 'action-1',
        npi: '1234567890',
        action: 'flag',
        rationale: 'board mismatch',
        createdAt: sampleCreatedAt,
      },
    ]);

    const response = await request(createApp())
      .get('/api/employer-actions/1234567890')
      .expect(200);

    expect(response.body.actions).toHaveLength(1);
    expect(response.body.actions[0]).toEqual(expect.objectContaining({
      id: 'action-1',
      action: 'flag',
      rationale: 'board mismatch',
    }));
    expect(prismaMock.actionLog.findMany).toHaveBeenCalledWith({
      where: { npi: '1234567890' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('GET rejects invalid NPI', async () => {
    const response = await request(createApp())
      .get('/api/employer-actions/not-an-npi')
      .expect(400);
    expect(response.body.error).toBe('invalid_npi');
  });
});
