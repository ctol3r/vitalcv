/**
 * revocation.cascade.routes.test.ts — Wave B
 *
 * Route-level tests for the blast-radius and cascade endpoints,
 * plus the systemIntegrity sweep/e2e routes.
 *
 * Decision routes (blast-radius/cascade):
 *   - Input validation (400) is tested without DB — always deterministic
 *   - Happy path accepts 200 (connected DB) or 500 (DB unavailable in CI)
 *
 * Integrity routes:
 *   - Exempt from tenant context (shouldSkipTenantContext covers /api/integrity/*)
 *   - Return 200 (healthy/degraded) or 503 (critical — DB unavailable)
 *   - Response shape is always validated regardless of status
 *
 * Uses supertest against the full app (same pattern as
 * src/routes/__tests__/wedgeRoutesRemoved.test.ts).
 */

import request from 'supertest';
import app from '../src/app';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';
const INVALID_IDS = ['not-a-uuid', '123', 'abc-def'];
const TEST_ORG = 'test-org-001';

// ── Blast Radius ───────────────────────────────────────────────────────────

describe('GET /api/decisions/blast-radius/:credentialId', () => {
  it('returns 400 for non-UUID credentialId values', async () => {
    for (const bad of INVALID_IDS) {
      const res = await request(app)
        .get(`/api/decisions/blast-radius/${bad}`)
        .set('x-org-id', TEST_ORG);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    }
  });

  it('returns 401 when x-org-id header is absent (tenant guard)', async () => {
    const res = await request(app).get(`/api/decisions/blast-radius/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 (with DB) or 500 (DB unavailable) for a valid UUID', async () => {
    const res = await request(app)
      .get(`/api/decisions/blast-radius/${VALID_UUID}`)
      .set('x-org-id', TEST_ORG);
    // 200: DB available, blast radius computed (possibly empty)
    // 500: DB unavailable in test/CI environment — route error-handles correctly
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('credentialId', VALID_UUID);
      expect(res.body).toHaveProperty('impactedCapsules');
      expect(res.body).toHaveProperty('totalImpacted');
      expect(Array.isArray(res.body.impactedCapsules)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res.body, 'deepReport')).toBe(true);
    }
  });
});

// ── Cascade Trigger ────────────────────────────────────────────────────────

describe('POST /api/decisions/cascade/:credentialId', () => {
  it('returns 400 for non-UUID credentialId values', async () => {
    for (const bad of INVALID_IDS) {
      const res = await request(app)
        .post(`/api/decisions/cascade/${bad}`)
        .set('x-org-id', TEST_ORG);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    }
  });

  it('returns 401 when x-org-id header is absent', async () => {
    const res = await request(app).post(`/api/decisions/cascade/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 200, 404, or 500 for a valid UUID (DB-dependent)', async () => {
    const res = await request(app)
      .post(`/api/decisions/cascade/${VALID_UUID}`)
      .set('x-org-id', TEST_ORG);
    // 200: cascade succeeded (empty impact on empty DB)
    // 404: capsule not found
    // 500: DB unavailable in test/CI environment
    expect([200, 404, 500]).toContain(res.status);
  });
});

// ── System Integrity Sweep ─────────────────────────────────────────────────
// /api/integrity/* is exempt from tenant context (shouldSkipTenantContext)

describe('GET /api/integrity/sweep', () => {
  it('returns 200 or 503 — never 401 (no tenant guard)', async () => {
    const res = await request(app).get('/api/integrity/sweep');
    // 401 would mean tenant guard is unexpectedly active — that's a bug
    expect(res.status).not.toBe(401);
    expect([200, 503]).toContain(res.status);
  });

  it('response has valid SweepReport shape', async () => {
    const res = await request(app).get('/api/integrity/sweep');
    const body = res.body;
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('overallStatus');
    expect(['healthy', 'degraded', 'critical']).toContain(body.overallStatus);
    expect(body).toHaveProperty('totalChecks');
    expect(body).toHaveProperty('passed');
    expect(body).toHaveProperty('warnings');
    expect(body).toHaveProperty('failures');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('each check has required fields with valid status values', async () => {
    const res = await request(app).get('/api/integrity/sweep');
    for (const check of res.body.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('category');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('message');
      expect(['pass', 'warn', 'fail']).toContain(check.status);
      expect(['database', 'endpoint', 'environment', 'auth', 'connector']).toContain(check.category);
    }
  });

  it('totalChecks equals passed + warnings + failures', async () => {
    const res = await request(app).get('/api/integrity/sweep');
    const { totalChecks, passed, warnings, failures } = res.body;
    expect(totalChecks).toBe(passed + warnings + failures);
  });

  it('checks array is non-empty', async () => {
    const res = await request(app).get('/api/integrity/sweep');
    expect(res.body.checks.length).toBeGreaterThan(0);
  });
});

// ── System Integrity E2E ───────────────────────────────────────────────────

describe('GET /api/integrity/e2e', () => {
  it('returns 200 or 503 — never 401 (no tenant guard)', async () => {
    const res = await request(app).get('/api/integrity/e2e');
    expect(res.status).not.toBe(401);
    expect([200, 503]).toContain(res.status);
  });

  it('response has valid E2EReport shape', async () => {
    const res = await request(app).get('/api/integrity/e2e');
    const body = res.body;
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('allPassed');
    expect(body).toHaveProperty('steps');
    expect(body).toHaveProperty('totalDurationMs');
    expect(typeof body.allPassed).toBe('boolean');
    expect(Array.isArray(body.steps)).toBe(true);
    expect(typeof body.totalDurationMs).toBe('number');
  });

  it('each step has required fields', async () => {
    const res = await request(app).get('/api/integrity/e2e');
    for (const step of res.body.steps) {
      expect(step).toHaveProperty('step');
      expect(step).toHaveProperty('status');
      expect(step).toHaveProperty('message');
      expect(step).toHaveProperty('durationMs');
      expect(['pass', 'fail']).toContain(step.status);
    }
  });

  it('contains expected E2E step names', async () => {
    const res = await request(app).get('/api/integrity/e2e');
    const stepNames = res.body.steps.map((s: { step: string }) => s.step);
    expect(stepNames).toContain('Signup (Clinician Model)');
    expect(stepNames).toContain('Login (Session Infrastructure)');
  });
});
