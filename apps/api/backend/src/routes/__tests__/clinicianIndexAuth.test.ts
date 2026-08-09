/**
 * The turnstile routes that named real clinicians.
 *
 * Both sat behind the global tenant guard, which accepted the PRESENCE of a
 * caller-supplied `x-org-id`, and neither reads the org — so the header was a
 * turnstile token, not a scope, and an anonymous caller got the whole dataset.
 * Measured in production 2026-08-08:
 *
 *   /api/index/clinicians   24 clinicians, 16 check-digit-valid NPIs, each with
 *                           a readiness score, trust band and gap count
 *   /api/influence/providers 25 providers, 22 check-digit-valid NPIs, each with
 *                           a display label, influence score, percentile and rank
 *
 * A check-digit-valid NPI names a real NPPES registrant, so these are this
 * platform's private assessments of identifiable people.
 *
 * Assertions are on the outcome a caller gets. The `x-org-id` case is the one
 * that matters: without the header the tenant guard 401s anyway, so an
 * anonymous-only test passes even with the guard removed.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: { verificationArtifact: { findMany: jest.fn() } },
}));
jest.mock('../../services/intelligence/intelligenceSignalsService', () => ({
  listProviderInfluenceScores: jest.fn(),
  buildIntelligenceFeed: jest.fn(),
  getGeographyPressureIndex: jest.fn(),
  getInstitutionMomentumIndex: jest.fn(),
  getProviderInfluenceScore: jest.fn(),
  getProviderIntelligenceSummary: jest.fn(),
  getProviderTrustScore: jest.fn(),
  getSpecialtyPressureIndex: jest.fn(),
  listGeographyPressureIndexes: jest.fn(),
  listInstitutionMomentumIndexes: jest.fn(),
  listSpecialtyPressureIndexes: jest.fn(),
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

import prisma from '../../graphql/prisma_client';
import { listProviderInfluenceScores } from '../../services/intelligence/intelligenceSignalsService';
import { registerCredentialIndexRoutes } from '../credentialIndex';
import { registerIntelligenceSignalRoutes } from '../intelligenceSignals';

const SECRET = 'index-auth-test-secret';
const BOGUS_ORG = '00000000-0000-4000-8000-000000000000';

function makeApp() {
  const app = express();
  registerCredentialIndexRoutes(app);
  registerIntelligenceSignalRoutes(app);
  return app;
}

/** The data producers behind each route — proof they were never reached. */
const PRODUCERS = [
  (prisma as unknown as { verificationArtifact: { findMany: jest.Mock } }).verificationArtifact
    .findMany,
  listProviderInfluenceScores as jest.Mock,
];

const GUARDED = ['/api/index/clinicians', '/api/index/stats', '/api/influence/providers'];

let previousSecret: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  previousSecret = process.env.MONITORING_SECRET;
  process.env.MONITORING_SECRET = SECRET;
  (prisma as unknown as { verificationArtifact: { findMany: jest.Mock } })
    .verificationArtifact.findMany.mockResolvedValue([]);
  (listProviderInfluenceScores as jest.Mock).mockResolvedValue({ scores: [], total: 0 });
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.MONITORING_SECRET;
  else process.env.MONITORING_SECRET = previousSecret;
});

describe('clinician-identifying turnstile routes', () => {
  it.each(GUARDED)('%s refuses an anonymous caller', async (path) => {
    const res = await request(makeApp()).get(path);
    expect(res.status).toBe(403);
  });

  it.each(GUARDED)('%s refuses the production x-org-id bypass', async (path) => {
    const res = await request(makeApp()).get(path).set('x-org-id', BOGUS_ORG);

    expect(res.status).toBe(403);
    // Nothing was even computed, so no clinician record reached the response path.
    for (const producer of PRODUCERS) expect(producer).not.toHaveBeenCalled();
  });

  it.each(GUARDED)('%s refuses a wrong secret', async (path) => {
    const res = await request(makeApp()).get(path).set('x-monitoring-secret', 'wrong');
    expect(res.status).toBe(403);
  });

  it.each(GUARDED)('%s serves an operator holding the secret', async (path) => {
    const res = await request(makeApp()).get(path).set('x-monitoring-secret', SECRET);
    expect(res.status).not.toBe(403);
  });

  it.each(GUARDED)('%s fails CLOSED when MONITORING_SECRET is unset', async (path) => {
    delete process.env.MONITORING_SECRET;
    const res = await request(makeApp()).get(path).set('x-org-id', BOGUS_ORG);
    expect(res.status).toBe(403);
  });
});
