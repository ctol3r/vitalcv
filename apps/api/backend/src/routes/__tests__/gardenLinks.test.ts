import express from 'express';
import request from 'supertest';

/**
 * CC-05 / WB-02 — revisions and typed links: the privacy and provenance
 * proof matrix the wave gate requires.
 *
 * Same harness as gardenNotes.test.ts: mocked Prisma, real routes and
 * services. What is pinned:
 *  - user A cannot read, resolve, backlink, graph-traverse, mutate, or
 *    infer user B's notes, revisions, or links (misses read as 404);
 *  - a caller in an employer/organization context without the clinician's
 *    identity gets 401, and with a different identity gets that identity's
 *    own empty scope — never the clinician's rows;
 *  - no endpoint trusts a caller-provided user id or label, and nothing in
 *    the link/revision domain reads or writes provenance;
 *  - every mutation audits before the 2xx.
 */

const prismaMock = {
  gardenNote: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  gardenCvEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  gardenNoteRevision: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  gardenNoteLink: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  opportunity: {
    findFirst: jest.fn(),
  },
  auditEvent: { create: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
};

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

const USERS: Record<string, string> = {
  clerk_alice: '11111111-1111-4111-8111-111111111111',
  clerk_bob: '22222222-2222-4222-8222-222222222222',
  clerk_employer: '33333333-3333-4333-8333-333333333333',
};

jest.mock('../../services/workspace/workspaceService', () => ({
  ensureWorkspaceUser: jest.fn(async (clerkUserId: string) => {
    const id = USERS[clerkUserId];
    if (!id) throw new Error('unknown test user');
    return { id };
  }),
}));

import { registerGardenRoutes } from '../gardenNotes';

const ALICE = USERS.clerk_alice;
const BOB = USERS.clerk_bob;
const EMPLOYER_USER = USERS.clerk_employer;

const NOTE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOTE_A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const NOTE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REV_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LINK_1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OPP_1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const aliceNote = {
  id: NOTE_A,
  userId: ALICE,
  title: 'Journal club reflection',
  body: 'Original body',
  tags: ['teaching'],
  status: 'unfiled',
  promotedAt: null,
  createdAt: new Date('2026-07-21T00:00:00Z'),
  updatedAt: new Date('2026-07-21T00:00:00Z'),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  registerGardenRoutes(app);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Unknown error' });
    },
  );
  return app;
}

/** The ownership-scoped note lookup every path starts with. */
function scopeGardenNoteFindFirst() {
  prismaMock.gardenNote.findFirst.mockImplementation(async (args: { where: { id: string; userId: string } }) => {
    if (args.where.id === NOTE_A && args.where.userId === ALICE) return aliceNote;
    return null;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
});

describe('identity boundary', () => {
  it('rejects revision, link, backlink, and graph requests without identity', async () => {
    const app = buildApp();
    for (const path of [
      `/api/profile/garden/notes/${NOTE_A}/revisions`,
      `/api/profile/garden/notes/${NOTE_A}/links`,
      `/api/profile/garden/notes/${NOTE_A}/backlinks`,
      `/api/profile/garden/notes/${NOTE_A}/graph`,
    ]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
    expect(prismaMock.gardenNoteLink.findMany).not.toHaveBeenCalled();
    expect(prismaMock.gardenNoteRevision.findMany).not.toHaveBeenCalled();
  });

  it('an org-context caller without clinician identity is refused outright', async () => {
    // Employer surfaces authenticate through org-scoped headers; the garden
    // family reads none of them. Sending them changes nothing: no identity
    // header means 401 before any query runs.
    const res = await request(buildApp())
      .get(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-org-id', 'org_acme_health')
      .set('x-org-role', 'admin');
    expect(res.status).toBe(401);
    expect(prismaMock.gardenNote.findFirst).not.toHaveBeenCalled();
  });
});

describe('cross-user isolation (A vs B, and the employer tenant)', () => {
  it("B cannot list A's revisions — the note reads as not-found", async () => {
    scopeGardenNoteFindFirst();
    const res = await request(buildApp())
      .get(`/api/profile/garden/notes/${NOTE_A}/revisions`)
      .set('x-clerk-user-id', 'clerk_bob');
    expect(res.status).toBe(404);
    // The lookup ran with B's scope; the revision table was never touched.
    expect(prismaMock.gardenNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NOTE_A, userId: BOB } }),
    );
    expect(prismaMock.gardenNoteRevision.findMany).not.toHaveBeenCalled();
  });

  it("B cannot restore A's revision", async () => {
    scopeGardenNoteFindFirst();
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/revisions/${REV_1}/restore`)
      .set('x-clerk-user-id', 'clerk_bob');
    expect(res.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it("B cannot create a link FROM A's note", async () => {
    scopeGardenNoteFindFirst();
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_bob')
      .send({ targetType: 'source_pointer', targetId: 'nppes' });
    expect(res.status).toBe(404);
    expect(prismaMock.gardenNoteLink.create).not.toHaveBeenCalled();
  });

  it("A cannot link TO B's note — target resolution is owner-scoped", async () => {
    prismaMock.gardenNote.findFirst.mockImplementation(async (args: { where: { id: string; userId: string } }) => {
      if (args.where.id === NOTE_A && args.where.userId === ALICE) return aliceNote;
      // B's note exists in the table but never resolves under A's scope.
      return null;
    });
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'note', targetId: NOTE_B });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Link target not found.');
    expect(prismaMock.gardenNoteLink.create).not.toHaveBeenCalled();
  });

  it("A cannot delete B's link", async () => {
    prismaMock.gardenNoteLink.findFirst.mockResolvedValue(null);
    const res = await request(buildApp())
      .delete(`/api/profile/garden/links/${LINK_1}`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(404);
    expect(prismaMock.gardenNoteLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LINK_1, userId: ALICE } }),
    );
    expect(prismaMock.gardenNoteLink.delete).not.toHaveBeenCalled();
  });

  it('an employer-side user with their own identity sees only their own empty scope', async () => {
    scopeGardenNoteFindFirst();
    const res = await request(buildApp())
      .get(`/api/profile/garden/notes/${NOTE_A}/graph`)
      .set('x-clerk-user-id', 'clerk_employer')
      .set('x-org-id', 'org_acme_health');
    expect(res.status).toBe(404);
    expect(prismaMock.gardenNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NOTE_A, userId: EMPLOYER_USER } }),
    );
    expect(prismaMock.gardenNoteLink.findMany).not.toHaveBeenCalled();
  });

  it('backlinks never disclose a from-note that does not resolve in the owner scope', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteLink.findMany.mockResolvedValue([
      { id: LINK_1, userId: ALICE, fromNoteId: NOTE_A2, targetType: 'note', targetId: NOTE_A, createdAt: new Date() },
      // A forged/stale row whose from-note is not resolvable as Alice's:
      { id: 'forged', userId: ALICE, fromNoteId: NOTE_B, targetType: 'note', targetId: NOTE_A, createdAt: new Date() },
    ]);
    prismaMock.gardenNote.findMany.mockImplementation(async (args: { where: { userId: string } }) => {
      expect(args.where.userId).toBe(ALICE); // title hydration is scoped too
      return [{ id: NOTE_A2, title: 'Second note' }];
    });
    const res = await request(buildApp())
      .get(`/api/profile/garden/notes/${NOTE_A}/backlinks`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(200);
    expect(res.body.backlinks).toHaveLength(1);
    expect(res.body.backlinks[0].fromTitle).toBe('Second note');
    expect(JSON.stringify(res.body)).not.toContain(NOTE_B);
    // The link query itself carried the owner scope.
    expect(prismaMock.gardenNoteLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: ALICE, targetType: 'note', targetId: NOTE_A }),
      }),
    );
  });
});

describe('no caller-supplied identity, label, or provenance', () => {
  it('ignores a caller-supplied label and userId; the label is server-derived', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteLink.count.mockResolvedValue(0);
    prismaMock.gardenNoteLink.findFirst.mockResolvedValue(null);
    prismaMock.gardenNoteLink.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: LINK_1,
      ...args.data,
      createdAt: new Date(),
    }));
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({
        targetType: 'source_pointer',
        targetId: 'nppes',
        label: 'Verified by NPPES', // must be ignored
        userId: BOB, // must be ignored
        provenance: 'source_backed', // must be ignored
      });
    expect(res.status).toBe(201);
    const written = prismaMock.gardenNoteLink.create.mock.calls[0][0].data;
    expect(written.userId).toBe(ALICE);
    expect(written.label).toBe('Source: NPPES record (research pointer)');
    expect(written).not.toHaveProperty('provenance');
  });

  it('restore writes only content fields — provenance cannot ride a revision', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteRevision.findFirst.mockResolvedValue({
      id: REV_1,
      noteId: NOTE_A,
      userId: ALICE,
      title: 'Older title',
      body: 'Older body',
      tags: [],
      cause: 'update',
      createdAt: new Date('2026-07-20T00:00:00Z'),
    });
    prismaMock.gardenNoteRevision.create.mockResolvedValue({ id: 'rev-2' });
    prismaMock.gardenNote.update.mockResolvedValue({ ...aliceNote, title: 'Older title', body: 'Older body' });
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/revisions/${REV_1}/restore`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(200);
    const updateData = prismaMock.gardenNote.update.mock.calls[0][0].data;
    expect(Object.keys(updateData).sort()).toEqual(['body', 'tags', 'title']);
    // Current content was captured before overwrite, in the same transaction.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.gardenNoteRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cause: 'pre_restore', body: 'Original body' }) }),
    );
    // Audited.
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'garden_note_revision_restored' }) }),
    );
  });

  it('a grown note refuses restore', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({ ...aliceNote, status: 'grown' });
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/revisions/${REV_1}/restore`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('link-target allowlist', () => {
  it('refuses a targetType outside the closed allowlist', async () => {
    scopeGardenNoteFindFirst();
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'employer', targetId: 'org_acme_health' });
    expect(res.status).toBe(400);
    expect(prismaMock.gardenNoteLink.create).not.toHaveBeenCalled();
  });

  it('refuses an unknown profile-field key', async () => {
    scopeGardenNoteFindFirst();
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'profile_field', targetId: 'ssn' });
    expect(res.status).toBe(404);
    expect(prismaMock.gardenNoteLink.create).not.toHaveBeenCalled();
  });

  it('resolves an opportunity only while it is publicly visible (ACTIVE)', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.opportunity.findFirst.mockImplementation(async (args: { where: { id: string; status: string } }) => {
      expect(args.where.status).toBe('ACTIVE');
      return null; // closed/withdrawn posting
    });
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'opportunity', targetId: OPP_1 });
    expect(res.status).toBe(404);
  });

  it('refuses a self-link and a duplicate link', async () => {
    scopeGardenNoteFindFirst();
    const app = buildApp();
    const self = await request(app)
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'note', targetId: NOTE_A });
    expect(self.status).toBe(400);

    prismaMock.gardenNoteLink.count.mockResolvedValue(1);
    prismaMock.gardenNoteLink.findFirst.mockResolvedValue({ id: LINK_1 });
    const dup = await request(app)
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'source_pointer', targetId: 'nppes' });
    expect(dup.status).toBe(409);
  });
});

describe('revision capture and cascade delete', () => {
  it('a content edit captures the pre-image in the same transaction', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteRevision.create.mockResolvedValue({ id: 'rev-new' });
    prismaMock.gardenNote.update.mockResolvedValue({ ...aliceNote, body: 'Edited body' });
    const res = await request(buildApp())
      .patch(`/api/profile/garden/notes/${NOTE_A}`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ body: 'Edited body' });
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.gardenNoteRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ noteId: NOTE_A, userId: ALICE, body: 'Original body', cause: 'update' }),
      }),
    );
  });

  it('a pure status move captures no revision', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNote.update.mockResolvedValue({ ...aliceNote, status: 'growing' });
    const res = await request(buildApp())
      .patch(`/api/profile/garden/notes/${NOTE_A}`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ status: 'growing' });
    expect(res.status).toBe(200);
    expect(prismaMock.gardenNoteRevision.create).not.toHaveBeenCalled();
  });

  it('deleting a note removes its revisions and links in both directions, owner-scoped', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteRevision.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.gardenNoteLink.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.gardenNote.delete.mockResolvedValue(aliceNote);
    const res = await request(buildApp())
      .delete(`/api/profile/garden/notes/${NOTE_A}`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(200);
    expect(prismaMock.gardenNoteRevision.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { noteId: NOTE_A, userId: ALICE } }),
    );
    expect(prismaMock.gardenNoteLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: ALICE, fromNoteId: NOTE_A } }),
    );
    expect(prismaMock.gardenNoteLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: ALICE, targetType: 'note', targetId: NOTE_A } }),
    );
  });
});

describe('graph traversal', () => {
  it('is owner-scoped, drops invisible targets, and reports its cap', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteLink.findMany
      .mockResolvedValueOnce([
        { id: 'l1', userId: ALICE, fromNoteId: NOTE_A, targetType: 'source_pointer', targetId: 'nppes', label: 'x', createdAt: new Date() },
        { id: 'l2', userId: ALICE, fromNoteId: NOTE_A, targetType: 'note', targetId: NOTE_B, label: 'y', createdAt: new Date() },
      ])
      .mockResolvedValueOnce([]);
    const res = await request(buildApp())
      .get(`/api/profile/garden/notes/${NOTE_A}/graph`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(200);
    expect(res.body.cap).toBe(60);
    const ids = res.body.nodes.map((n: { id: string }) => n.id);
    expect(ids).toContain(`note:${NOTE_A}`);
    expect(ids).toContain('source_pointer:nppes');
    // The link to B's (unresolvable) note is dropped, not rendered.
    expect(ids).not.toContain(`note:${NOTE_B}`);
    for (const call of prismaMock.gardenNoteLink.findMany.mock.calls) {
      expect(call[0].where.userId).toBe(ALICE);
    }
  });
});

describe('audit before 2xx', () => {
  it('link create and remove write their audit rows', async () => {
    scopeGardenNoteFindFirst();
    prismaMock.gardenNoteLink.count.mockResolvedValue(0);
    prismaMock.gardenNoteLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.gardenNoteLink.create.mockResolvedValue({
      id: LINK_1, userId: ALICE, fromNoteId: NOTE_A, targetType: 'source_pointer', targetId: 'nppes',
      label: 'Source: NPPES record (research pointer)', createdAt: new Date(),
    });
    const app = buildApp();
    const created = await request(app)
      .post(`/api/profile/garden/notes/${NOTE_A}/links`)
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ targetType: 'source_pointer', targetId: 'nppes' });
    expect(created.status).toBe(201);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'garden_note_link_created' }) }),
    );

    prismaMock.gardenNoteLink.findFirst.mockResolvedValueOnce({ id: LINK_1, userId: ALICE });
    prismaMock.gardenNoteLink.delete.mockResolvedValue({});
    const removed = await request(app)
      .delete(`/api/profile/garden/links/${LINK_1}`)
      .set('x-clerk-user-id', 'clerk_alice');
    expect(removed.status).toBe(200);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'garden_note_link_removed' }) }),
    );
  });
});
