/**
 * Authorization on the two verifier-pipeline defects closed by V2-03.
 *
 *   #948 — GET  /api/holder/applications  enumerated any clinician's history
 *   #949 — POST /api/verifier/offers/respond answered any clinician's offer
 *
 * WHY THIS MOUNTS ITS OWN EXPRESS APP
 * The module stays UNWIRED (routes/__tests__/verifierPipelineNotWired.test.ts
 * asserts 404 against the real app, and still must). Closing a defect is not
 * authorization to serve the route — defects 1 and 2 in the file header are
 * still open. So this builds a throwaway app to exercise the handlers directly.
 * The two tests assert different things and both are load-bearing: this one says
 * "the code is correct", the other says "the code is not reachable".
 *
 * WHY THE ASSERTIONS ARE ABOUT RESPONSES AND STORED STATE
 * Not about which helper was called. The predecessor suite for a sibling route
 * was green throughout the vulnerability because it contained
 * `it('allows an employer with an org-role header to read')` — the defect,
 * asserted as correct behaviour. Every case below states an outcome an attacker
 * would want, and denies it.
 *
 * Each of these was run against the PRE-FIX code and observed to fail; the
 * sabotage log is in the V2-03 handoff. A test that has never been red is a
 * claim, not a guard.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    npiOwnership: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

interface PrismaMock {
  user: { findUnique: jest.Mock };
  npiOwnership: { findFirst: jest.Mock; findMany: jest.Mock };
}

/**
 * Re-acquired by `setup()` on every test, never captured once at module load.
 *
 * `jest.resetModules()` re-runs the mock factory, so it hands out FRESH
 * `jest.fn()`s and any handle taken before the reset is pointing at the
 * previous generation. Configuring that stale handle silently configures
 * nothing — every ownership lookup then returns `undefined`, the authorized set
 * comes back empty, and *every denial assertion in this file passes for the
 * wrong reason* while the positive-path ones fail. That is exactly what this
 * suite did on first run: 9 green, and the green was meaningless.
 */
let prisma: PrismaMock;

// Two clinicians. ALICE is the caller in every test; BOB is the stranger whose
// data must never be reachable. Both NPIs are check-digit valid but belong to
// nobody — real NPIs name real people (see synthetic-NPI rules).
const ALICE_CLERK = 'user_2aliceAAAAAAAAAAAAAAAA';
const ALICE_INTERNAL = '11111111-1111-4111-8111-111111111111';
const ALICE_NPI = '1234567893';

const BOB_CLERK = 'user_2bobBBBBBBBBBBBBBBBBBB';
const BOB_INTERNAL = '22222222-2222-4222-8222-222222222222';
const BOB_NPI = '1245319599';

/** The shape `resolveAuthorizedNpis` selects, plus the npi it reads. */
interface OwnershipRow {
  npi: string;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  revokedAt: Date | null;
}

const VERIFIED_ROW = (npi: string): OwnershipRow => ({
  npi,
  verifiedAt: new Date('2026-02-01T00:00:00Z'),
  verificationMethod: 'ADMIN_VERIFIED',
  revokedAt: null,
});
/** A self-asserted claim. A request, never authority. */
const PENDING_ROW = (npi: string): OwnershipRow => ({
  npi,
  verifiedAt: null,
  verificationMethod: 'CLAIMED',
  revokedAt: null,
});
const REVOKED_ROW = (npi: string): OwnershipRow => ({
  npi,
  verifiedAt: new Date('2026-02-01T00:00:00Z'),
  verificationMethod: 'ADMIN_VERIFIED',
  revokedAt: new Date('2026-03-01T00:00:00Z'),
});

type Service = typeof import('../../services/verifier/verifierPipelineService');

let service: Service;
let app: express.Express;

interface SetupOptions {
  /**
   * The Clerk subject on the verified session, or omitted for anonymous.
   *
   * `verifiedAuth` is what `verifiedIdentityMiddleware` leaves on the request
   * after a bearer token actually verified. Setting it directly is the honest
   * simulation: it is the only channel `requireVerifiedClerkUserId` reads, and
   * notably NOT `x-clerk-user-id` — a forged header cannot reach these handlers.
   */
  session?: string;
  /** Ownership rows for Alice. Defaults to a single verified binding. */
  aliceBindings?: OwnershipRow[];
  /** When true, Alice has no `User` row at all. */
  noAccount?: boolean;
}

/**
 * Build a throwaway app with empty stores and freshly configured mocks.
 *
 * Order matters and is the reason this is one function rather than two: the
 * module reset must happen BEFORE the prisma handle is taken and the mock
 * implementations are attached. Splitting them is what broke this suite once.
 */
function setup(options: SetupOptions = {}): void {
  // Fresh module registry so the service's in-process Maps start empty. They
  // are module-level state with no reset hook; re-requiring is the reset.
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  prisma = require('../../graphql/prisma_client').default as PrismaMock;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  service = require('../../services/verifier/verifierPipelineService');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerVerifierPipelineRoutes } = require('../verifierPipeline');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../middleware/errorHandler');

  const bindings = options.aliceBindings ?? [VERIFIED_ROW(ALICE_NPI)];
  prisma.user.findUnique.mockImplementation(async ({ where }: { where: { clerkUserId: string } }) => {
    if (options.noAccount) return null;
    if (where.clerkUserId === ALICE_CLERK) return { id: ALICE_INTERNAL };
    if (where.clerkUserId === BOB_CLERK) return { id: BOB_INTERNAL };
    return null;
  });
  prisma.npiOwnership.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) =>
    where.userId === ALICE_INTERNAL ? bindings : [],
  );

  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as express.Request & { verifiedAuth?: unknown }).verifiedAuth = options.session
      ? { outcome: 'verified_match', verifiedUserId: options.session }
      : { outcome: 'anonymous' };
    next();
  });
  registerVerifierPipelineRoutes(a);
  a.use(errorHandler);
  app = a;

  // Both clinicians have applications on file, so every "you cannot see it"
  // assertion is denying access to something that genuinely exists.
  service.applyToOpportunity({ npi: ALICE_NPI, opportunityId: 'op_alice', verifierOrgId: 'ORG_A' });
  service.applyToOpportunity({ npi: BOB_NPI, opportunityId: 'op_bob', verifierOrgId: 'ORG_B' });
}

// ── #948 — GET /api/holder/applications ──────────────────────────────────────

describe('#948 — holder application history is scoped to the verified session', () => {
  it('refuses an unauthenticated caller with 401, and returns no rows', async () => {
    setup();

    const res = await request(app).get(`/api/holder/applications?npi=${BOB_NPI}`);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(BOB_NPI);
  });

  it("refuses Alice's attempt to read Bob's history by naming his NPI", async () => {
    setup({ session: ALICE_CLERK });

    const res = await request(app).get(`/api/holder/applications?npi=${BOB_NPI}`);

    // This is the whole defect: BOB_NPI is a public NPPES identifier, so before
    // the fix this returned which employers Bob applied to and when.
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('op_bob');
  });

  it("returns only Alice's own rows when no npi is supplied", async () => {
    setup({ session: ALICE_CLERK });

    const res = await request(app).get('/api/holder/applications');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.applications.map((a: { npi: string }) => a.npi)).toEqual([ALICE_NPI]);
  });

  it('serves Alice her own history when she names her own NPI', async () => {
    setup({ session: ALICE_CLERK });

    const res = await request(app).get(`/api/holder/applications?npi=${ALICE_NPI}`);

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].opportunityId).toBe('op_alice');
  });

  it('treats a PENDING claim as no authority — a claim is a request', async () => {
    setup({ session: ALICE_CLERK, aliceBindings: [PENDING_ROW(ALICE_NPI)] });

    const named = await request(app).get(`/api/holder/applications?npi=${ALICE_NPI}`);
    const unnamed = await request(app).get('/api/holder/applications');

    expect(named.status).toBe(403);
    expect(unnamed.status).toBe(200);
    expect(unnamed.body.total).toBe(0);
  });

  it('treats a REVOKED binding as no authority', async () => {
    setup({ session: ALICE_CLERK, aliceBindings: [REVOKED_ROW(ALICE_NPI)] });

    const res = await request(app).get(`/api/holder/applications?npi=${ALICE_NPI}`);

    expect(res.status).toBe(403);
  });

  it('returns an empty set — never every row — for a session with no account', async () => {
    setup({ session: 'user_2ghostGGGGGGGGGGGGGGG', noAccount: true });

    const res = await request(app).get('/api/holder/applications');

    // The failure mode this denies: an empty authorized set read as "no filter".
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain(ALICE_NPI);
  });

  it('never sends a Clerk-shaped id to the uuid-typed ownership column', async () => {
    setup({ session: ALICE_CLERK });

    await request(app).get('/api/holder/applications');

    const where = prisma.npiOwnership.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(ALICE_INTERNAL);
    expect(where.userId).not.toMatch(/^user_/);
  });
});

// ── #949 — POST /api/verifier/offers/respond ─────────────────────────────────

describe('#949 — an offer is answerable only by the holder it was issued to', () => {
  /** An offer to Bob. Alice must not be able to touch it. */
  function offerToBob(expiresInHours = 72) {
    return service.sendInstantOffer({
      npi: BOB_NPI,
      opportunityId: 'op_bob',
      verifierOrgId: 'ORG_B',
      expiresInHours,
    });
  }
  function offerToAlice(expiresInHours = 72) {
    return service.sendInstantOffer({
      npi: ALICE_NPI,
      opportunityId: 'op_alice',
      verifierOrgId: 'ORG_A',
      expiresInHours,
    });
  }

  it('refuses an unauthenticated responder with 401 and leaves the offer PENDING', async () => {
    setup();
    const offer = offerToAlice();

    const res = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: offer.offerId, accept: true });

    expect(res.status).toBe(401);
    expect(service.getOffersForNpi(ALICE_NPI)[0].status).toBe('PENDING');
  });

  it("does not let Alice answer Bob's offer, even holding its exact id", async () => {
    setup({ session: ALICE_CLERK });
    const offer = offerToBob();

    const res = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: offer.offerId, accept: true });

    // 404, not 403: a 403 would confirm to a guessed-id holder that the offer
    // exists and belongs to someone else. `offerId` is an identifier, not a
    // bearer credential — possession must buy nothing, including information.
    expect(res.status).toBe(404);
    expect(service.getOffersForNpi(BOB_NPI)[0].status).toBe('PENDING');
    // ...and no decision was written onto Bob's application on his behalf.
    // INSTANT_OFFER_SENT is where `sendInstantOffer` legitimately left it; the
    // defect was that a stranger's response then moved it to ACCEPTED.
    expect(service.getApplicationsByNpi(BOB_NPI)[0].state).toBe('INSTANT_OFFER_SENT');
  });

  it('answers an unknown id identically to a stranger\'s id — no existence oracle', async () => {
    setup({ session: ALICE_CLERK });
    const real = offerToBob();

    const stranger = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: real.offerId, accept: true });
    const unknown = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: '00000000-0000-4000-8000-000000000000', accept: true });

    expect(stranger.status).toBe(unknown.status);
    expect(stranger.body).toEqual(unknown.body);
  });

  it('lets the holder accept her own PENDING offer and advances her application', async () => {
    setup({ session: ALICE_CLERK });
    const offer = offerToAlice();

    const res = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: offer.offerId, accept: true });

    expect(res.status).toBe(200);
    expect(res.body.offer.status).toBe('ACCEPTED');
    expect(service.getApplicationsByNpi(ALICE_NPI)[0].state).toBe('ACCEPTED');
  });

  it('refuses to rewrite a decision that already stands (409)', async () => {
    setup({ session: ALICE_CLERK });
    const offer = offerToAlice();

    await request(app).post('/api/verifier/offers/respond').send({ offerId: offer.offerId, accept: true });
    const replay = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: offer.offerId, accept: false });

    expect(replay.status).toBe(409);
    // The accepted decision survives the replay — the defect was that it did not.
    expect(service.getOffersForNpi(ALICE_NPI)[0].status).toBe('ACCEPTED');
    expect(service.getApplicationsByNpi(ALICE_NPI)[0].state).toBe('ACCEPTED');
  });

  it('refuses a lapsed offer with 410 and makes EXPIRED a real status', async () => {
    setup({ session: ALICE_CLERK });
    const offer = offerToAlice(-1); // expired an hour ago

    const res = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: offer.offerId, accept: true });

    expect(res.status).toBe(410);
    // Before the fix, `expiresAt` was written and never read, so EXPIRED was a
    // decorative member of the union that no code path could ever assign.
    expect(service.getOffersForNpi(ALICE_NPI)[0].status).toBe('EXPIRED');
    // No decision was recorded — the application sits where the send left it.
    expect(service.getApplicationsByNpi(ALICE_NPI)[0].state).toBe('INSTANT_OFFER_SENT');
  });

  it('checks ownership before expiry, so a stranger learns nothing about state', async () => {
    setup({ session: ALICE_CLERK });
    const offer = offerToBob(-1); // Bob's offer, and expired

    const res = await request(app)
      .post('/api/verifier/offers/respond')
      .send({ offerId: offer.offerId, accept: true });

    // 404 rather than 410 — the check order is the control. Answering 410 here
    // would tell a stranger the offer is real and has lapsed.
    expect(res.status).toBe(404);
    expect(service.getOffersForNpi(BOB_NPI)[0].status).toBe('PENDING');
  });

  it('still validates the request shape before doing any of this', async () => {
    setup({ session: ALICE_CLERK });

    const res = await request(app).post('/api/verifier/offers/respond').send({});

    expect(res.status).toBe(400);
  });
});
