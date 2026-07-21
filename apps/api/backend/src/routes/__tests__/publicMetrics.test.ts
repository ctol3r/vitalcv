import express from 'express';
import request from 'supertest';

import { registerPublicMetricsRoutes } from '../publicMetrics';

/**
 * Truth-contract regression guard.
 *
 * /metrics/public once served `uptime: '99.99%'` plus two counters seeded at
 * 12,847 and 41,293 that incremented off a wall-clock timer. They looked like
 * business metrics and were derived from nothing. This suite fails if any
 * unmeasured number comes back.
 */
function buildApp(): express.Express {
  const app = express();
  registerPublicMetricsRoutes(app);
  return app;
}

describe('GET /metrics/public', () => {
  it('reports liveness and nothing else', async () => {
    const res = await request(buildApp()).get('/metrics/public');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['generated_at', 'status']);
    expect(res.body.status).toBe('Operational');
    expect(Number.isNaN(Date.parse(res.body.generated_at))).toBe(false);
  });

  it('publishes no uptime figure it has not measured', async () => {
    const res = await request(buildApp()).get('/metrics/public');

    // /status states the product "does not publish uptime figures it has not
    // measured". Measured availability comes from the availability ledger, not
    // from a literal in a route handler.
    expect(res.body).not.toHaveProperty('uptime');
    expect(JSON.stringify(res.body)).not.toMatch(/99\.9/);
  });

  it('publishes no fabricated throughput counters', async () => {
    const res = await request(buildApp()).get('/metrics/public');

    expect(res.body).not.toHaveProperty('bundlesGenerated');
    expect(res.body).not.toHaveProperty('verificationsPerformed');
  });

  it('returns no number that grows with wall-clock time', async () => {
    // The old counters advanced on a timer, so two calls at different instants
    // disagreed. Any numeric field that moves without work having happened is
    // the same defect wearing a different name.
    const first = await request(buildApp()).get('/metrics/public');

    const realNow = Date.now;
    // Jump a year forward; a time-seeded counter would visibly advance.
    Date.now = () => realNow() + 365 * 24 * 60 * 60 * 1000;
    let second;
    try {
      second = await request(buildApp()).get('/metrics/public');
    } finally {
      Date.now = realNow;
    }

    const numericFields = (body: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === 'number'));

    expect(numericFields(first.body)).toEqual({});
    expect(numericFields(second.body)).toEqual({});
  });
});
