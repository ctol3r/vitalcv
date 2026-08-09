import express from 'express';
import request from 'supertest';

/**
 * WB-10 export — privacy pins.
 *
 * Mocked Prisma, mirroring gardenNotes.test.ts. What we pin: every table
 * read is scoped by the resolved userId (the export can structurally
 * contain no other user's rows), the document is versioned, and the export
 * is audited before the 2xx with counts only — never content.
 */

const prismaMock = {
  gardenNote: { findMany: jest.fn() },
  gardenNoteRevision: { findMany: jest.fn() },
  gardenNoteLink: { findMany: jest.fn() },
  gardenCvEntry: { findMany: jest.fn() },
  auditEvent: { create: jest.fn() },
  $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

const ALICE = '11111111-1111-4111-8111-111111111111';

jest.mock('../intake', () => ({
  requireInternalUserId: jest.fn(async () => ALICE),
}));

import { registerGardenRoutes } from '../gardenNotes';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerGardenRoutes(app);
  return app;
}

afterEach(() => jest.clearAllMocks());

describe('WB-10 GET /api/profile/garden/export', () => {
  it('scopes every table read to the resolved user — no foreign rows possible', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    prismaMock.gardenNoteRevision.findMany.mockResolvedValue([]);
    prismaMock.gardenNoteLink.findMany.mockResolvedValue([]);
    prismaMock.gardenCvEntry.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockResolvedValue({});

    const res = await request(buildApp()).get('/api/profile/garden/export');
    expect(res.status).toBe(200);

    for (const model of [
      prismaMock.gardenNote,
      prismaMock.gardenNoteRevision,
      prismaMock.gardenNoteLink,
      prismaMock.gardenCvEntry,
    ]) {
      expect(model.findMany.mock.calls[0][0].where).toEqual({ userId: ALICE });
    }
  });

  it('returns a versioned document with counts and all four collections', async () => {
    const note = { id: 'n1', userId: ALICE, title: 't', body: 'b', tags: [] };
    prismaMock.gardenNote.findMany.mockResolvedValue([note]);
    prismaMock.gardenNoteRevision.findMany.mockResolvedValue([]);
    prismaMock.gardenNoteLink.findMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]);
    prismaMock.gardenCvEntry.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockResolvedValue({});

    const res = await request(buildApp()).get('/api/profile/garden/export');
    expect(res.body.format).toBe('vitalcv-workbench-export/v1');
    expect(res.body.exportedAt).toEqual(expect.any(String));
    expect(res.body.counts).toEqual({ notes: 1, revisions: 0, links: 2, cvEntries: 0 });
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.links).toHaveLength(2);
  });

  it('audits before the 2xx with counts only — never note text', async () => {
    const secret = 'private clinical reflection';
    prismaMock.gardenNote.findMany.mockResolvedValue([
      { id: 'n1', userId: ALICE, title: 'secret title', body: secret, tags: [] },
    ]);
    prismaMock.gardenNoteRevision.findMany.mockResolvedValue([]);
    prismaMock.gardenNoteLink.findMany.mockResolvedValue([]);
    prismaMock.gardenCvEntry.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockResolvedValue({});

    const res = await request(buildApp()).get('/api/profile/garden/export');
    expect(res.status).toBe(200);

    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1);
    const audit = prismaMock.auditEvent.create.mock.calls[0][0].data;
    expect(audit.type).toBe('garden_export_generated');
    expect(audit.metadata).toEqual({
      counts: { notes: 1, revisions: 0, links: 0, cvEntries: 0 },
    });
    expect(JSON.stringify(audit)).not.toContain(secret);
  });

  it('a failed audit write fails the export — no unaudited egress', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    prismaMock.gardenNoteRevision.findMany.mockResolvedValue([]);
    prismaMock.gardenNoteLink.findMany.mockResolvedValue([]);
    prismaMock.gardenCvEntry.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockRejectedValue(new Error('audit store down'));

    const res = await request(buildApp()).get('/api/profile/garden/export');
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
