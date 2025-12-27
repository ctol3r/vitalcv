import express from 'express';
import request from 'supertest';
import { onStatusHandler } from '../src/api/system/on-status';
import prisma from '../src/graphql/prisma_client';
import { PolkadotService } from '../src/blockchain/polkadot_service';

const originalEnv = { ...process.env };

const mockHealth = {
  isSyncing: false,
  peers: 5,
  bestNumber: 100,
  finalizedNumber: 98,
  lagBlocks: 2,
};

describe('/system/on-status', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function buildApp() {
    const app = express();
    app.get('/system/on-status', onStatusHandler);
    return app;
  }

  it('returns HARD_ON when all checks pass', async () => {
    process.env.PUBLIC_VERIFIER_URL = 'http://verifier.local';
    process.env.SUBSTRATE_WS = 'ws://chain.local:9944';

    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ ok: 1 }] as any);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
      statusText: 'ok',
    } as any);

    jest.spyOn(PolkadotService.prototype, 'connect').mockResolvedValueOnce();
    jest.spyOn(PolkadotService.prototype, 'getHealth').mockResolvedValueOnce(mockHealth);
    jest.spyOn(PolkadotService.prototype, 'disconnect').mockResolvedValue();

    const app = buildApp();
    const res = await request(app).get('/system/on-status');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HARD_ON');
    expect(res.body.blockingReasons).toEqual([]);
  });

  it('returns SOFT_ON with blocking reasons when mocks are enabled', async () => {
    process.env.PUBLIC_VERIFIER_URL = 'http://verifier.local';
    process.env.SUBSTRATE_WS = 'ws://chain.local:9944';
    process.env.VITALCV_MOCK_MODE = 'true';

    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ ok: 1 }] as any);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
      statusText: 'ok',
    } as any);

    jest.spyOn(PolkadotService.prototype, 'connect').mockResolvedValueOnce();
    jest.spyOn(PolkadotService.prototype, 'getHealth').mockResolvedValueOnce(mockHealth);
    jest.spyOn(PolkadotService.prototype, 'disconnect').mockResolvedValue();

    const app = buildApp();
    const res = await request(app).get('/system/on-status');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('SOFT_ON');
    expect(res.body.blockingReasons.some((r: string) => r.includes('Mock flags active'))).toBe(true);
  });
});
