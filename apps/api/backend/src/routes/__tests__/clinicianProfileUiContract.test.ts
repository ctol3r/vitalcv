/**
 * What the B1 SURFACE needs from the clinician-profile API — Wave 1076 B1.
 *
 * Two behaviours the backend slice did not have, both added because building
 * the UI showed the contract could not be honoured without them. They are
 * tested here rather than folded into the route suite next door so it stays
 * obvious which requirement each one serves.
 *
 *   1. A field-level validation failure must answer 400 and NAME its field.
 *      It previously threw a bare `FieldValidationError`, which the error
 *      handler had no status to read — so a clinician mistyping their email
 *      address got a 500, and Sentry got an outage report. A typo is neither an
 *      outage nor a server fault, and the surface cannot attach a message to
 *      the offending input without knowing which one it was.
 *
 *   2. `?include=all` must return drafts still in progress. Recovery cannot
 *      depend on the browser: a clinician who signs in a week later on another
 *      machine has no URL and no local storage, and the durable draft is the
 *      only thing that remembers what they already filled in. Without it the
 *      product asks them to type it again — the one thing a reusable profile
 *      exists to prevent.
 */

import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $use: jest.fn(),
    $transaction: jest.fn(),
    npiOwnership: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    auditEvent: { create: jest.fn() },
    clinicianProfileDraft: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../services/workspace/workspaceService', () => ({ bootstrapFromNpi: jest.fn() }));

import prismaClient from '../../graphql/prisma_client';
import { registerClinicianProfileRoutes } from '../clinicianProfile';
import { HttpError } from '../../utils/httpError';

const prisma = prismaClient as unknown as {
  $transaction: jest.Mock;
  npiOwnership: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  auditEvent: { create: jest.Mock };
  clinicianProfileDraft: {
    findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock;
    update: jest.Mock; updateMany: jest.Mock;
  };
};

const MINE = 'user_clinician';
const NPI = '1003000126';
const T = new Date('2026-08-05T00:00:00Z');

const row = (over: Record<string, unknown> = {}) => ({
  id: 'draft-1', userId: MINE, npi: NPI,
  resolvedSnapshot: { fullName: 'JEAN ABBOTT', specialty: 'Emergency Medicine', practiceState: 'CO' },
  sourceObservations: { fullName: { source: 'NPPES', observedAt: T.toISOString() } },
  resolvedAt: T,
  clinicianFields: {},
  reviewedAt: null, sharingConfirmedAt: null, savedAt: null, activatedAt: null,
  ...over,
});

/**
 * Like the route suite's helper, but it forwards `query` — which is the whole
 * point of one of the tests below — and surfaces a thrown HttpError's
 * `details`, the way the real error handler does.
 */
function invoke(
  app: express.Express,
  method: 'get' | 'post' | 'patch',
  routePath: string,
  opts: {
    params?: Record<string, string>;
    query?: Record<string, unknown>;
    body?: unknown;
    verifiedUserId?: string;
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const layers = (app as unknown as {
    _router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Function }> } }> };
  })._router.stack;
  const layer = layers.find((l) => l.route?.path === routePath && l.route?.methods[method]);
  if (!layer?.route) throw new Error(`route not registered: ${method} ${routePath}`);

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = {
      method: method.toUpperCase(),
      params: opts.params ?? {},
      query: opts.query ?? {},
      body: opts.body ?? {},
      headers: {},
      route: { path: routePath },
      ...(opts.verifiedUserId ? { verifiedAuth: { verifiedUserId: opts.verifiedUserId } } : {}),
    } as unknown as express.Request;
    const res = {
      locals: {},
      status(c: number) { statusCode = c; return this; },
      json(p: unknown) { resolve({ status: statusCode, body: p as Record<string, unknown> }); return this; },
      setHeader() { return this; },
    } as unknown as express.Response;

    const stack = layer.route!.stack;
    const step = (i: number): void => {
      if (i >= stack.length) return;
      const next = (err?: unknown) => {
        if (err) {
          // Mirrors errorHandler: HttpError contributes status, code and details.
          const e = err as HttpError;
          resolve({
            status: e.status ?? 500,
            body: { error: { code: e.code, message: e.message, ...(e.details ?? {}) } },
          });
          return;
        }
        step(i + 1);
      };
      try { Promise.resolve(stack[i].handle(req, res, next)).catch(next); }
      catch (e) { reject(e); }
    };
    step(0);
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerClinicianProfileRoutes(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(prisma));
  prisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
  prisma.npiOwnership.findFirst.mockResolvedValue(null);
  prisma.user.findUnique.mockResolvedValue({ id: 'internal-uuid' });
  prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row());
  prisma.clinicianProfileDraft.update.mockResolvedValue(row());
  prisma.clinicianProfileDraft.updateMany.mockResolvedValue({ count: 0 });
});

describe('a mistyped value is a validation refusal, not a server fault', () => {
  it('answers 400 and names the field for an invalid email', async () => {
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE,
      params: { npi: NPI },
      body: { corrections: { contactEmail: 'not-an-email' } },
    });

    expect(r.status).toBe(400);
    const error = r.body.error as { code: string; message: string; field?: string };
    expect(error.code).toBe('FIELD_INVALID');
    expect(error.field).toBe('contactEmail');
    // The surface renders this next to the input, so it has to be readable.
    expect(error.message).toContain('valid email');
  });

  it('answers 400 and names the field for a state that does not exist', async () => {
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE,
      params: { npi: NPI },
      body: { corrections: { practiceState: 'ZZ' } },
    });

    expect(r.status).toBe(400);
    expect((r.body.error as { field?: string }).field).toBe('practiceState');
  });

  it('refuses the whole request rather than persisting the valid half', async () => {
    // Silently keeping `specialty` while dropping the bad email would leave the
    // clinician believing both took.
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE,
      params: { npi: NPI },
      body: { corrections: { specialty: 'Urgent Care', contactEmail: 'nope' } },
    });

    expect(r.status).toBe(400);
    expect(prisma.clinicianProfileDraft.update).not.toHaveBeenCalled();
  });

  it('still accepts a valid correction', async () => {
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE,
      params: { npi: NPI },
      body: { corrections: { contactEmail: 'Jean@Example.com ' } },
    });

    expect(r.status).toBe(200);
    const data = prisma.clinicianProfileDraft.update.mock.calls[0][0].data;
    // Normalized on the way in — the surface shows what was stored, not what
    // was typed, which is why local edit state is dropped after a commit.
    expect(data.clinicianFields).toEqual({ contactEmail: 'jean@example.com' });
  });
});

describe('recovery does not depend on the browser', () => {
  it('lists only saved profiles by default', async () => {
    prisma.clinicianProfileDraft.findMany.mockResolvedValue([row({ savedAt: T })]);

    await invoke(buildApp(), 'get', '/api/clinician-profile', { verifiedUserId: MINE });

    expect(prisma.clinicianProfileDraft.findMany.mock.calls[0][0].where).toEqual({
      userId: MINE,
      savedAt: { not: null },
    });
  });

  it('include=all returns drafts still in progress', async () => {
    prisma.clinicianProfileDraft.findMany.mockResolvedValue([row()]);

    const r = await invoke(buildApp(), 'get', '/api/clinician-profile', {
      verifiedUserId: MINE,
      query: { include: 'all' },
    });

    expect(prisma.clinicianProfileDraft.findMany.mock.calls[0][0].where).toEqual({ userId: MINE });
    const profiles = (r.body as { profiles: Array<{ npi: string; savedAt: Date | null }> }).profiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0].npi).toBe(NPI);
    // An unfinished draft must never come back looking like a saved profile.
    expect(profiles[0].savedAt).toBeNull();
  });

  it('scopes the recovery list to the caller', async () => {
    prisma.clinicianProfileDraft.findMany.mockResolvedValue([]);

    await invoke(buildApp(), 'get', '/api/clinician-profile', {
      verifiedUserId: MINE,
      query: { include: 'all' },
    });

    expect(prisma.clinicianProfileDraft.findMany.mock.calls[0][0].where.userId).toBe(MINE);
  });

  it('a draft recovered this way still carries its unmet requirements', async () => {
    prisma.clinicianProfileDraft.findMany.mockResolvedValue([row()]);

    const r = await invoke(buildApp(), 'get', '/api/clinician-profile', {
      verifiedUserId: MINE,
      query: { include: 'all' },
    });

    const profiles = (r.body as { profiles: Array<{ missingRequired: string[]; state: string }> }).profiles;
    // No contactEmail and no credential in the snapshot — the surface has to be
    // told, or it would offer a save the server would refuse.
    expect(profiles[0].missingRequired).toEqual(expect.arrayContaining(['credential', 'contactEmail']));
    expect(profiles[0].state).toBe('resolved');
  });
});
