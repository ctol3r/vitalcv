/**
 * applyBundleRevocation.test.ts — revocation must close the public bundle link.
 *
 * The anonymous GET /api/apply/bundle/:bundleId surface previously checked only
 * expiresAt, so a revoked share kept serving the full bundle until its 24h TTL.
 * readPublicBundle now fails closed once any share of the bundle is revoked.
 *
 * The 'revoked → outcome:revoked, no bundle body' case fails against the
 * pre-fix read path (which had no revocation check at all).
 */

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: { findFirst: jest.fn() },
    bundleShareEvent: { findFirst: jest.fn() },
  },
}));
jest.mock('../../../obs/logger', () => ({ log: jest.fn() }));

import prisma from '../../../graphql/prisma_client';
import { readPublicBundle } from '../applyShareService';
import type { ApplyBundle } from '../applyBundle';

const prismaMock = prisma as unknown as {
  verificationArtifact: { findFirst: jest.Mock };
  bundleShareEvent: { findFirst: jest.Mock };
};

const BUNDLE_ID = '22222222-2222-4222-8222-222222222222';

function bundlePayload(overrides?: Partial<ApplyBundle>): ApplyBundle {
  return {
    bundleId: BUNDLE_ID,
    npi: '1003000126',
    clinicianName: 'Dr. Jane Doe',
    trustState: {
      readiness_level: 'L2',
      readiness_score: 78,
      readiness_status: 'PARTIAL',
      computed_at: '2026-08-16T00:00:00.000Z',
    },
    credentials: [],
    issuerProvenance: [],
    monitoringStatus: 'partial',
    profileUrl: 'https://vitalcv.com/p/1003000126',
    generatedAt: '2026-08-16T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    signature: 'sha256deadbeef',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.bundleShareEvent.findFirst.mockResolvedValue(null);
});

it('returns not_found when the bundle artifact does not exist', async () => {
  prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
  const result = await readPublicBundle(BUNDLE_ID);
  expect(result.outcome).toBe('not_found');
  expect(result.bundle).toBeUndefined();
});

it('returns not_found for a non-uuid bundle id (never queries a uuid column with junk)', async () => {
  const result = await readPublicBundle('../../etc/passwd');
  expect(result.outcome).toBe('not_found');
  expect(prismaMock.verificationArtifact.findFirst).not.toHaveBeenCalled();
});

it('returns expired when past TTL', async () => {
  prismaMock.verificationArtifact.findFirst.mockResolvedValue({
    rawPayload: bundlePayload({ expiresAt: new Date(Date.now() - 3_600_000).toISOString() }),
  });
  const result = await readPublicBundle(BUNDLE_ID);
  expect(result.outcome).toBe('expired');
  expect(result.bundle).toBeUndefined();
});

it('FAILS CLOSED: a revoked share closes the link (410, no bundle body)', async () => {
  prismaMock.verificationArtifact.findFirst.mockResolvedValue({ rawPayload: bundlePayload() });
  prismaMock.bundleShareEvent.findFirst.mockResolvedValue({ revokedAt: new Date('2026-08-16T01:00:00.000Z') });

  const result = await readPublicBundle(BUNDLE_ID);

  expect(result.outcome).toBe('revoked');
  expect(result.bundle).toBeUndefined();
  expect(prismaMock.bundleShareEvent.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { bundleId: BUNDLE_ID, revokedAt: { not: null } } }),
  );
});

it('serves a live, unrevoked, unexpired bundle', async () => {
  prismaMock.verificationArtifact.findFirst.mockResolvedValue({ rawPayload: bundlePayload() });
  prismaMock.bundleShareEvent.findFirst.mockResolvedValue(null);

  const result = await readPublicBundle(BUNDLE_ID);

  expect(result.outcome).toBe('ok');
  expect(result.bundle?.bundleId).toBe(BUNDLE_ID);
});

it('fails closed (propagates) when the revocation lookup itself errors — never serves', async () => {
  prismaMock.verificationArtifact.findFirst.mockResolvedValue({ rawPayload: bundlePayload() });
  prismaMock.bundleShareEvent.findFirst.mockRejectedValue(new Error('db down'));

  await expect(readPublicBundle(BUNDLE_ID)).rejects.toThrow('db down');
});
