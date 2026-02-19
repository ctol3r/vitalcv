import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler';
import { requestObservability } from '../src/middleware/requestObservability';
import { requestLatencyMetrics } from '../src/observability/requestMetrics';

describe('observability middleware', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs requests and records latency metrics', async () => {
    const app = express();
    app.use(requestObservability);
    app.get('/ok', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).get('/ok').set('x-request-id', 'req-123');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('req-123');

    const metrics = requestLatencyMetrics.snapshot();
    expect(typeof metrics.avg_latency_ms).toBe('number');
    expect(typeof metrics.p90_latency_ms).toBe('number');
    expect(metrics.total_requests).toBeGreaterThan(0);
    expect(console.info).toHaveBeenCalled();
  });

  it('logs errors with request context', async () => {
    const app = express();
    app.use(requestObservability);
    app.get('/boom', () => {
      throw new Error('boom');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom').set('x-request-id', 'req-err-1');

    expect(res.status).toBe(500);
    expect(res.body.error?.message ?? res.body.error).toBe('boom');
    expect(console.error).toHaveBeenCalled();
  });
});
