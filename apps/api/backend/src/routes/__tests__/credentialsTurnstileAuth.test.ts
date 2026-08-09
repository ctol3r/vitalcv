/**
 * Credentials family — the two routes that could be closed.
 *
 * Unlike batches 1-3, this family could NOT be closed wholesale. Of its 13
 * unguarded mutations, 11 have live callers: `ingest`/`ingest-npi` serve the
 * PUBLIC anonymous onboarding preview (`/onboarding` is public end-to-end, so
 * an identity gate there breaks clinician activation), `present`/`selective`
 * and the wallet DELETEs are used by wallet-sdk, verifier-sdk and live web
 * components, and `issue`/`verify`/`accept` are the issuer/verifier SDK
 * surfaces. Their dispositions are per-route product decisions and are recorded
 * in docs/security/turnstile-route-dispositions.md — not guessed at here.
 *
 * These two are orphans, and both are privileged:
 *
 *   POST /api/credentials/export/wallet   takes `subject` + `credentialIds`
 *                                         from the body and builds a wallet
 *                                         payload for them — a read of another
 *                                         subject's credentials wearing a POST.
 *                                         Only reference: its own OpenAPI entry.
 *   POST /api/credentials/sd-jwt/issue    anonymous credential ISSUANCE for a
 *                                         caller-supplied holderDid + claims.
 *                                         Gated behind FEATURE_SD_JWT_ISSUER,
 *                                         so it is latent rather than live —
 *                                         the same shape as /api/api-keys, and
 *                                         guarded now rather than when the flag
 *                                         flips.
 */
process.env.FEATURE_SD_JWT_ISSUER = 'true';
process.env.ISSUER_KEY_ENCRYPTION_SECRET = 'credentials-turnstile-test-secret';

import express from 'express';
import request, { type Test } from 'supertest';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../services/credentials/chapiBridge', () => ({
  createPresentationRequest: jest.fn(),
  createStorePayload: jest.fn(),
}));
jest.mock('../../services/credentials/smartHealthCards', () => ({
  exportSmartHealthCardFile: jest.fn(),
  exportSmartHealthDeepLink: jest.fn(),
  exportSmartHealthQrPayload: jest.fn(),
}));

import { exportSmartHealthCardFile } from '../../services/credentials/smartHealthCards';
import { registerWalletExportRoutes } from '../walletExport';

const SECRET = 'credentials-turnstile-secret';
const BOGUS_ORG = '00000000-0000-4000-8000-000000000000';

function makeApp() {
  const app = express();
  app.use(express.json());
  registerWalletExportRoutes(app);
  return app;
}

function post(path: string, body: Record<string, unknown>): Test {
  return (request(makeApp()) as unknown as { post: (p: string) => Test }).post(path).send(body);
}

const EXPORT_BODY = {
  subject: '1407202518',
  credentialIds: ['11111111-1111-4111-8111-111111111111'],
  exportType: 'smart_health_card_file',
};

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

// Module-scope env above is process-wide: jest runs maxWorkers:1, so these
// persist into later test FILES unless removed here.
afterAll(() => {
  delete process.env.FEATURE_SD_JWT_ISSUER;
  delete process.env.ISSUER_KEY_ENCRYPTION_SECRET;
});

describe('POST /api/credentials/export/wallet', () => {
  it('refuses the production x-org-id bypass, and exports nothing', async () => {
    const res = await post('/api/credentials/export/wallet', EXPORT_BODY)
      .set('x-org-id', BOGUS_ORG);

    expect(res.status).toBe(403);
    // The stronger claim: no wallet payload was built for that subject.
    expect(exportSmartHealthCardFile as jest.Mock).not.toHaveBeenCalled();
  });

  it('refuses an anonymous caller', async () => {
    const res = await post('/api/credentials/export/wallet', EXPORT_BODY);
    expect(res.status).toBe(403);
  });

  it('refuses a wrong secret', async () => {
    const res = await post('/api/credentials/export/wallet', EXPORT_BODY)
      .set('x-monitoring-secret', 'wrong');
    expect(res.status).toBe(403);
  });

  it('fails CLOSED when MONITORING_SECRET is unset', async () => {
    delete process.env.MONITORING_SECRET;
    const res = await post('/api/credentials/export/wallet', EXPORT_BODY)
      .set('x-org-id', BOGUS_ORG);
    expect(res.status).toBe(403);
  });

  it('lets an operator holding the secret reach the handler', async () => {
    const res = await post('/api/credentials/export/wallet', EXPORT_BODY)
      .set('x-monitoring-secret', SECRET);
    // Past the guard: anything but 403. (The handler may still 4xx/5xx on the
    // mocked service — reaching it is the claim under test.)
    expect(res.status).not.toBe(403);
  });
});
