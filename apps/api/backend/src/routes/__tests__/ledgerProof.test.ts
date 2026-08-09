import express from 'express';
import request from 'supertest';
import { createHash } from 'crypto';

/**
 * Ledger proof routes — public verifiability pins.
 *
 * Mocked Prisma, mirroring the gardenNotes test idiom. What we pin: the
 * routes are anonymous by design but hash-only (no event metadata ever in a
 * response), a served proof actually verifies, an unreproducible legacy
 * batch degrades honestly (409) instead of serving a proof that fails, and
 * malformed identifiers are rejected before any query runs.
 */

const prismaMock = {
  anchorRoot: {
    findUnique: jest.fn(),
  },
  auditEvent: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { registerLedgerProofRoutes } from '../ledgerProof';
import { computeLeafHashes, buildTreeForBatch, verifyLeafProof } from '../../services/ledger/anchorProof';

function buildApp() {
  const app = express();
  registerLedgerProofRoutes(app);
  return app;
}

const ROOT_ROW = {
  merkleRoot: '',
  eventCount: 3,
  rekorStatus: 'witnessed',
  rekorUuid: 'uuid-1',
  rekorLogIndex: '99',
  tsaStatus: 'witnessed',
  tsaToken: Buffer.from([0x30, 0x00]),
  tsaUrl: 'http://timestamp.digicert.com',
  witnessedAt: new Date('2026-08-09T00:00:00Z'),
  createdAt: new Date('2026-08-09T00:00:00Z'),
};

function seedBatch() {
  const events = Array.from({ length: 3 }, (_, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    hash: createHash('sha256').update(`event-${i}`).digest('hex'),
  }));
  const leaves = computeLeafHashes(events);
  const tree = buildTreeForBatch([...leaves.values()]);
  return { events, tree };
}

afterEach(() => jest.clearAllMocks());

describe('GET /api/ledger/anchors/:root', () => {
  it('rejects a malformed root without querying', async () => {
    const res = await request(buildApp()).get('/api/ledger/anchors/nothex');
    expect(res.status).toBe(400);
    expect(prismaMock.anchorRoot.findUnique).not.toHaveBeenCalled();
  });

  it('404s an unknown root', async () => {
    prismaMock.anchorRoot.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get(`/api/ledger/anchors/${'b'.repeat(64)}`);
    expect(res.status).toBe(404);
  });

  it('serves witness evidence: statuses, Rekor pointer, TSA token, instructions — hashes only', async () => {
    const root = 'c'.repeat(64);
    prismaMock.anchorRoot.findUnique.mockResolvedValue({ ...ROOT_ROW, merkleRoot: root });
    const res = await request(buildApp()).get(`/api/ledger/anchors/${root}`);
    expect(res.status).toBe(200);
    expect(res.body.anchor.merkleRoot).toBe(root);
    expect(res.body.anchor.rekor.uuid).toBe('uuid-1');
    expect(res.body.anchor.rekor.searchUrl).toContain('uuid-1');
    expect(res.body.anchor.tsa.tokenBase64).toBe(Buffer.from([0x30, 0x00]).toString('base64'));
    expect(res.body.verify.artifact).toContain('lowercase hex');
    // Hash-only contract: no event metadata keys anywhere in the payload.
    const flat = JSON.stringify(res.body);
    expect(flat).not.toContain('clinicianId');
    expect(flat).not.toContain('metadata');
  });
});

describe('GET /api/ledger/events/:eventId/proof', () => {
  it('rejects a non-UUID event id without querying', async () => {
    const res = await request(buildApp()).get('/api/ledger/events/not-a-uuid/proof');
    expect(res.status).toBe(400);
    expect(prismaMock.auditEvent.findUnique).not.toHaveBeenCalled();
  });

  it('404s an unanchored event', async () => {
    prismaMock.auditEvent.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000000',
      hash: 'h',
      anchored: false,
      merkleRoot: null,
    });
    const res = await request(buildApp()).get(
      '/api/ledger/events/00000000-0000-4000-8000-000000000000/proof',
    );
    expect(res.status).toBe(404);
  });

  it('serves a proof that actually verifies against the anchored root', async () => {
    const { events, tree } = seedBatch();
    const target = events[1];
    prismaMock.auditEvent.findUnique.mockResolvedValue({
      id: target.id,
      hash: target.hash,
      anchored: true,
      merkleRoot: tree.root,
    });
    prismaMock.auditEvent.findMany.mockResolvedValue(events);
    prismaMock.anchorRoot.findUnique.mockResolvedValue({ ...ROOT_ROW, merkleRoot: tree.root });

    const res = await request(buildApp()).get(`/api/ledger/events/${target.id}/proof`);
    expect(res.status).toBe(200);
    expect(res.body.merkleRoot).toBe(tree.root);
    expect(
      verifyLeafProof({
        leafHash: res.body.leafHash,
        leafIndex: res.body.leafIndex,
        proofPath: res.body.proofPath,
        root: res.body.merkleRoot,
      }),
    ).toBe(true);
    expect(res.body.anchor.rekor.status).toBe('witnessed');
  });

  it('degrades honestly (409) when the batch cannot be reproduced', async () => {
    const { events, tree } = seedBatch();
    prismaMock.auditEvent.findUnique.mockResolvedValue({
      id: events[0].id,
      hash: events[0].hash,
      anchored: true,
      merkleRoot: 'd'.repeat(64), // stored root does not match recomputation
    });
    prismaMock.auditEvent.findMany.mockResolvedValue(events);

    const res = await request(buildApp()).get(`/api/ledger/events/${events[0].id}/proof`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('proof_unavailable');
    expect(tree.root).not.toBe('d'.repeat(64));
  });
});
