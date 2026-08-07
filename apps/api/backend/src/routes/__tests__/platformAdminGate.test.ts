/**
 * Trust-root mutations must require a verified platform administrator (#950).
 *
 * The gate these routes used to have tested only that an `x-admin-key` header
 * was PRESENT. It was never compared to a secret — no `ADMIN_KEY` existed in the
 * codebase — so `x-admin-key: x` was admin on endpoints that revoke trust
 * anchors and grant issuer capabilities.
 *
 * FEATURE_TRUST_ANCHORS is forced ON for this file. Every one of these routes
 * 404s when the flag is off, so a suite that inherited the default would report
 * "denied" for every case and pass while the gate was wide open. The flag is the
 * reason the defect was never exploitable in production; it must not be the
 * reason these tests go green.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));

jest.mock('../../services/trust-anchors/anchorIngestion', () => ({
  ingestAllTrustLists: jest.fn(() => []),
}));

jest.mock('../../services/trust-anchors/anchors/anchorRegistry', () => ({
  listAnchors: jest.fn(() => []),
  getAnchor: jest.fn(() => ({ id: 'anchor_1', name: 'A', rootType: 'GOV', status: 'ACTIVE' })),
  revokeAnchor: jest.fn(() => true),
  isAnchorValid: jest.fn(() => true),
  getRevokeReason: jest.fn(() => null),
}));

jest.mock('../../services/trust-anchors/verification-policies/policyEngine', () => ({
  evaluatePolicy: jest.fn(),
  listPolicies: jest.fn(() => []),
}));

jest.mock('../../services/trust-anchors/auditEmitter', () => ({
  emitAnchorUpdateArtifact: jest.fn(),
}));

jest.mock('../../services/trust-anchors/trustRegistryGovernance', () => ({
  registerIssuer: jest.fn(),
  grantCapability: jest.fn(),
  revokeCapability: jest.fn(),
  appendEvidence: jest.fn(),
  checkCapability: jest.fn(),
  listIssuers: jest.fn(() => []),
  getIssuerRecord: jest.fn(() => null),
}));

jest.mock('../../services/sd-jwt/sdJwtIssuer', () => ({ issueSdJwt: jest.fn() }));
jest.mock('../../services/sd-jwt/keyManager', () => ({ getJwks: jest.fn() }));
jest.mock('../../services/verifier/verifierValidation', () => ({
  validateSdJwt: jest.fn(),
  validatePresentation: jest.fn(),
}));
jest.mock('../../services/verifier/vc2SchemaRegistry', () => ({
  getSchema: jest.fn(),
  listSchemas: jest.fn(() => []),
  validateAgainstSchema: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { ingestAllTrustLists } from '../../services/trust-anchors/anchorIngestion';
import { revokeAnchor } from '../../services/trust-anchors/anchors/anchorRegistry';
import { registerIssuer } from '../../services/trust-anchors/trustRegistryGovernance';
import { registerTrustAnchorRoutes } from '../trustAnchors';
import { registerSdJwtRoutes } from '../sdJwt';

const userFindUnique = (prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique;

const ADMIN = 'user_platform_admin';
const ORIGINAL_FLAG = process.env.FEATURE_TRUST_ANCHORS;

beforeAll(() => { process.env.FEATURE_TRUST_ANCHORS = 'true'; });
afterAll(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.FEATURE_TRUST_ANCHORS;
  else process.env.FEATURE_TRUST_ANCHORS = ORIGINAL_FLAG;
});

/** Publishes `req.verifiedAuth` only for a caller the test declares verified. */
function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    const verified = req.headers['x-test-verified-user'];
    if (typeof verified === 'string' && verified.length > 0) {
      (req as unknown as { verifiedAuth: unknown }).verifiedAuth = {
        outcome: 'verified_match',
        verifiedUserId: verified,
      };
    }
    next();
  });
  app.use(express.json());
  registerTrustAnchorRoutes(app);
  registerSdJwtRoutes(app);
  return app;
}

function mockActor(actor: { role: string; status: string } | null) {
  userFindUnique.mockResolvedValue(actor);
}

/** Every mutation that decides which issuers/anchors the platform trusts. */
const TRUST_ROOT_MUTATIONS: Array<[string, string, Record<string, unknown>]> = [
  ['post', '/api/trust-anchors/ingest', {}],
  ['post', '/api/trust-anchors/anchor_1/revoke', { reason: 'compromised' }],
  ['post', '/api/trust-registry/issuers', { did: 'did:x', name: 'X', role: 'issuer' }],
  ['post', '/api/trust-registry/issuers/iss_1/capabilities', { credentialType: 'lic', grantedBy: 'x' }],
  ['delete', '/api/trust-registry/issuers/iss_1/capabilities/lic', {}],
  ['post', '/api/trust-registry/issuers/iss_1/evidence', { type: 't', url: 'u', checksum: 'c', fetchedAt: 'f' }],
];

function send(app: express.Express, method: string, path: string, body: Record<string, unknown>) {
  const agent = request(app);
  const req = method === 'delete' ? agent.delete(path) : agent.post(path);
  return req.send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockActor({ role: 'ADMIN', status: 'ACTIVE' });
});

describe('the flag is ON, so a denial means the gate denied', () => {
  it('a verified platform admin is allowed through', async () => {
    const res = await send(buildApp(), 'post', '/api/trust-anchors/ingest', {})
      .set('x-test-verified-user', ADMIN);
    expect(res.status).toBe(200);
    expect(ingestAllTrustLists).toHaveBeenCalled();
  });
});

describe('the forged credentials that used to work (#950)', () => {
  it.each(TRUST_ROOT_MUTATIONS)('%s %s rejects an arbitrary x-admin-key', async (method, path, body) => {
    const res = await send(buildApp(), method, path, body).set('x-admin-key', 'literally-anything');
    expect(res.status).toBe(401);
  });

  it.each(TRUST_ROOT_MUTATIONS)('%s %s rejects a claimed super-admin role header', async (method, path, body) => {
    const res = await send(buildApp(), method, path, body)
      .set('x-user-role', 'super-admin')
      .set('x-admin-key', 'anything');
    expect(res.status).toBe(401);
  });

  it('an arbitrary x-admin-key does not revoke a trust anchor', async () => {
    const res = await send(buildApp(), 'post', '/api/trust-anchors/anchor_1/revoke', { reason: 'x' })
      .set('x-admin-key', 'anything');
    expect(res.status).toBe(401);
    expect(revokeAnchor).not.toHaveBeenCalled();
  });

  it('an arbitrary x-admin-key does not register an issuer', async () => {
    const res = await send(buildApp(), 'post', '/api/trust-registry/issuers', { did: 'did:evil', name: 'E', role: 'issuer' })
      .set('x-admin-key', 'anything');
    expect(res.status).toBe(401);
    expect(registerIssuer).not.toHaveBeenCalled();
  });
});

describe('verified identity is necessary but not sufficient', () => {
  it('a verified NON-admin is refused (403)', async () => {
    mockActor({ role: 'VERIFIER', status: 'ACTIVE' });
    const res = await send(buildApp(), 'post', '/api/trust-anchors/ingest', {})
      .set('x-test-verified-user', 'user_verifier');
    expect(res.status).toBe(403);
    expect(ingestAllTrustLists).not.toHaveBeenCalled();
  });

  it('a SUSPENDED admin is refused (403)', async () => {
    mockActor({ role: 'ADMIN', status: 'SUSPENDED' });
    const res = await send(buildApp(), 'post', '/api/trust-anchors/ingest', {})
      .set('x-test-verified-user', ADMIN);
    expect(res.status).toBe(403);
  });

  it('a verified caller with no User row is refused (403)', async () => {
    mockActor(null);
    const res = await send(buildApp(), 'post', '/api/trust-anchors/ingest', {})
      .set('x-test-verified-user', 'user_ghost');
    expect(res.status).toBe(403);
  });

  it('an unverified caller is refused (401)', async () => {
    const res = await send(buildApp(), 'post', '/api/trust-anchors/ingest', {});
    expect(res.status).toBe(401);
  });
});

describe('fails closed when it cannot decide', () => {
  it('denies with 503 when the membership lookup throws', async () => {
    userFindUnique.mockRejectedValue(new Error('db down'));
    const res = await send(buildApp(), 'post', '/api/trust-anchors/ingest', {})
      .set('x-test-verified-user', ADMIN);
    expect(res.status).toBe(503);
    expect(ingestAllTrustLists).not.toHaveBeenCalled();
  });
});
