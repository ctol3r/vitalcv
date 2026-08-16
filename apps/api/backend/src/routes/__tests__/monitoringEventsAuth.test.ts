/**
 * monitoringEventsAuth.test.ts
 *
 * GET /api/monitoring/events was reachable by any anonymous caller who set
 * `x-org-id` to any value. It sits behind the global tenant guard, which
 * accepted mere PRESENCE of a caller-supplied org id — and the handler ignores
 * the request entirely, so the org id was a turnstile token, never a scope.
 * Measured in production 2026-08-08: ~1.25 MB, ~3.7k events, almost all
 * CRITICAL `credential_expired`, keyed to real NPIs.
 *
 * These assert the OUTCOME — what a caller gets — not that a middleware is
 * referenced. The `x-org-id` case is the exact production request that worked.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../services/monitoring/alertEngine', () => ({
  generateAlerts: jest.fn(),
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

import { generateAlerts } from '../../services/monitoring/alertEngine';
import { registerMonitoringEventsRoutes } from '../monitoringEvents';

const SECRET = 'test-monitoring-secret';
const ALERTS = [{ id: 'a1', type: 'credential_expired', severity: 'CRITICAL', npi: '1558395518' }];

function makeApp() {
  const app = express();
  registerMonitoringEventsRoutes(app);
  return app;
}

let previousSecret: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  previousSecret = process.env.MONITORING_SECRET;
  process.env.MONITORING_SECRET = SECRET;
  (generateAlerts as jest.Mock).mockResolvedValue(ALERTS);
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.MONITORING_SECRET;
  else process.env.MONITORING_SECRET = previousSecret;
});

describe('GET /api/monitoring/events authorization', () => {
  it('refuses an anonymous caller', async () => {
    const res = await request(makeApp()).get('/api/monitoring/events');

    expect(res.status).toBe(403);
    expect(generateAlerts).not.toHaveBeenCalled();
  });

  it('refuses the production bypass: an arbitrary x-org-id header', async () => {
    const res = await request(makeApp())
      .get('/api/monitoring/events')
      .set('x-org-id', 'arbitrary-value');

    expect(res.status).toBe(403);
    // The strongest assertion here: the alert set was never even generated, so
    // no clinician event data reached the response path.
    expect(generateAlerts).not.toHaveBeenCalled();
  });

  it('refuses a wrong secret', async () => {
    const res = await request(makeApp())
      .get('/api/monitoring/events')
      .set('x-monitoring-secret', 'wrong');

    expect(res.status).toBe(403);
    expect(generateAlerts).not.toHaveBeenCalled();
  });

  it('serves the operator holding the secret', async () => {
    const res = await request(makeApp())
      .get('/api/monitoring/events')
      .set('x-monitoring-secret', SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(ALERTS);
  });

  it('fails CLOSED when MONITORING_SECRET is unset — never open', async () => {
    // A guard that disables itself when unconfigured is the exact failure mode
    // this gap is made of. An empty configured secret must not match an empty
    // supplied one.
    delete process.env.MONITORING_SECRET;

    const anonymous = await request(makeApp()).get('/api/monitoring/events');
    const withEmptyHeader = await request(makeApp())
      .get('/api/monitoring/events')
      .set('x-monitoring-secret', '');

    expect(anonymous.status).toBe(403);
    expect(withEmptyHeader.status).toBe(403);
    expect(generateAlerts).not.toHaveBeenCalled();
  });
});
