/**
 * Turnstile batch 2 — the operator families, including the endpoint the G1
 * report opened with and the first WRITE routes closed in this workstream.
 *
 * All of these sat behind the global tenant guard, which accepted the mere
 * PRESENCE of a caller-supplied `x-org-id`, and none of the handlers reads the
 * org — so the header was a turnstile token, not a scope.
 *
 * The `x-org-id` case is the load-bearing one throughout. Without the header
 * the tenant guard 401s anyway, so an anonymous-only assertion passes even with
 * the guard removed and proves nothing.
 *
 * `/api/api-keys` is the one to read twice. It had NO authorization of any
 * kind — mint a key for an arbitrary `clinicianId` from the body, list any
 * clinician's keys, revoke any key. It is not exploitable today only because
 * `apiKeyService` targets `subscriptionApiKey` with the `ApiKey` model's fields
 * and therefore throws. These tests pin the guard so that repairing that drift
 * does not land on an open door.
 */
import express from 'express';
import request, { type Test } from 'supertest';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../services/billing/apiKeyService', () => ({
  generateApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  getApiKeysByClinicianId: jest.fn(),
}));
jest.mock('../../services/missionOps/onboardingFlows', () => ({
  computeMissionOpsOverview: jest.fn(),
  listOnboardingFlows: jest.fn(),
  getOrCreateOnboardingFlow: jest.fn(),
  initializeOnboardingFlowsPersistence: jest.fn(),
  updateOnboardingStage: jest.fn(),
}));
jest.mock('../../services/missionOps/sourceOpsService', () => ({
  computeSourceOpsReport: jest.fn(),
}));
jest.mock('../../services/missionOps/sdkDiagnosticsService', () => ({
  getSDKDiagnosticsReport: jest.fn(),
}));
jest.mock('../../services/registry/trustRegistry', () => ({
  initializeTrustRegistryPersistence: jest.fn(),
}));

import * as apiKeyService from '../../services/billing/apiKeyService';
import { computeSourceOpsReport } from '../../services/missionOps/sourceOpsService';
import { updateOnboardingStage } from '../../services/missionOps/onboardingFlows';
import { registerApiKeyRoutes } from '../apiKeys';
import { registerMissionOpsRoutes } from '../missionOps';

const SECRET = 'batch2-test-secret';
const BOGUS_ORG = '00000000-0000-4000-8000-000000000000';
const UUID = '11111111-1111-4111-8111-111111111111';

function makeApp() {
  const app = express();
  app.use(express.json());
  registerApiKeyRoutes(app);
  registerMissionOpsRoutes(app);
  return app;
}

/** [method, path, body] — every route closed in this batch that takes a request. */
const ROUTES: Array<[string, string, Record<string, unknown> | undefined]> = [
  ['get', '/api/mission-ops/sources', undefined],
  ['get', '/api/mission-ops/overview', undefined],
  ['get', '/api/mission-ops/sdk-diagnostics', undefined],
  ['get', '/api/mission-ops/onboarding', undefined],
  ['get', '/api/mission-ops/onboarding/ISSUER', undefined],
  ['post', '/api/mission-ops/onboarding', { role: 'ISSUER', entityId: 'e1' }],
  ['patch', '/api/mission-ops/onboarding/ISSUER/e1/stage', { stage: 'x', status: 'COMPLETE' }],
  ['post', '/api/api-keys', { clinicianId: UUID, name: 'k', tier: 'ENTERPRISE' }],
  ['get', `/api/api-keys/${UUID}`, undefined],
  ['delete', `/api/api-keys/${UUID}`, undefined],
];

const LABELS = ROUTES.map(([m, p]) => `${m.toUpperCase()} ${p}`);

function send(method: string, path: string, body: Record<string, unknown> | undefined): Test {
  const agent = request(makeApp()) as unknown as Record<string, (p: string) => Test>;
  const req = agent[method](path);
  return body ? req.send(body) : req;
}

let previousSecret: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  previousSecret = process.env.MONITORING_SECRET;
  process.env.MONITORING_SECRET = SECRET;
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.MONITORING_SECRET;
  else process.env.MONITORING_SECRET = previousSecret;
});

describe('turnstile batch 2 refuses the x-org-id bypass', () => {
  it.each(ROUTES.map((r, i) => [LABELS[i], r] as const))(
    '%s refuses a caller holding only x-org-id',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);
      expect(res.status).toBe(403);
    },
  );

  it.each(ROUTES.map((r, i) => [LABELS[i], r] as const))(
    '%s refuses an anonymous caller',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body);
      expect(res.status).toBe(403);
    },
  );

  it.each(ROUTES.map((r, i) => [LABELS[i], r] as const))(
    '%s fails CLOSED when MONITORING_SECRET is unset',
    async (_label, [method, path, body]) => {
      delete process.env.MONITORING_SECRET;
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);
      expect(res.status).toBe(403);
    },
  );
});

describe('nothing behind the guard was reached', () => {
  it('no mission-ops report was computed and no onboarding stage was written', async () => {
    await send('get', '/api/mission-ops/sources', undefined).set('x-org-id', BOGUS_ORG);
    await send('patch', '/api/mission-ops/onboarding/ISSUER/e1/stage', {
      stage: 'x',
      status: 'COMPLETE',
    }).set('x-org-id', BOGUS_ORG);

    expect(computeSourceOpsReport as jest.Mock).not.toHaveBeenCalled();
    expect(updateOnboardingStage as jest.Mock).not.toHaveBeenCalled();
  });

  it('NO api key was minted, listed or revoked', async () => {
    await send('post', '/api/api-keys', { clinicianId: UUID, name: 'k', tier: 'ENTERPRISE' })
      .set('x-org-id', BOGUS_ORG);
    await send('get', `/api/api-keys/${UUID}`, undefined).set('x-org-id', BOGUS_ORG);
    await send('delete', `/api/api-keys/${UUID}`, undefined).set('x-org-id', BOGUS_ORG);

    expect(apiKeyService.generateApiKey as jest.Mock).not.toHaveBeenCalled();
    expect(apiKeyService.getApiKeysByClinicianId as jest.Mock).not.toHaveBeenCalled();
    expect(apiKeyService.revokeApiKey as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('operators still get through', () => {
  it('the secret reaches the handler rather than the guard', async () => {
    (computeSourceOpsReport as jest.Mock).mockResolvedValue({ ok: true });

    const res = await send('get', '/api/mission-ops/sources', undefined)
      .set('x-monitoring-secret', SECRET);

    expect(res.status).not.toBe(403);
    expect(computeSourceOpsReport as jest.Mock).toHaveBeenCalled();
  });
});
