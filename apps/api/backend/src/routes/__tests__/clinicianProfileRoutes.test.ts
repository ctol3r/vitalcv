/**
 * Clinician activation at the ROUTE — Wave 1076 B1.
 *
 * The state model is unit-tested next door. These prove the routes CALL it, and
 * cover the things only an integrated path can show: that a save is idempotent
 * under retry, that one clinician cannot reach another's draft, and that
 * activation does not wait on ownership verification.
 */

import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $use: jest.fn(),
    npiOwnership: { findFirst: jest.fn() },
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
jest.mock('../../services/workspace/workspaceService', () => ({
  bootstrapFromNpi: jest.fn(),
}));

import prismaClient from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { registerClinicianProfileRoutes } from '../clinicianProfile';
import { bootstrapFromNpi } from '../../services/workspace/workspaceService';

const prisma = prismaClient as unknown as {
  npiOwnership: { findFirst: jest.Mock };
  auditEvent: { create: jest.Mock };
  clinicianProfileDraft: {
    findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock;
    update: jest.Mock; updateMany: jest.Mock;
  };
};

const MINE = 'user_clinician';
const OTHER = 'user_other';
const NPI = '1003000126';
const T = new Date('2026-08-05T00:00:00Z');

type Row = {
  id: string; userId: string; npi: string;
  resolvedSnapshot: Record<string, unknown>;
  sourceObservations: Record<string, unknown>;
  resolvedAt: Date | null;
  clinicianFields: Record<string, unknown>;
  reviewedAt: Date | null; sharingConfirmedAt: Date | null;
  savedAt: Date | null; activatedAt: Date | null;
};

const row = (over: Partial<Row> = {}): Row => ({
  id: 'draft-1', userId: MINE, npi: NPI,
  resolvedSnapshot: { fullName: 'JEAN ABBOTT', specialty: 'Emergency Medicine', practiceState: 'CO', credential: 'NP' },
  sourceObservations: { fullName: { source: 'NPPES', observedAt: T.toISOString() } },
  resolvedAt: T,
  clinicianFields: {},
  reviewedAt: null, sharingConfirmedAt: null, savedAt: null, activatedAt: null,
  ...over,
});

function invoke(
  app: express.Express,
  method: 'get' | 'post' | 'patch',
  routePath: string,
  opts: { params?: Record<string, string>; body?: unknown; headers?: Record<string, string>; verifiedUserId?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const layers = (app as unknown as { _router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Function }> } }> } })._router.stack;
  const layer = layers.find((l) => l.route?.path === routePath && l.route?.methods[method]);
  if (!layer?.route) throw new Error(`route not registered: ${method} ${routePath}`);
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = {
      method: method.toUpperCase(), params: opts.params ?? {}, query: {},
      body: opts.body ?? {}, headers: opts.headers ?? {}, route: { path: routePath },
      ...(opts.verifiedUserId ? { verifiedAuth: { verifiedUserId: opts.verifiedUserId } } : {}),
    } as unknown as express.Request;
    const res = {
      locals: {},
      status(c: number) { statusCode = c; return this; },
      json(p: unknown) { resolve({ status: statusCode, body: p }); return this; },
      setHeader() { return this; },
    } as unknown as express.Response;
    const stack = layer.route!.stack;
    const step = (i: number): void => {
      if (i >= stack.length) return;
      const next = (err?: unknown) => {
        if (err) {
          const e = err as { status?: number; statusCode?: number; message?: string };
          resolve({ status: e.status ?? e.statusCode ?? 500, body: { error: e.message } });
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

/** Every required field present — the only shape that may be saved. */
const completeFields = {
  fullName: 'JEAN ABBOTT', credential: 'NP',
  specialty: 'Emergency Medicine', practiceState: 'CO',
  contactEmail: 'jean@example.com',
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
  (bootstrapFromNpi as jest.Mock).mockResolvedValue({
    npi: NPI, npiType: 'TYPE_1', inferredPersona: 'CLINICIAN',
    identitySource: 'NPPES_API',
    firstName: 'JEAN', lastName: 'ABBOTT',
    specialty: 'Emergency Medicine', state: 'CO',
    alreadyRegistered: false,
  });
  prisma.npiOwnership.findFirst.mockResolvedValue(null); // no ownership by default
  prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row());
  prisma.clinicianProfileDraft.upsert.mockResolvedValue(row());
  prisma.clinicianProfileDraft.update.mockImplementation(async ({ data }: { data: Partial<Row> }) => row(data));
  prisma.clinicianProfileDraft.updateMany.mockResolvedValue({ count: 1 });
  prisma.clinicianProfileDraft.findMany.mockResolvedValue([]);
});

describe('every route requires a verified session', () => {
  it.each([
    ['claim', 'post' as const, '/api/clinician-profile/claim'],
    ['save', 'post' as const, '/api/clinician-profile/:npi/save'],
    ['read', 'get' as const, '/api/clinician-profile/:npi'],
    ['correct', 'patch' as const, '/api/clinician-profile/:npi'],
    ['review', 'post' as const, '/api/clinician-profile/:npi/review'],
    ['sharing', 'post' as const, '/api/clinician-profile/:npi/sharing'],
    ['list', 'get' as const, '/api/clinician-profile'],
  ])('%s refuses anonymously and ignores a forged header', async (_l, method, path) => {
    const anon = await invoke(buildApp(), method, path, { params: { npi: NPI }, body: { npi: NPI } });
    expect(anon.status).toBe(401);
    const forged = await invoke(buildApp(), method, path, {
      params: { npi: NPI }, body: { npi: NPI }, headers: { 'x-clerk-user-id': MINE },
    });
    expect(forged.status).toBe(401);
  });
});

describe('21 · activation does not wait on ownership verification', () => {
  it('a verified session with NO ownership binding can claim, review, confirm and save', async () => {
    const app = buildApp();
    prisma.npiOwnership.findFirst.mockResolvedValue(null);

    const claimed = await invoke(app, 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: NPI },
    });
    expect(claimed.status).toBe(200);
    expect((claimed.body as { state: string }).state).toBe('resolved');

    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T }),
    );
    prisma.clinicianProfileDraft.update.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T }),
    );
    prisma.clinicianProfileDraft.findUnique.mockResolvedValueOnce(
      row({ reviewedAt: T, sharingConfirmedAt: T }),
    );

    const saved = await invoke(app, 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: { contactEmail: 'a@b.co' } },
    });
    expect(saved.status).toBe(200);
    // Reached a saved profile with no administrator involved.
    expect(prisma.clinicianProfileDraft.updateMany).toHaveBeenCalled();
  });

  /*
   * Found by injection: dropping the `verifiedAt` requirement from
   * isOwnershipVerified reddened NOTHING. A pending CLAIMED row would have
   * been read as ownership — the exact defect #1075 closed at the other
   * boundary, reopened here.
   */
  it.each([
    ['a pending CLAIMED row', { verifiedAt: null, verificationMethod: 'CLAIMED', revokedAt: null }],
    ['a revoked row', { verifiedAt: T, verificationMethod: 'ADMIN_VERIFIED', revokedAt: T }],
    ['a timestamp with an unrecognised method', { verifiedAt: T, verificationMethod: 'SELF_ATTESTED', revokedAt: null }],
    ['a method with no timestamp', { verifiedAt: null, verificationMethod: 'ADMIN_VERIFIED', revokedAt: null }],
  ])('%s is NOT ownership, so private holdings stay locked', async (_label, binding) => {
    prisma.npiOwnership.findFirst.mockResolvedValue(binding);
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T, activatedAt: T }),
    );
    const r = await invoke(buildApp(), 'get', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    const body = r.body as { state: string; permissions: { privateCredentialHoldings: boolean } };
    expect(body.state).toBe('profile_saved');
    expect(body.permissions.privateCredentialHoldings).toBe(false);
  });

  it('a genuinely verified binding DOES unlock them', async () => {
    prisma.npiOwnership.findFirst.mockResolvedValue({
      verifiedAt: T, verificationMethod: 'ADMIN_VERIFIED', revokedAt: null,
    });
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T, activatedAt: T }),
    );
    const r = await invoke(buildApp(), 'get', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    const body = r.body as { state: string; permissions: { privateCredentialHoldings: boolean } };
    expect(body.state).toBe('ownership_verified');
    expect(body.permissions.privateCredentialHoldings).toBe(true);
  });

  it('22 · a saved profile still does not unlock private credential holdings', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T, activatedAt: T }),
    );
    const r = await invoke(buildApp(), 'get', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    const body = r.body as { state: string; permissions: { privateCredentialHoldings: boolean } };
    expect(body.state).toBe('profile_saved');
    expect(body.permissions.privateCredentialHoldings).toBe(false);
  });
});

describe('17–18 · activation is emitted once, and is race-safe', () => {
  it('stamps activation only when all three conditions are met', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ reviewedAt: T }));
    prisma.clinicianProfileDraft.update.mockResolvedValue(row({ reviewedAt: T, savedAt: T }));
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: {} },
    });
    // sharing control never confirmed → no activation stamp
    expect(prisma.clinicianProfileDraft.updateMany).not.toHaveBeenCalled();
    expect((log as jest.Mock).mock.calls.some((c) => c[1] === 'clinician_profile_activated')).toBe(false);
  });

  it('18 · a repeat save does not re-emit', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T, activatedAt: T }),
    );
    prisma.clinicianProfileDraft.update.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: new Date(), activatedAt: T }),
    );
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: { specialty: 'Urgent Care' } },
    });
    expect(prisma.clinicianProfileDraft.updateMany).not.toHaveBeenCalled();
    expect((log as jest.Mock).mock.calls.some((c) => c[1] === 'clinician_profile_activated')).toBe(false);
  });

  it('a concurrent second stamp loses — the conditional write updates zero rows', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ reviewedAt: T, sharingConfirmedAt: T }));
    prisma.clinicianProfileDraft.update.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T }),
    );
    prisma.clinicianProfileDraft.updateMany.mockResolvedValue({ count: 0 }); // another request won
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: {} },
    });
    // The write was attempted, and the event was NOT logged by the loser.
    expect(prisma.clinicianProfileDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ activatedAt: null }) }),
    );
    expect((log as jest.Mock).mock.calls.some((c) => c[1] === 'clinician_profile_activated')).toBe(false);
  });

  it('24 · the activation payload carries no NPI, name, credential or free text', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ reviewedAt: T, sharingConfirmedAt: T }));
    prisma.clinicianProfileDraft.update.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T, clinicianFields: { fullName: 'JEAN ABBOTT' } }),
    );
    prisma.clinicianProfileDraft.updateMany.mockResolvedValue({ count: 1 });
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: { fullName: 'JEAN ABBOTT' } },
    });
    const entry = (log as jest.Mock).mock.calls.find((c) => c[1] === 'clinician_profile_activated');
    expect(entry).toBeDefined();
    const payload = JSON.stringify(entry![2]);
    for (const leak of [NPI, 'JEAN', 'ABBOTT', 'Emergency Medicine', 'NP']) {
      expect(payload.includes(leak)).toBe(false);
    }
  });
});

describe('data isolation · one clinician cannot reach another’s draft', () => {
  it('scopes every read to the calling user', async () => {
    await invoke(buildApp(), 'get', '/api/clinician-profile/:npi', {
      verifiedUserId: OTHER, params: { npi: NPI },
    });
    expect(prisma.clinicianProfileDraft.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_npi: { userId: OTHER, npi: NPI } } }),
    );
  });

  it('a draft that is not the caller’s reads as absent, not forbidden', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(null);
    const r = await invoke(buildApp(), 'get', '/api/clinician-profile/:npi', {
      verifiedUserId: OTHER, params: { npi: NPI },
    });
    expect(r.status).toBe(404);
  });

  it('a correction cannot be written to someone else’s draft', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(null);
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: OTHER, params: { npi: NPI }, body: { corrections: { specialty: 'x' } },
    });
    expect(r.status).toBe(404);
    expect(prisma.clinicianProfileDraft.update).not.toHaveBeenCalled();
  });

  it('the reusable-profile list is scoped to the caller', async () => {
    await invoke(buildApp(), 'get', '/api/clinician-profile', { verifiedUserId: MINE });
    expect(prisma.clinicianProfileDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: MINE }) }),
    );
  });
});

describe('19 · truth classes survive the save', () => {
  it('an edited field becomes clinician_provided; an untouched one stays public_source', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ clinicianFields: { specialty: 'Urgent Care' }, reviewedAt: T, sharingConfirmedAt: T, savedAt: T, activatedAt: T }),
    );
    const r = await invoke(buildApp(), 'get', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    const fields = (r.body as { fields: Array<{ key: string; truthClass: string; value: unknown }> }).fields;
    const specialty = fields.find((f) => f.key === 'specialty');
    const name = fields.find((f) => f.key === 'fullName');
    expect(specialty).toMatchObject({ truthClass: 'clinician_provided', value: 'Urgent Care' });
    expect(name).toMatchObject({ truthClass: 'public_source', value: 'JEAN ABBOTT' });
  });

  it('corrections never overwrite the public-source snapshot', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row());
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: { specialty: 'Urgent Care' } },
    });
    const data = prisma.clinicianProfileDraft.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('resolvedSnapshot');
    expect(data.clinicianFields).toMatchObject({ specialty: 'Urgent Care' });
  });

  it('a client cannot persist a field outside the declared registry', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row());
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
      body: { corrections: { specialty: 'Urgent Care', isVerified: true, adminNote: 'x' } },
    });
    const saved = prisma.clinicianProfileDraft.update.mock.calls[0][0].data.clinicianFields;
    expect(saved).toHaveProperty('specialty');
    expect(saved).not.toHaveProperty('isVerified');
    expect(saved).not.toHaveProperty('adminNote');
  });
});

describe('the claim step is safe to repeat', () => {
  it('recovers the existing draft rather than creating a second', async () => {
    await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: NPI },
    });
    expect(prisma.clinicianProfileDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_npi: { userId: MINE, npi: NPI } } }),
    );
  });

  it('a re-claim refreshes the snapshot but never the activation stamps', async () => {
    await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: NPI },
    });
    const update = prisma.clinicianProfileDraft.upsert.mock.calls[0][0].update;
    expect(update).toHaveProperty('resolvedSnapshot');
    for (const stamp of ['reviewedAt', 'sharingConfirmedAt', 'savedAt', 'activatedAt', 'clinicianFields']) {
      expect({ stamp, reset: Object.prototype.hasOwnProperty.call(update, stamp) }).toEqual({ stamp, reset: false });
    }
  });

  it('rejects a malformed NPI before touching the database', async () => {
    const r = await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: '123' },
    });
    expect(r.status).toBe(400);
    expect(prisma.clinicianProfileDraft.upsert).not.toHaveBeenCalled();
  });
});

// ── B1 hardening ────────────────────────────────────────────────────────────

describe('1–2 · the browser is not a public source', () => {
  it('1. client-supplied `resolved` cannot become the public snapshot', async () => {
    await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE,
      body: {
        npi: NPI,
        // A tampered preview. None of this may survive.
        resolved: { fullName: 'ATTACKER NAME', specialty: 'Neurosurgery', practiceState: 'NY' },
      },
    });
    const created = prisma.clinicianProfileDraft.upsert.mock.calls[0][0].create;
    expect(created.resolvedSnapshot).toMatchObject({
      fullName: 'JEAN ABBOTT', specialty: 'Emergency Medicine', practiceState: 'CO',
    });
    expect(JSON.stringify(created.resolvedSnapshot)).not.toContain('ATTACKER');
    expect(JSON.stringify(created.resolvedSnapshot)).not.toContain('Neurosurgery');
  });

  it('2. client-supplied provenance is ignored — source and time come from the server', async () => {
    await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE,
      body: {
        npi: NPI,
        observations: { fullName: { source: 'STATE_BOARD', observedAt: '1999-01-01T00:00:00Z' } },
      },
    });
    const created = prisma.clinicianProfileDraft.upsert.mock.calls[0][0].create;
    const obs = JSON.stringify(created.sourceObservations);
    expect(obs).toContain('NPPES');
    expect(obs).not.toContain('STATE_BOARD');
    expect(obs).not.toContain('1999');
  });

  it('records no public snapshot when the registry could not answer', async () => {
    (bootstrapFromNpi as jest.Mock).mockResolvedValue({
      npi: NPI, npiType: 'TYPE_1', inferredPersona: 'UNKNOWN',
      identitySource: 'UNAVAILABLE', alreadyRegistered: false,
    });
    await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: NPI, resolved: { fullName: 'MADE UP' } },
    });
    const created = prisma.clinicianProfileDraft.upsert.mock.calls[0][0].create;
    expect(created.resolvedSnapshot).toEqual({});
    expect(created.resolvedAt).toBeNull();
  });

  it('refuses a Type-2 organization NPI', async () => {
    (bootstrapFromNpi as jest.Mock).mockResolvedValue({
      npi: NPI, npiType: 'TYPE_2', inferredPersona: 'VERIFIER',
      identitySource: 'NPPES_API', alreadyRegistered: false,
    });
    const r = await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: NPI },
    });
    expect(r.status).toBe(400);
    expect(prisma.clinicianProfileDraft.upsert).not.toHaveBeenCalled();
  });
});

describe('3–5 · a correction is not a reusable profile', () => {
  it('3. an ordinary correction does not stamp savedAt', async () => {
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: { specialty: 'Urgent Care' } },
    });
    const data = prisma.clinicianProfileDraft.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('savedAt');
  });

  it('4. review + sharing on an INCOMPLETE draft does not activate', async () => {
    // No contactEmail → required field missing.
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ reviewedAt: T, sharingConfirmedAt: T, clinicianFields: {} }),
    );
    const r = await invoke(buildApp(), 'post', '/api/clinician-profile/:npi/save', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    expect(r.status).toBe(422);
    expect(prisma.clinicianProfileDraft.update).not.toHaveBeenCalled();
    expect(prisma.clinicianProfileDraft.updateMany).not.toHaveBeenCalled();
  });

  it('5. an empty correction request creates no reusable profile', async () => {
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: {} },
    });
    expect(prisma.clinicianProfileDraft.update.mock.calls[0][0].data).not.toHaveProperty('savedAt');
    expect(prisma.clinicianProfileDraft.updateMany).not.toHaveBeenCalled();
  });

  it('9. a valid complete profile stamps savedAt', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ clinicianFields: completeFields }));
    prisma.clinicianProfileDraft.update.mockResolvedValue(row({ clinicianFields: completeFields, savedAt: T }));
    const r = await invoke(buildApp(), 'post', '/api/clinician-profile/:npi/save', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    expect(r.status).toBe(200);
    expect(prisma.clinicianProfileDraft.update.mock.calls[0][0].data).toHaveProperty('savedAt');
  });

  it('10. save completes activation only when review and sharing are also true', async () => {
    // saved but never reviewed → no activation
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ clinicianFields: completeFields }));
    prisma.clinicianProfileDraft.update.mockResolvedValue(row({ clinicianFields: completeFields, savedAt: T }));
    await invoke(buildApp(), 'post', '/api/clinician-profile/:npi/save', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    expect(prisma.clinicianProfileDraft.updateMany).not.toHaveBeenCalled();

    jest.clearAllMocks();
    prisma.auditEvent.create.mockResolvedValue({ id: 'a' });
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ clinicianFields: completeFields, reviewedAt: T, sharingConfirmedAt: T }),
    );
    prisma.clinicianProfileDraft.update.mockResolvedValue(
      row({ clinicianFields: completeFields, reviewedAt: T, sharingConfirmedAt: T, savedAt: T }),
    );
    prisma.clinicianProfileDraft.updateMany.mockResolvedValue({ count: 1 });
    await invoke(buildApp(), 'post', '/api/clinician-profile/:npi/save', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    expect(prisma.clinicianProfileDraft.updateMany).toHaveBeenCalled();
  });
});

describe('6–8 · declared fields are validated, not just named', () => {
  it.each([
    ['6. an object where text belongs', { fullName: { evil: true } }],
    ['6. an array where text belongs', { specialty: ['a', 'b'] }],
    ['6. an empty string in a required field', { credential: '   ' }],
    ['7. an invalid email', { contactEmail: 'not-an-email' }],
    ['7. an email with no domain dot', { contactEmail: 'jean@example' }],
    ['8. an invalid state code', { practiceState: 'ZZ' }],
    ['8. an invalid state in a list', { licensedStates: ['CO', 'NOPE'] }],
    ['an unknown work arrangement', { workArrangement: 'whenever' }],
  ])('rejects %s', async (_label, corrections) => {
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections },
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(prisma.clinicianProfileDraft.update).not.toHaveBeenCalled();
  });

  it('normalizes and de-duplicates a state list', async () => {
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
      body: { corrections: { licensedStates: ['co', 'CO', ' co ', 'ny'] } },
    });
    const saved = prisma.clinicianProfileDraft.update.mock.calls[0][0].data.clinicianFields;
    expect(saved.licensedStates).toEqual(['CO', 'NY']);
  });

  it('normalizes an email to lower case', async () => {
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
      body: { corrections: { contactEmail: '  JEAN@Example.COM ' } },
    });
    const saved = prisma.clinicianProfileDraft.update.mock.calls[0][0].data.clinicianFields;
    expect(saved.contactEmail).toBe('jean@example.com');
  });
});

describe('11–12 · every mutation leaves a durable receipt', () => {
  it.each([
    ['claim', 'post' as const, '/api/clinician-profile/claim', 'CLINICIAN_PROFILE_CLAIMED'],
    ['correct', 'patch' as const, '/api/clinician-profile/:npi', 'CLINICIAN_PROFILE_CORRECTED'],
    ['review', 'post' as const, '/api/clinician-profile/:npi/review', 'CLINICIAN_PROFILE_REVIEW_CONFIRMED'],
    ['sharing', 'post' as const, '/api/clinician-profile/:npi/sharing', 'CLINICIAN_PROFILE_SHARING_CONFIRMED'],
  ])('11. %s writes an AuditEvent', async (_l, method, path, type) => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ clinicianFields: completeFields }));
    const r = await invoke(buildApp(), method, path, {
      verifiedUserId: MINE, params: { npi: NPI },
      body: { npi: NPI, corrections: { specialty: 'Urgent Care' } },
    });
    expect(r.status).toBeLessThan(300);
    const types = prisma.auditEvent.create.mock.calls.map((c) => c[0].data.type);
    expect(types).toContain(type);
  });

  it('11. save and activation each write their own receipt', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(
      row({ clinicianFields: completeFields, reviewedAt: T, sharingConfirmedAt: T }),
    );
    prisma.clinicianProfileDraft.update.mockResolvedValue(
      row({ clinicianFields: completeFields, reviewedAt: T, sharingConfirmedAt: T, savedAt: T }),
    );
    await invoke(buildApp(), 'post', '/api/clinician-profile/:npi/save', {
      verifiedUserId: MINE, params: { npi: NPI },
    });
    const types = prisma.auditEvent.create.mock.calls.map((c) => c[0].data.type);
    expect(types).toContain('CLINICIAN_PROFILE_SAVED');
    expect(types).toContain('CLINICIAN_PROFILE_ACTIVATED');
  });

  it('12. an audit failure prevents a 2xx', async () => {
    prisma.auditEvent.create.mockRejectedValue(new Error('audit store down'));
    const r = await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI }, body: { corrections: { specialty: 'Urgent Care' } },
    });
    expect(r.status).toBeGreaterThanOrEqual(500);
  });

  it('no audit metadata carries the NPI, a name, or correction text', async () => {
    prisma.clinicianProfileDraft.findUnique.mockResolvedValue(row({ clinicianFields: completeFields }));
    await invoke(buildApp(), 'patch', '/api/clinician-profile/:npi', {
      verifiedUserId: MINE, params: { npi: NPI },
      body: { corrections: { fullName: 'JEAN ABBOTT', specialty: 'Urgent Care' } },
    });
    const payload = JSON.stringify(prisma.auditEvent.create.mock.calls.map((c) => c[0].data.metadata));
    for (const leak of [NPI, 'JEAN', 'ABBOTT', 'Urgent Care', 'Emergency Medicine']) {
      expect(payload.includes(leak)).toBe(false);
    }
    // Field KEYS are kept — they say what changed without saying to what.
    expect(payload).toContain('specialty');
  });
});
