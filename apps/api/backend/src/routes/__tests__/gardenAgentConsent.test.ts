import express from 'express';
import request from 'supertest';

/**
 * WB-11 consent-gated agent read — D1 pins.
 *
 * Mocked Prisma, mirroring gardenNotes.test.ts. What we pin: excluded is
 * the default and the accessor's query can never return a non-opted note;
 * consent toggling is scoped (foreign note reads 404, never 403) and
 * audited before the 2xx; revocation is a re-query, not a cache purge; the
 * agent-read audit row carries ids and counts, never note text.
 */

const prismaMock = {
  gardenNote: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
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
import { listAgentReadableNotes } from '../../services/garden/gardenAgentConsent';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerGardenRoutes(app);
  return app;
}

const NOTE_ID = '00000000-0000-4000-8000-000000000001';

afterEach(() => jest.clearAllMocks());

describe('WB-11 POST /api/profile/garden/notes/:noteId/agent-consent', () => {
  it("a foreign user's note reads 404, never 403", async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue(null); // scoped miss
    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_ID}/agent-consent`)
      .send({ enabled: true });
    expect(res.status).toBe(404);
    expect(prismaMock.gardenNote.update).not.toHaveBeenCalled();
    // The ownership probe was scoped to the caller.
    expect(prismaMock.gardenNote.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, userId: ALICE },
    });
  });

  it('grant sets the consent timestamp and audits before the 2xx', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({ id: NOTE_ID, userId: ALICE });
    prismaMock.gardenNote.update.mockResolvedValue({ id: NOTE_ID, agentConsentAt: new Date() });
    prismaMock.auditEvent.create.mockResolvedValue({});

    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_ID}/agent-consent`)
      .send({ enabled: true });

    expect(res.status).toBe(200);
    const update = prismaMock.gardenNote.update.mock.calls[0][0];
    expect(update.data.agentConsentAt).toBeInstanceOf(Date);

    const audit = prismaMock.auditEvent.create.mock.calls[0][0].data;
    expect(audit.type).toBe('garden_note_agent_consent_granted');
    expect(audit.metadata).toEqual({ noteId: NOTE_ID }); // ids only, no text
  });

  it('revoke nulls the timestamp and audits the revocation', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({ id: NOTE_ID, userId: ALICE });
    prismaMock.gardenNote.update.mockResolvedValue({ id: NOTE_ID, agentConsentAt: null });
    prismaMock.auditEvent.create.mockResolvedValue({});

    const res = await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_ID}/agent-consent`)
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(prismaMock.gardenNote.update.mock.calls[0][0].data).toEqual({ agentConsentAt: null });
    expect(prismaMock.auditEvent.create.mock.calls[0][0].data.type).toBe(
      'garden_note_agent_consent_revoked',
    );
  });

  it('anything but the literal true is treated as revocation, not grant', async () => {
    prismaMock.gardenNote.findFirst.mockResolvedValue({ id: NOTE_ID, userId: ALICE });
    prismaMock.gardenNote.update.mockResolvedValue({ id: NOTE_ID, agentConsentAt: null });
    prismaMock.auditEvent.create.mockResolvedValue({});

    await request(buildApp())
      .post(`/api/profile/garden/notes/${NOTE_ID}/agent-consent`)
      .send({ enabled: 'yes' }); // truthy string is NOT consent

    expect(prismaMock.gardenNote.update.mock.calls[0][0].data).toEqual({ agentConsentAt: null });
  });
});

describe('WB-11 listAgentReadableNotes — the only agent-facing accessor', () => {
  it('structurally cannot return a non-opted note (consent in the WHERE)', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockResolvedValue({});

    const notes = await listAgentReadableNotes(ALICE);
    expect(notes).toEqual([]);

    const where = prismaMock.gardenNote.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: ALICE, agentConsentAt: { not: null } });
  });

  it('re-queries consent on every call — revocation needs no cache purge', async () => {
    prismaMock.gardenNote.findMany
      .mockResolvedValueOnce([{ id: NOTE_ID, title: 't', body: 'b', tags: [] }])
      .mockResolvedValueOnce([]); // revoked between calls
    prismaMock.auditEvent.create.mockResolvedValue({});

    expect(await listAgentReadableNotes(ALICE)).toHaveLength(1);
    expect(await listAgentReadableNotes(ALICE)).toHaveLength(0);
    expect(prismaMock.gardenNote.findMany).toHaveBeenCalledTimes(2);
  });

  it('audits BEFORE returning, with ids and count — never note text', async () => {
    const secretBody = 'confidential clinical reflection';
    prismaMock.gardenNote.findMany.mockResolvedValue([
      { id: NOTE_ID, title: 'secret title', body: secretBody, tags: [] },
    ]);
    prismaMock.auditEvent.create.mockResolvedValue({});

    await listAgentReadableNotes(ALICE);

    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1);
    const audit = prismaMock.auditEvent.create.mock.calls[0][0].data;
    expect(audit.type).toBe('garden_agent_notes_read');
    expect(audit.metadata).toEqual({ noteIds: [NOTE_ID], count: 1 });
    expect(JSON.stringify(audit)).not.toContain(secretBody);
    expect(JSON.stringify(audit)).not.toContain('secret title');
  });

  it('a failed audit write fails the read — no unaudited consumption', async () => {
    prismaMock.gardenNote.findMany.mockResolvedValue([{ id: NOTE_ID }]);
    prismaMock.auditEvent.create.mockRejectedValue(new Error('audit store down'));

    await expect(listAgentReadableNotes(ALICE)).rejects.toThrow('audit store down');
  });
});
