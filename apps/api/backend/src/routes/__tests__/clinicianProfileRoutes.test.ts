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

import prismaClient from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { registerClinicianProfileRoutes } from '../clinicianProfile';

const prisma = prismaClient as unknown as {
  npiOwnership: { findFirst: jest.Mock };
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

beforeEach(() => {
  jest.clearAllMocks();
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
      verifiedUserId: MINE, body: { npi: NPI, resolved: { fullName: 'JEAN ABBOTT' } },
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
      verifiedUserId: MINE, body: { npi: NPI, resolved: { fullName: 'JEAN ABBOTT' } },
    });
    expect(prisma.clinicianProfileDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_npi: { userId: MINE, npi: NPI } } }),
    );
  });

  it('a re-claim refreshes the snapshot but never the activation stamps', async () => {
    await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: NPI, resolved: { fullName: 'JEAN ABBOTT' } },
    });
    const update = prisma.clinicianProfileDraft.upsert.mock.calls[0][0].update;
    expect(update).toHaveProperty('resolvedSnapshot');
    for (const stamp of ['reviewedAt', 'sharingConfirmedAt', 'savedAt', 'activatedAt', 'clinicianFields']) {
      expect({ stamp, reset: Object.prototype.hasOwnProperty.call(update, stamp) }).toEqual({ stamp, reset: false });
    }
  });

  it('rejects a malformed NPI before touching the database', async () => {
    const r = await invoke(buildApp(), 'post', '/api/clinician-profile/claim', {
      verifiedUserId: MINE, body: { npi: '123', resolved: {} },
    });
    expect(r.status).toBe(400);
    expect(prisma.clinicianProfileDraft.upsert).not.toHaveBeenCalled();
  });
});
