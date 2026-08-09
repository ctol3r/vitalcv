import express from 'express';
import request from 'supertest';

/**
 * WB-06 retrieval layer — privacy and boundedness pins.
 *
 * Mocked Prisma, mirroring gardenNotes.test.ts. What we pin: the list is
 * never unbounded; every filter (search, tag, cursor) lives INSIDE the
 * caller's userId scope; a foreign cursor and a nonexistent cursor are
 * indistinguishable (no cross-user existence oracle); the bare call keeps
 * the previous response shape.
 */

const prismaMock = {
  gardenNote: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  auditEvent: { create: jest.fn() },
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

function fakeNote(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    userId: ALICE,
    title: `note ${i}`,
    body: `body ${i}`,
    tags: [],
    status: 'unfiled',
    promotedAt: null,
    createdAt: new Date(2026, 0, 1 + i),
    updatedAt: new Date(2026, 0, 1 + i),
  };
}

afterEach(() => jest.clearAllMocks());

describe('WB-06 GET /api/profile/garden/notes', () => {
  it('bare call is bounded, newest-first, previous shape plus nextCursor', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([fakeNote(1)]);
    const res = await request(buildApp()).get('/api/profile/garden/notes');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.nextCursor).toBeNull();

    const args = prismaMock.gardenNote.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: ALICE });
    expect(args.take).toBe(101); // default 100 + 1 lookahead — never unbounded
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('search and tag filters live INSIDE the userId scope', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get(
      '/api/profile/garden/notes?q=acls&tag=research',
    );
    expect(res.status).toBe(200);

    const where = prismaMock.gardenNote.findMany.mock.calls[0][0].where;
    // userId is a top-level AND — search can narrow, never widen.
    expect(where.userId).toBe(ALICE);
    expect(where.tags).toEqual({ has: 'research' });
    expect(where.OR).toEqual([
      { title: { contains: 'acls', mode: 'insensitive' } },
      { body: { contains: 'acls', mode: 'insensitive' } },
    ]);
  });

  it('clamps limit to the maximum', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    await request(buildApp()).get('/api/profile/garden/notes?limit=99999');
    expect(prismaMock.gardenNote.findMany.mock.calls[0][0].take).toBe(201); // max 200 + 1
  });

  it('ignores a malformed limit and uses the default', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    await request(buildApp()).get('/api/profile/garden/notes?limit=DROP%20TABLE');
    expect(prismaMock.gardenNote.findMany.mock.calls[0][0].take).toBe(101);
  });

  it('emits nextCursor only when a further page exists', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => fakeNote(i));
    prismaMock.gardenNote.findMany.mockResolvedValue(rows);
    const res = await request(buildApp()).get('/api/profile/garden/notes');
    expect(res.body.notes).toHaveLength(100);
    expect(res.body.nextCursor).toBe(rows[99].id);
  });

  it('a valid own-note cursor is anchored inside the userId scope', async () => {
    const anchor = fakeNote(5);
    prismaMock.gardenNote.findFirst.mockResolvedValue({ id: anchor.id });
    prismaMock.gardenNote.findMany.mockResolvedValue([]);

    const res = await request(buildApp()).get(
      `/api/profile/garden/notes?cursor=${anchor.id}`,
    );
    expect(res.status).toBe(200);
    // Ownership check ran scoped to the caller.
    expect(prismaMock.gardenNote.findFirst).toHaveBeenCalledWith({
      where: { id: anchor.id, userId: ALICE },
      select: { id: true },
    });
    const args = prismaMock.gardenNote.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: anchor.id });
    expect(args.skip).toBe(1);
  });

  it("a foreign user's note id and a nonexistent id are the SAME 400", async () => {
    // Both cases: the scoped ownership probe misses.
    prismaMock.gardenNote.findFirst.mockResolvedValue(null);

    const foreign = await request(buildApp()).get(
      '/api/profile/garden/notes?cursor=99999999-9999-4999-8999-999999999999',
    );
    const missing = await request(buildApp()).get(
      '/api/profile/garden/notes?cursor=88888888-8888-4888-8888-888888888888',
    );

    expect(foreign.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(foreign.body).toEqual(missing.body); // no existence oracle
    expect(prismaMock.gardenNote.findMany).not.toHaveBeenCalled();
  });
});
