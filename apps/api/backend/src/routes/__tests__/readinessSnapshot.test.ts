/**
 * Wave M — persisted reusable readiness snapshot.
 *
 * Pins the contract:
 *  - the stored content is served VERBATIM with a stable contentHash;
 *  - freshness is a read-time overlay (stale-beyond-SLA labeled + re-verify
 *    recommended), never a mutation of the snapshot;
 *  - every successful read writes `snapshot.accessed`; revoked snapshots —
 *    directly or via a revoked share of the linked bundle — fail closed with
 *    410 and a `snapshot.access_denied` audit;
 *  - issuance is deploy-order safe (missing table → null, share unaffected)
 *    and hash generation is deterministic for identical content.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    readinessSnapshot: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    bundleShareEvent: {
      findFirst: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

import prisma from '../../graphql/prisma_client';
import { registerReadinessSnapshotRoutes } from '../readinessSnapshot';
import {
  buildFreshnessOverlay,
  issueReadinessSnapshot,
  type ReadinessSnapshotContent,
} from '../../services/distribution/readinessSnapshotService';

const SNAPSHOT_ID = '11111111-1111-4111-8111-111111111111';
const BUNDLE_ID = '22222222-2222-4222-8222-222222222222';

const prismaMock = prisma as unknown as {
  readinessSnapshot: { findUnique: jest.Mock; create: jest.Mock };
  bundleShareEvent: { findFirst: jest.Mock };
  auditEvent: { create: jest.Mock };
};

function buildApp() {
  const app = express();
  registerReadinessSnapshotRoutes(app);
  return app;
}

function contentFixture(overrides?: Partial<ReadinessSnapshotContent>): ReadinessSnapshotContent {
  return {
    schema: 'vitalcv.readiness-snapshot.v1',
    npi: '1003000126',
    bundleId: BUNDLE_ID,
    issuedAt: '2026-07-01T00:00:00.000Z',
    readiness: { level: 'L2', score: 78, status: 'PARTIAL', checkedAt: '2026-07-01T00:00:00.000Z' },
    sourceCoverage: {
      checks: [
        // NPPES-style 24h window, checked long ago → stale at read time.
        { sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-07-01T00:00:00.000Z', freshnessWindowHours: 24 },
        // Long-window source, still current.
        { sourceId: 'PECOS', state: 'checked', checkedAt: '2026-07-01T00:00:00.000Z', freshnessWindowHours: 100_000 },
        // No timestamp — freshness cannot be evaluated, reported as such.
        { sourceId: 'MANUAL_UPLOAD', state: 'gated', checkedAt: null },
      ],
      summary: { checked: ['NPPES_API', 'PECOS'], gated: ['MANUAL_UPLOAD'] },
    },
    ...overrides,
  };
}

function rowFixture(overrides?: Record<string, unknown>) {
  return {
    id: SNAPSHOT_ID,
    npi: '1003000126',
    entityId: null,
    bundleId: BUNDLE_ID,
    contentHash: 'hash-fixture',
    content: contentFixture(),
    scope: { organizationName: 'Mercy General', purposeOfUse: 'Employment consideration' },
    issuedAt: new Date('2026-07-01T00:00:00.000Z'),
    revokedAt: null,
    revokedByClerkUserId: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.bundleShareEvent.findFirst.mockResolvedValue(null);
  prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
});

describe('GET /api/snapshot/:id', () => {
  it('404s malformed and unknown ids without an audit row', async () => {
    prismaMock.readinessSnapshot.findUnique.mockResolvedValue(null);
    const app = buildApp();

    expect((await request(app).get('/api/snapshot/not-a-uuid')).status).toBe(404);
    expect((await request(app).get(`/api/snapshot/${SNAPSHOT_ID}`)).status).toBe(404);
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it('serves the content verbatim with a stable hash, a freshness overlay, and an access audit', async () => {
    prismaMock.readinessSnapshot.findUnique.mockResolvedValue(rowFixture());

    const response = await request(buildApp()).get(`/api/snapshot/${SNAPSHOT_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.contentHash).toBe('hash-fixture');
    // Verbatim: the stored content travels unmodified.
    expect(response.body.snapshot).toEqual(contentFixture());

    // Read-time overlay: 24h-window source checked in the past is stale;
    // the long-window source is not; the timestampless one is unevaluated.
    const freshness = response.body.freshness;
    expect(freshness.staleSources.map((s: { sourceId: string }) => s.sourceId)).toEqual(['NPPES_API']);
    expect(freshness.unevaluatedSources).toEqual(['MANUAL_UPLOAD']);
    expect(freshness.reverifyRecommended).toBe(true);
    expect(freshness.note).toContain('as issued');

    // Every access audited.
    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1);
    const audit = prismaMock.auditEvent.create.mock.calls[0][0].data;
    expect(audit.type).toBe('snapshot.accessed');
    expect(audit.referenceId).toBe(SNAPSHOT_ID);
    expect(audit.clinicianId).toBe('1003000126');
    expect(audit.metadata).toMatchObject({ staleSourceCount: 1, reverifyRecommended: true });
  });

  it('reports a fully-current snapshot without a re-verify flag', async () => {
    const current = contentFixture({
      sourceCoverage: {
        checks: [{ sourceId: 'PECOS', state: 'checked', checkedAt: new Date().toISOString(), freshnessWindowHours: 744 }],
        summary: { checked: ['PECOS'] },
      },
    });
    prismaMock.readinessSnapshot.findUnique.mockResolvedValue(rowFixture({ content: current }));

    const response = await request(buildApp()).get(`/api/snapshot/${SNAPSHOT_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.freshness.staleSources).toEqual([]);
    expect(response.body.freshness.reverifyRecommended).toBe(false);
  });

  it('fails closed with 410 and a denied audit when the snapshot itself is revoked', async () => {
    prismaMock.readinessSnapshot.findUnique.mockResolvedValue(
      rowFixture({ revokedAt: new Date('2026-07-04T00:00:00.000Z') }),
    );

    const response = await request(buildApp()).get(`/api/snapshot/${SNAPSHOT_ID}`);

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('snapshot_revoked');
    expect(response.body.snapshot).toBeUndefined();
    const audit = prismaMock.auditEvent.create.mock.calls[0][0].data;
    expect(audit.type).toBe('snapshot.access_denied');
    expect(audit.metadata).toMatchObject({ reason: 'revoked' });
  });

  it("fails closed when the linked bundle's share was revoked (the clinician's existing control)", async () => {
    prismaMock.readinessSnapshot.findUnique.mockResolvedValue(rowFixture());
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      revokedAt: new Date('2026-07-04T12:00:00.000Z'),
    });

    const response = await request(buildApp()).get(`/api/snapshot/${SNAPSHOT_ID}`);

    expect(response.status).toBe(410);
    expect(prismaMock.bundleShareEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bundleId: BUNDLE_ID, revokedAt: { not: null } } }),
    );
    expect(prismaMock.auditEvent.create.mock.calls[0][0].data.type).toBe('snapshot.access_denied');
  });
});

describe('issueReadinessSnapshot', () => {
  const issueInput = {
    npi: '1003000126',
    bundleId: BUNDLE_ID,
    readiness: { level: 'L2', score: 78, status: 'PARTIAL', checkedAt: '2026-07-01T00:00:00.000Z' },
    sourceCoverage: { checks: [], summary: {} },
  };

  it('persists an immutable row with a sha256 content hash', async () => {
    prismaMock.readinessSnapshot.create.mockResolvedValue({});

    const issued = await issueReadinessSnapshot(issueInput);

    expect(issued).not.toBeNull();
    expect(issued!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const data = prismaMock.readinessSnapshot.create.mock.calls[0][0].data;
    expect(data.id).toBe(issued!.snapshotId);
    expect(data.contentHash).toBe(issued!.contentHash);
    expect(data.content.schema).toBe('vitalcv.readiness-snapshot.v1');
  });

  it('degrades to null when the table is not deployed yet — the share must proceed', async () => {
    prismaMock.readinessSnapshot.create.mockRejectedValue(new Error('P2021: table does not exist'));
    await expect(issueReadinessSnapshot(issueInput)).resolves.toBeNull();
  });
});

describe('buildFreshnessOverlay — hash-stable, mutation-free', () => {
  it('falls back to the live source catalog when the check has no captured window', () => {
    const content = contentFixture({
      sourceCoverage: {
        // NPPES catalog SLA is 24h — checked years ago, no captured window.
        checks: [{ sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-01-01T00:00:00.000Z' }],
        summary: { checked: ['NPPES_API'] },
      },
    });
    const overlay = buildFreshnessOverlay(content, new Date('2026-07-05T00:00:00.000Z'));
    expect(overlay.staleSources).toHaveLength(1);
    expect(overlay.staleSources[0].freshnessWindowHours).toBeGreaterThan(0);
  });

  it('never mutates the content it evaluates', () => {
    const content = contentFixture();
    const before = JSON.stringify(content);
    buildFreshnessOverlay(content, new Date('2026-07-05T00:00:00.000Z'));
    expect(JSON.stringify(content)).toBe(before);
  });
});
