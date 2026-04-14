import express from 'express';
import request from 'supertest';

jest.mock('../../orchestrator/vcv-omega', () => ({
  orchestrateOmega: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import { orchestrateOmega } from '../../orchestrator/vcv-omega';
import { registerOmegaRoutes, __resetOmegaRateLimiterForTests } from '../omega';

const orchestrateMock = orchestrateOmega as jest.MockedFunction<typeof orchestrateOmega>;

function createApp() {
  const app = express();
  app.use(express.json());
  registerOmegaRoutes(app);
  return app;
}

function fakeOkResponse(npi: string) {
  return {
    status: 'ok' as const,
    subject: { npi },
    context: { orgId: '', role: 'viewer', persist: false },
    decision: {
      decision: 'PROCEED',
      confidence: 88,
      rationale: [],
      blockers: [],
      next_actions: [],
    },
    coverage: { checks: [], summary: {} },
    claims: {},
    reuse_signal: {
      accepted_count: 0,
      flagged_count: 0,
      request_data_count: 0,
      last_action: null,
      last_action_at: null,
    },
    recent_actions: [],
    generatedAt: '2026-04-14T08:00:00.000Z',
  } as unknown as Awaited<ReturnType<typeof orchestrateOmega>>;
}

describe('POST /api/omega', () => {
  beforeEach(() => {
    orchestrateMock.mockReset();
    __resetOmegaRateLimiterForTests();
  });

  it('delegates to orchestrateOmega and returns 200 on ok status', async () => {
    orchestrateMock.mockResolvedValue(fakeOkResponse('1234567890'));

    const response = await request(createApp())
      .post('/api/omega')
      .send({ npi: '1234567890', orgId: 'org-1', role: 'reviewer', persist: true })
      .expect(200);

    expect(orchestrateMock).toHaveBeenCalledWith({
      subject: { npi: '1234567890' },
      context: { orgId: 'org-1', role: 'reviewer', persist: true },
    });
    expect(response.body).toEqual(expect.objectContaining({ status: 'ok' }));
  });

  it('returns 404 when orchestrator reports not_found', async () => {
    orchestrateMock.mockResolvedValue({
      ...fakeOkResponse('1234567890'),
      status: 'not_found',
      decision: null,
      coverage: null,
      claims: null,
    });

    const response = await request(createApp())
      .post('/api/omega')
      .send({ npi: '1234567890' })
      .expect(404);

    expect(response.body.status).toBe('not_found');
  });

  it('rejects malformed NPI at the 400 layer without calling the orchestrator', async () => {
    const response = await request(createApp())
      .post('/api/omega')
      .send({ npi: 'nope' })
      .expect(400);

    expect(response.body.error).toBe('invalid_npi');
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('rejects non-boolean persist', async () => {
    const response = await request(createApp())
      .post('/api/omega')
      .send({ npi: '1234567890', persist: 'yes' })
      .expect(400);

    expect(response.body.error).toBe('invalid_persist');
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('returns 500 with a stable error envelope when the orchestrator throws', async () => {
    orchestrateMock.mockRejectedValue(new Error('downstream exploded'));

    const response = await request(createApp())
      .post('/api/omega')
      .send({ npi: '1234567890' })
      .expect(500);

    expect(response.body.error).toBe('omega_failed');
  });

  it('trims surrounding whitespace from npi before validating format', async () => {
    orchestrateMock.mockResolvedValue(fakeOkResponse('1234567890'));

    await request(createApp())
      .post('/api/omega')
      .send({ npi: '  1234567890  ' })
      .expect(200);

    expect(orchestrateMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { npi: '1234567890' } }),
    );
  });

  it('returns 429 when the per-IP rate limit is exceeded', async () => {
    orchestrateMock.mockResolvedValue(fakeOkResponse('1234567890'));
    const app = createApp();

    // 20 allowed, 21st must be blocked.
    for (let i = 0; i < 20; i += 1) {
      await request(app)
        .post('/api/omega')
        .send({ npi: '1234567890' })
        .expect(200);
    }

    const blocked = await request(app)
      .post('/api/omega')
      .send({ npi: '1234567890' })
      .expect(429);

    expect(blocked.body).toEqual({
      error: 'rate_limited',
      error_description: 'Too many requests',
    });
    // Rate limiter must short-circuit BEFORE the orchestrator is invoked
    // for the blocked request — call count stays at 20.
    expect(orchestrateMock).toHaveBeenCalledTimes(20);
  });

  it('keeps the response shape stable — does not inject timing or meta fields', async () => {
    const ok = fakeOkResponse('1234567890');
    orchestrateMock.mockResolvedValue(ok);

    const response = await request(createApp())
      .post('/api/omega')
      .send({ npi: '1234567890' })
      .expect(200);

    // Response body MUST match orchestrator output verbatim — no duration_ms,
    // no rate_limit_remaining, no wrapper envelope.
    expect(response.body).toEqual(ok);
    expect(response.body.duration_ms).toBeUndefined();
    expect(response.body.rate_limit_remaining).toBeUndefined();
  });
});
