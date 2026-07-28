import express from 'express';
import request from 'supertest';

/**
 * Career Garden routes — privacy and truth-contract pins.
 *
 * Everything here runs against a mocked Prisma client: what we pin is the
 * route/service contract, not the database — identity is required, every
 * query is scoped to the resolved internal user, misses read as 404, the
 * provenance literal cannot be influenced by the caller, and every mutation
 * writes an audit row before the 2xx.
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
  auditEvent: { create: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

const USERS: Record<string, string> = {
  clerk_alice: '11111111-1111-4111-8111-111111111111',
  clerk_bob: '22222222-2222-4222-8222-222222222222',
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

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
});

describe('garden notes routes', () => {
  it('rejects requests without an identity header', async () => {
    const res = await request(buildApp()).get('/api/profile/garden/notes');
    expect(res.status).toBe(401);
    expect(prismaMock.gardenNote.findMany).not.toHaveBeenCalled();
  });

  it('lists only the caller’s notes', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    const res = await request(buildApp())
      .get('/api/profile/garden/notes')
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(200);
    expect(prismaMock.gardenNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: ALICE } }),
    );
  });

  it('creates a note, derives a title, caps the body, and audits before the 2xx', async () => {
    prismaMock.gardenNote.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'note-1',
      ...data,
    }));
    const longBody = 'x'.repeat(5000);
    const res = await request(buildApp())
      .post('/api/profile/garden/notes')
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ body: longBody, tags: ['quality', '', 42, 'teaching'] });

    expect(res.status).toBe(201);
    const created = prismaMock.gardenNote.create.mock.calls[0][0].data;
    expect(created.userId).toBe(ALICE);
    expect((created.body as string).length).toBe(4000);
    expect(created.title).toContain('…');
    expect(created.tags).toEqual(['quality', 'teaching']);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'garden_note_created' }) }),
    );
  });

  it('rejects an empty capture', async () => {
    const res = await request(buildApp())
      .post('/api/profile/garden/notes')
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ body: '   ' });
    expect(res.status).toBe(400);
    expect(prismaMock.gardenNote.create).not.toHaveBeenCalled();
  });

  it('reads another user’s note as not-found, never forbidden', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue(null);
    const res = await request(buildApp())
      .patch('/api/profile/garden/notes/someone-elses-note')
      .set('x-clerk-user-id', 'clerk_bob')
      .send({ title: 'hijack' });
    expect(res.status).toBe(404);
    expect(prismaMock.gardenNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'someone-elses-note', userId: USERS.clerk_bob } }),
    );
    expect(prismaMock.gardenNote.update).not.toHaveBeenCalled();
  });

  it('refuses to fake growth through a status edit', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({ id: 'note-1', userId: ALICE, status: 'unfiled' });
    const res = await request(buildApp())
      .patch('/api/profile/garden/notes/note-1')
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ status: 'grown' });
    expect(res.status).toBe(400);
  });

  it('promotes with the provenance literal, server-derived origin, and an audit row', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({
      id: 'note-1',
      userId: ALICE,
      title: 'Journal club reflection',
      createdAt: new Date('2026-07-21T00:00:00Z'),
      status: 'growing',
    });
    prismaMock.gardenCvEntry.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'entry-1',
      ...data,
    }));
    prismaMock.gardenNote.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'note-1',
      ...data,
    }));

    const res = await request(buildApp())
      .post('/api/profile/garden/notes/note-1/promote')
      .set('x-clerk-user-id', 'clerk_alice')
      .send({
        section: 'service',
        headline: 'Proposed a 48-hour follow-up call trial',
        detail: 'Drafted the script and proposal for the unit quality committee.',
        provenance: 'source_backed', // hostile: must be ignored
      });

    expect(res.status).toBe(201);
    const entryData = prismaMock.gardenCvEntry.create.mock.calls[0][0].data;
    expect(entryData.provenance).toBe('self_attested');
    expect(entryData.origin).toContain('Grown from your note “Journal club reflection”');
    expect(entryData.origin).toContain('2026-07-21');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'garden_note_promoted' }) }),
    );
  });

  it('rejects promotion into an unknown section', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({
      id: 'note-1',
      userId: ALICE,
      title: 't',
      createdAt: new Date(),
      status: 'unfiled',
    });
    const res = await request(buildApp())
      .post('/api/profile/garden/notes/note-1/promote')
      .set('x-clerk-user-id', 'clerk_alice')
      .send({ section: 'awards', headline: 'h', detail: 'd' });
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('removing a grown line reopens its seed', async () => {
    prismaMock.gardenCvEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      userId: ALICE,
      fromNoteId: 'note-1',
    });
    const res = await request(buildApp())
      .delete('/api/profile/garden/cv/entry-1')
      .set('x-clerk-user-id', 'clerk_alice');
    expect(res.status).toBe(200);
    expect(prismaMock.gardenNote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'note-1', userId: ALICE },
        data: { status: 'growing', promotedAt: null },
      }),
    );
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'garden_cv_entry_removed' }) }),
    );
  });
});
