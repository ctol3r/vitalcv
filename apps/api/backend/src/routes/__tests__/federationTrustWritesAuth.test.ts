/**
 * Turnstile batch 5 — federation and trust-intelligence writes.
 *
 * All six had no authorization beyond the global tenant guard, which accepted
 * the mere PRESENCE of a caller-supplied `x-org-id`. Anonymous callers could
 * establish federation peers, flip a peer's status, validate federation
 * entities, register an issuer, inject trust events in batch, and trigger
 * monitoring cycles.
 *
 * What made these safe to close is the same property that made batches 1-3
 * safe, and it had to be checked rather than assumed: every calling component
 * (`FederationHealthPanel`, `IssuerOnboardingPanel`, `MonitoringStatusPanel`)
 * is imported by NO page, and verifier-sdk calls the sibling
 * `GET /api/network/peers`, not the PATCH guarded here.
 *
 * Neighbours are deliberately left open because they ARE fronted by live
 * web proxies — `/api/trust/events`, `/api/trust/score/batch`,
 * `/api/network/federation/discover`, `/api/simulation/*`. The last describe
 * block pins that boundary, so a later sweep cannot quietly close them without
 * the proxy work: see docs/security/turnstile-route-dispositions.md.
 */
import express from 'express';
import request, { type Test } from 'supertest';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

import { registerFederationRoutes } from '../federation';
import { registerFederationDiscoveryRoutes } from '../federationDiscovery';
import { registerIssuerOnboardingRoutes } from '../issuerOnboarding';
import { registerAsyncTrustRoutes } from '../asyncTrust';
import { registerTrustIntelligenceRoutes } from '../trustIntelligence';

const SECRET = 'federation-trust-test-secret';
const BOGUS_ORG = '00000000-0000-4000-8000-000000000000';
const UUID = '11111111-1111-4111-8111-111111111111';
const NPI = '1407202518';

function makeApp() {
  const app = express();
  app.use(express.json());
  registerFederationRoutes(app);
  registerFederationDiscoveryRoutes(app);
  registerIssuerOnboardingRoutes(app);
  registerAsyncTrustRoutes(app);
  registerTrustIntelligenceRoutes(app);
  return app;
}

/**
 * Closed in this batch.
 *
 * NOT here, and deliberately: the two /api/trust/divergence writes. They
 * already require an actor — they read `x-clerk-user-id` inline and 401 without
 * it, recording it as `resolvedBy` — which makes them IDENTITY surfaces, so an
 * operator secret is the wrong control. That inline read is a third
 * false-positive class for the mutation detector, alongside locally-named
 * guards and named handlers.
 */
const GUARDED: Array<[string, string, Record<string, unknown>]> = [
  ['post', '/api/network/federate', { networkName: 'n', networkType: 'peer' }],
  ['patch', `/api/network/peers/${UUID}/status`, { status: 'ACTIVE' }],
  ['post', '/api/network/federation/validate', { entityId: 'e' }],
  ['post', '/api/network/issuer/register', { name: 'i', did: 'did:web:x' }],
  ['post', '/api/trust/events/batch', { events: [] }],
  ['post', '/api/trust/monitoring/cycle', {}],
];

/**
 * Deliberately NOT closed — each is fronted by a live web proxy, so closing it
 * is a product decision, not a sweep. Pinned so the boundary is explicit.
 */
const DEFERRED: Array<[string, string, Record<string, unknown>]> = [
  ['post', '/api/trust/events', { type: 'x', npi: NPI }],
  ['post', '/api/trust/score/batch', { npis: [NPI] }],
  ['post', '/api/network/federation/discover', { entityId: 'e' }],
];

const GUARDED_LABELS = GUARDED.map(([m, p]) => `${m.toUpperCase()} ${p}`);
const DEFERRED_LABELS = DEFERRED.map(([m, p]) => `${m.toUpperCase()} ${p}`);

function send(method: string, path: string, body: Record<string, unknown>): Test {
  const agent = request(makeApp()) as unknown as Record<string, (p: string) => Test>;
  return agent[method](path).send(body);
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

describe('federation and trust writes refuse the x-org-id bypass', () => {
  it.each(GUARDED.map((g, i) => [GUARDED_LABELS[i], g] as const))(
    '%s refuses a caller holding only x-org-id',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);
      expect(res.status).toBe(403);
    },
  );

  it.each(GUARDED.map((g, i) => [GUARDED_LABELS[i], g] as const))(
    '%s refuses an anonymous caller',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body);
      expect(res.status).toBe(403);
    },
  );

  it.each(GUARDED.map((g, i) => [GUARDED_LABELS[i], g] as const))(
    '%s fails CLOSED when MONITORING_SECRET is unset',
    async (_label, [method, path, body]) => {
      delete process.env.MONITORING_SECRET;
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);
      expect(res.status).toBe(403);
    },
  );
});

describe('the deferred neighbours are still reachable, on purpose', () => {
  it.each(DEFERRED.map((d, i) => [DEFERRED_LABELS[i], d] as const))(
    '%s is NOT operator-gated (live web proxy fronts it)',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);

      // Whatever it answers, it must not be the operator guard's 403 — closing
      // these needs the proxy to forward a secret first.
      expect(res.status).not.toBe(403);
    },
  );
});
