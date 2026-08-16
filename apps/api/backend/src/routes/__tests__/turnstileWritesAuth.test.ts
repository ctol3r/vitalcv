/**
 * Turnstile batch 3 — the integrity-critical WRITES.
 *
 * The read census was the smaller half of G1. Enumerating mutations behind the
 * global tenant guard finds 111 with no authorization beyond it, and these
 * eleven are the ones that write trust-bearing state:
 *
 *   /api/crypto/sign|resign/{artifact,capsule}  persistent writes — signArtifact
 *                                               rewrites VerificationArtifact
 *                                               .rawPayload and appends to
 *                                               _cryptoHistory
 *   /api/crypto/batch-resign                    the same, up to 2000 artifacts
 *                                               for ONE NPI in a single call
 *   /api/did/register|status|key                identity injection: binds a
 *                                               caller-supplied publicKey to a
 *                                               DID (process-local Map)
 *   /api/coordination/revoke|ingest|cleanup     drives revocation, ingestion,
 *                                               and an unparameterised sweep
 *
 * The strongest assertion in here is not the status code — it is that the
 * SERVICE behind each route was never invoked. A 403 with the service already
 * called would still mean the write happened.
 *
 * The `x-org-id` case is the load-bearing one: without the header the tenant
 * guard 401s anyway, so an anonymous-only test passes with the guard removed.
 */
import express from 'express';
import request, { type Test } from 'supertest';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../services/crypto/artifactCryptoService', () => ({
  signArtifact: jest.fn(),
  signCapsule: jest.fn(),
  batchResignArtifacts: jest.fn(),
  getNpiCryptoStatus: jest.fn(),
  verifyArtifactSignature: jest.fn(),
  verifyCapsuleSignature: jest.fn(),
}));
jest.mock('../../services/identity/didRegistry', () => ({
  registerDID: jest.fn(),
  listDIDs: jest.fn(),
  updateDIDStatus: jest.fn(),
  rotateDIDKey: jest.fn(),
}));
jest.mock('../../services/identity/didResolver', () => ({ resolveDid: jest.fn() }));
jest.mock('../../services/coordination/coordinationService', () => ({
  coordinateRevocation: jest.fn(),
  coordinateIngestion: jest.fn(),
  getCoordinationStatus: jest.fn(),
}));
jest.mock('../../services/coordination/operationRegistry', () => ({ listPending: jest.fn(() => []) }));
jest.mock('../../services/coordination/graphCleanup', () => ({ runCleanup: jest.fn() }));

import * as crypto from '../../services/crypto/artifactCryptoService';
import * as did from '../../services/identity/didRegistry';
import * as coordination from '../../services/coordination/coordinationService';
import { runCleanup } from '../../services/coordination/graphCleanup';
import { registerCryptoProtocolRoutes } from '../cryptoProtocol';
import { registerDIDRoutes } from '../did';
import { registerCoordinationRoutes } from '../coordination';

const SECRET = 'writes-test-secret';
const BOGUS_ORG = '00000000-0000-4000-8000-000000000000';
const UUID = '11111111-1111-4111-8111-111111111111';
const NPI = '1558395518';

function makeApp() {
  const app = express();
  app.use(express.json());
  registerCryptoProtocolRoutes(app);
  registerDIDRoutes(app);
  registerCoordinationRoutes(app);
  return app;
}

/** Every write closed in this batch, with a body that would otherwise succeed. */
const WRITES: Array<[string, string, Record<string, unknown> | undefined]> = [
  ['post', `/api/crypto/sign/artifact/${UUID}`, { suite: 'ed25519' }],
  ['post', `/api/crypto/sign/capsule/${UUID}`, { suite: 'ed25519' }],
  ['post', `/api/crypto/resign/artifact/${UUID}`, { suite: 'ed25519' }],
  ['post', `/api/crypto/resign/capsule/${UUID}`, { suite: 'ed25519' }],
  ['post', '/api/crypto/batch-resign', { npi: NPI, suite: 'ed25519', limit: 2000 }],
  ['post', '/api/did/register', { subjectType: 'issuer', publicKey: 'PEM', identifier: 'x' }],
  ['patch', `/api/did/key/issuer/${UUID}/status`, { status: 'revoked' }],
  ['patch', `/api/did/key/issuer/${UUID}/key`, { publicKey: 'ATTACKER-PEM' }],
  ['post', '/api/coordination/revoke', { credentialId: UUID, reason: 'because' }],
  ['post', '/api/coordination/ingest', { npi: NPI, payload: {} }],
  ['post', '/api/coordination/cleanup', {}],
];

const LABELS = WRITES.map(([m, p]) => `${m.toUpperCase()} ${p}`);

/** Every service that performs or persists a write in this batch. */
const WRITERS: Array<[string, jest.Mock]> = [
  ['signArtifact', crypto.signArtifact as jest.Mock],
  ['signCapsule', crypto.signCapsule as jest.Mock],
  ['batchResignArtifacts', crypto.batchResignArtifacts as jest.Mock],
  ['registerDID', did.registerDID as jest.Mock],
  ['updateDIDStatus', did.updateDIDStatus as jest.Mock],
  ['rotateDIDKey', did.rotateDIDKey as jest.Mock],
  ['coordinateRevocation', coordination.coordinateRevocation as jest.Mock],
  ['coordinateIngestion', coordination.coordinateIngestion as jest.Mock],
  ['runCleanup', runCleanup as jest.Mock],
];

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

describe('integrity-critical writes refuse the x-org-id bypass', () => {
  it.each(WRITES.map((w, i) => [LABELS[i], w] as const))(
    '%s refuses a caller holding only x-org-id',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);
      expect(res.status).toBe(403);
    },
  );

  it.each(WRITES.map((w, i) => [LABELS[i], w] as const))(
    '%s refuses an anonymous caller',
    async (_label, [method, path, body]) => {
      const res = await send(method, path, body);
      expect(res.status).toBe(403);
    },
  );

  it.each(WRITES.map((w, i) => [LABELS[i], w] as const))(
    '%s fails CLOSED when MONITORING_SECRET is unset',
    async (_label, [method, path, body]) => {
      delete process.env.MONITORING_SECRET;
      const res = await send(method, path, body).set('x-org-id', BOGUS_ORG);
      expect(res.status).toBe(403);
    },
  );
});

describe('no write actually happened', () => {
  it('not one writing service was invoked by the full bypass sweep', async () => {
    for (const [method, path, body] of WRITES) {
      await send(method, path, body).set('x-org-id', BOGUS_ORG);
    }

    for (const [name, fn] of WRITERS) {
      expect([name, fn.mock.calls.length]).toEqual([name, 0]);
    }
  });
});

describe('operators still get through', () => {
  it('the secret reaches the handler rather than the guard', async () => {
    (crypto.batchResignArtifacts as jest.Mock).mockResolvedValue({
      signedCount: 0,
      failedCount: 0,
    });

    const res = await send('post', '/api/crypto/batch-resign', { npi: NPI, suite: 'ed25519' })
      .set('x-monitoring-secret', SECRET);

    expect(res.status).not.toBe(403);
    expect(crypto.batchResignArtifacts as jest.Mock).toHaveBeenCalled();
  });
});
