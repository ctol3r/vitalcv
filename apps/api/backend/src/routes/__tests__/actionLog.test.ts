import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    actionLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    acceptance: {
      findMany: jest.fn(),
    },
    acceptanceSnapshot: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../services/passport/npiPassportContract', () => ({
  buildPassportDataByNpi: jest.fn(),
}));

jest.mock('../../services/actions/reuseSignal', () => ({
  computeReuseSignal: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { registerActionLogRoutes } from '../actionLog';

import { buildPassportDataByNpi } from '../../services/passport/npiPassportContract';
import { computeReuseSignal } from '../../services/actions/reuseSignal';

const prismaMock = prisma as unknown as {
  actionLog: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  acceptance: {
    findMany: jest.Mock;
  };
  acceptanceSnapshot: {
    create: jest.Mock;
  };
};

const passportMock = buildPassportDataByNpi as jest.MockedFunction<typeof buildPassportDataByNpi>;
const reuseMock = computeReuseSignal as jest.MockedFunction<typeof computeReuseSignal>;

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
    prismaMock.acceptance.findMany.mockReset();
    prismaMock.acceptance.findMany.mockResolvedValue([]);
    prismaMock.acceptanceSnapshot.create.mockReset();
    prismaMock.acceptanceSnapshot.create.mockResolvedValue({});
    passportMock.mockReset();
    reuseMock.mockReset();
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

  it('routes accept to the Acceptance system without writing to ActionLog and captures a snapshot', async () => {
    passportMock.mockResolvedValue({
      decision: { decision: 'PROCEED', confidence: 90, rationale: [], blockers: [], next_actions: [] },
    } as never);
    reuseMock.mockResolvedValue({
      accepted_count: 1,
      flagged_count: 0,
      request_data_count: 0,
      last_action: 'accept',
      last_action_at: '2026-04-14T08:00:00.000Z',
    });

    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: '1234567890', action: 'accept', rationale: 'all clear' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      routed: 'acceptance_system',
    });
    expect(prismaMock.actionLog.create).not.toHaveBeenCalled();
    expect(prismaMock.acceptanceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicianNpi: '1234567890',
          decisionState: 'PROCEED',
          trustSignalsSnapshot: expect.objectContaining({
            reuse: expect.objectContaining({ accepted_count: 1 }),
            captured_at: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('accept still succeeds when the snapshot write fails (best-effort)', async () => {
    passportMock.mockResolvedValue({
      decision: { decision: 'PROCEED', confidence: 90, rationale: [], blockers: [], next_actions: [] },
    } as never);
    reuseMock.mockResolvedValue({
      accepted_count: 0,
      flagged_count: 0,
      request_data_count: 0,
      last_action: null,
      last_action_at: null,
    });
    prismaMock.acceptanceSnapshot.create.mockRejectedValue(new Error('db down'));

    const response = await request(createApp())
      .post('/api/employer-actions')
      .send({ npi: '1234567890', action: 'accept' })
      .expect(200);

    expect(response.body).toEqual({ success: true, routed: 'acceptance_system' });
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

  it('GET returns structured acceptance graph nodes alongside actions', async () => {
    prismaMock.actionLog.findMany.mockResolvedValue([]);
    prismaMock.acceptance.findMany.mockResolvedValue([
      {
        acceptanceId: 'acc-1',
        subjectId: '1234567890',
        employerId: 'emp-1',
        facilityId: 'fac-1',
        acceptedAt: new Date('2026-04-14T08:00:00.000Z'),
        eventHash: 'hash-1',
        decisionState: 'PROCEED',
        trustSignalsSnapshot: { reuse: { accepted_count: 1 } },
        role: 'reviewer',
        createdAt: new Date('2026-04-14T08:00:00.000Z'),
      },
    ]);

    const response = await request(createApp())
      .get('/api/employer-actions/1234567890')
      .expect(200);

    expect(response.body.actions).toEqual([]);
    expect(response.body.acceptances).toHaveLength(1);
    expect(response.body.acceptances[0]).toEqual(
      expect.objectContaining({
        kind: 'acceptance',
        acceptanceId: 'acc-1',
        decisionState: 'PROCEED',
        trustSignalsSnapshot: { reuse: { accepted_count: 1 } },
        role: 'reviewer',
        employerId: 'emp-1',
      }),
    );
    expect(prismaMock.acceptance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subjectId: '1234567890' },
        orderBy: { acceptedAt: 'desc' },
        take: 10,
      }),
    );
  });

  it('GET degrades gracefully when only the acceptance read fails', async () => {
    prismaMock.actionLog.findMany.mockResolvedValue([]);
    prismaMock.acceptance.findMany.mockRejectedValue(new Error('db down'));

    const response = await request(createApp())
      .get('/api/employer-actions/1234567890')
      .expect(200);

    expect(response.body.actions).toEqual([]);
    expect(response.body.acceptances).toEqual([]);
    // Only one subsystem failed — body still usable, no top-level error.
    expect(response.body.error).toBeUndefined();
  });
});
