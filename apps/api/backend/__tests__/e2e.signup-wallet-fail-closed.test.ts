/**
 * e2e.signup-wallet-fail-closed.test.ts — launch blocker #4 (2026-07-06)
 *
 * End-to-end contract for the clinician signup golden path and its
 * fail-closed counterpart, exercised over real HTTP against the real
 * Express app and a real Postgres (the CI backend-tests gate provisions
 * one; locally the suite skips without DATABASE_URL).
 *
 *   Happy path:   role → NPI → attest → wallet
 *     POST /api/profile/npi/bootstrap  (profession + attestation payload)
 *       → 201 NpiBootstrapIntakeResult
 *       → PersonProfile row (profession, attestedAt, attestationVersion)
 *       → 'npi_bootstrapped' + 'clinician_attestation' audit rows
 *     GET  /api/me/workspaces
 *       → wallet exists: personProfile populated, CLINICIAN persona
 *
 *   Fail-closed:  a BLOCKED passport cannot be accepted
 *     POST /api/verifier/accept with a REVOKED-status credential   → REJECTED
 *     POST /api/verifier/accept with a registry-revoked credential → REJECTED
 *     POST /api/verifier/accept under VERIFIER_RBAC_MODE=enforce
 *       without an org role                                        → 403
 *
 * The only mock is the NPPES registry fetch (`src/modules/identity`) — the
 * one true external boundary in the chain. Everything else (routing, tenant
 * guard, org-role guard, service, Prisma, audit writes) runs real.
 */

// ── Mocks (hoisted above the SUT import) ──────────────────────────────────

const mockFetchNpiFromCMS = jest.fn();
const mockNormalizeProvider = jest.fn();

// Override ONLY the registry fetchers — app.ts imports other members of this
// barrel (registerIdentityRoutes et al.), which must stay real for boot.
jest.mock('../src/modules/identity', () => ({
  __esModule: true,
  ...jest.requireActual('../src/modules/identity'),
  fetchNpiFromCMS: (...args: unknown[]) => mockFetchNpiFromCMS(...args),
  normalizeProvider: (...args: unknown[]) => mockNormalizeProvider(...args),
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────

import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';
import { revokeCredential } from '../src/services/revocation/revocationRegistry';

// ── Fixtures ──────────────────────────────────────────────────────────────

const VALID_NPI = '1558302470';
const SIGNUP_USER = 'user:e2e:signup-wallet:001';
const OTHER_USER = 'user:e2e:signup-wallet:002';

/**
 * NormalizedProvider fixture matching the real snake_case shape emitted by
 * `normalizeProvider()` (see intakeService.bootstrapNpi.test.ts, which pins
 * that shape against camelCase regressions).
 */
function buildNormalizedProvider() {
  return {
    npi: VALID_NPI,
    enumeration_type: 'NPI-1',
    first_name: 'Dana',
    last_name: 'Reyes',
    primary_taxonomy_code: '163W00000X',
    practice_address: {
      address_1: '100 Main St',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
    },
  };
}

/** Structurally-valid unsigned compact JWS (decodeJwt-parseable). */
function unsignedJws(payload: Record<string, unknown>): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'ES256', typ: 'JWT' })}.${b64(payload)}.e2e-no-signature`;
}

/** A presentation bundling a single credential with the given overrides. */
function buildPresentation(credential: Record<string, unknown>) {
  const holder = 'did:vitalcv:holder:e2e-blocked';
  return {
    presentationId: `pres-e2e-${String(credential.credentialId)}`,
    holder,
    credentials: [
      {
        credentialId: 'cred-e2e-default',
        issuer: 'did:vitalcv:issuer:e2e',
        subject: holder,
        claims: { licenseType: 'RN', state: 'TX' },
        signature: unsignedJws({ iss: 'did:vitalcv:issuer:e2e', sub: holder }),
        status: 'ACTIVE',
        issuedAt: '2026-01-01T00:00:00.000Z',
        ...credential,
      },
    ],
    signature: unsignedJws({ iss: holder }),
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// ── Suite (DB-gated, same idiom as pilot.routes.test.ts) ─────────────────

const runE2eSuite = process.env.DATABASE_URL ? describe : describe.skip;

/** Internal User.id for a Clerk id, or null when no row exists. */
async function internalUserId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  return user?.id ?? null;
}

beforeEach(async () => {
  if (!process.env.DATABASE_URL) return;

  const testUsers = await prisma.user.findMany({
    where: { clerkUserId: { in: [SIGNUP_USER, OTHER_USER] } },
    select: { id: true },
  });
  const testUserIds = testUsers.map((u) => u.id);

  await prisma.auditEvent.deleteMany();
  await prisma.personProfile.deleteMany();
  if (testUserIds.length > 0) {
    await prisma.workspacePreference.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  }

  mockFetchNpiFromCMS.mockReset();
  mockNormalizeProvider.mockReset();
  mockFetchNpiFromCMS.mockResolvedValue({
    rawPayload: { result_count: 1, results: [buildNormalizedProvider()] },
    payloadHash: 'sha256:e2e-fixture',
  });
  mockNormalizeProvider.mockReturnValue(buildNormalizedProvider());
});

afterAll(async () => {
  await prisma.$disconnect();
});

runE2eSuite('e2e: clinician signup — role → NPI → attest → wallet', () => {
  it('bootstraps the profile, records the attestation audit-first, and provisions the wallet', async () => {
    // Step 1 — role + NPI + attestation, exactly what the /get-ready web
    // proxy forwards (x-clerk-user-id identity + x-clerk-user-email claim,
    // self-attested profession). The email lets the backend mint the internal
    // User row on first touch, as /api/me/workspaces does for the UI.
    const bootstrap = await request(app)
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', SIGNUP_USER)
      .set('x-clerk-user-email', 'dana.reyes@example.org')
      .send({
        npi: VALID_NPI,
        profession: 'registered_nurse',
        attested: true,
        attestationVersion: 'v1',
      });

    expect(bootstrap.status).toBe(201);
    expect(bootstrap.body).toMatchObject({
      npi: VALID_NPI,
      npiType: 'TYPE_1',
      inferredPersona: 'CLINICIAN',
      alreadyRegistered: false,
      firstName: 'Dana',
      lastName: 'Reyes',
      stateOfPractice: 'TX',
    });

    // Step 2 — the profile row exists in the INTERNAL id-space (User.id UUID,
    // not the raw Clerk id) and carries the self-attested claims.
    const internalId = await internalUserId(SIGNUP_USER);
    expect(internalId).toBeTruthy();

    const profile = await prisma.personProfile.findUnique({
      where: { userId: internalId as string },
    });
    expect(profile).not.toBeNull();
    expect(profile?.npi).toBe(VALID_NPI);
    expect(profile?.profession).toBe('registered_nurse');
    expect(profile?.attestedAt).not.toBeNull();
    expect(profile?.attestationVersion).toBe('v1');

    // Step 3 — audit-first: both the bootstrap and the distinct attestation
    // event are durable rows, each with a payload hash.
    const bootstrapEvents = await prisma.auditEvent.findMany({
      where: { type: 'npi_bootstrapped', referenceId: internalId as string },
    });
    expect(bootstrapEvents).toHaveLength(1);
    expect(bootstrapEvents[0]?.hash).toBeTruthy();

    const attestationEvents = await prisma.auditEvent.findMany({
      where: { type: 'clinician_attestation', referenceId: internalId as string },
    });
    expect(attestationEvents).toHaveLength(1);
    expect(attestationEvents[0]?.hash).toBeTruthy();

    // Step 4 — the wallet exists: the workspace read-back surfaces the
    // bootstrapped profile under the CLINICIAN persona.
    const workspaces = await request(app)
      .get('/api/me/workspaces')
      .set('x-clerk-user-id', SIGNUP_USER)
      .set('x-clerk-user-email', 'dana.reyes@example.org');

    expect(workspaces.status).toBe(200);
    expect(workspaces.body.userId).toBe(internalId);
    expect(workspaces.body.personProfile?.npi).toBe(VALID_NPI);
    expect(workspaces.body.activePersona).toBe('CLINICIAN');
    expect(Array.isArray(workspaces.body.memberships)).toBe(true);
  });

  it('rejects the bootstrap without a signed-in identity (401)', async () => {
    const res = await request(app)
      .post('/api/profile/npi/bootstrap')
      .send({ npi: VALID_NPI, profession: 'registered_nurse', attested: true });

    expect(res.status).toBe(401);
  });

  it('rejects a malformed NPI (400) before any registry call or row creation', async () => {
    const res = await request(app)
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', SIGNUP_USER)
      .set('x-clerk-user-email', 'dana.reyes@example.org')
      .send({ npi: '123', profession: 'registered_nurse', attested: true });

    expect(res.status).toBe(400);
    expect(mockFetchNpiFromCMS).not.toHaveBeenCalled();
    // Validation precedes user provisioning — no row was minted.
    expect(await internalUserId(SIGNUP_USER)).toBeNull();
  });

  it('drops professions outside the attestable vocabulary instead of storing them', async () => {
    const res = await request(app)
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', SIGNUP_USER)
      .set('x-clerk-user-email', 'dana.reyes@example.org')
      .send({ npi: VALID_NPI, profession: 'astronaut', attested: true });

    expect(res.status).toBe(201);
    const profile = await prisma.personProfile.findFirst({
      where: { npi: VALID_NPI },
    });
    expect(profile).not.toBeNull();
    expect(profile?.profession).toBeNull();
  });

  it('fails closed when the NPI is already claimed by another account', async () => {
    const first = await request(app)
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', SIGNUP_USER)
      .set('x-clerk-user-email', 'dana.reyes@example.org')
      .send({ npi: VALID_NPI, profession: 'registered_nurse', attested: true });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', OTHER_USER)
      .set('x-clerk-user-email', 'sam.chen@example.org')
      .send({ npi: VALID_NPI, profession: 'physician', attested: true });

    expect(second.status).toBeGreaterThanOrEqual(400);

    // The claim did not move.
    const owner = await prisma.personProfile.findFirst({ where: { npi: VALID_NPI } });
    expect(owner?.userId).toBe(await internalUserId(SIGNUP_USER));
  });
});

runE2eSuite('e2e: fail-closed — a blocked passport cannot be accepted', () => {
  it('REJECTS a presentation whose credential status is REVOKED', async () => {
    const res = await request(app)
      .post('/api/verifier/accept')
      .send({
        presentation: buildPresentation({
          credentialId: 'cred-e2e-status-revoked',
          status: 'REVOKED',
        }),
      });

    expect(res.status).toBe(200);
    expect(res.body.report?.decision).toBe('REJECTED');
    expect(res.body.report?.decision).not.toBe('ACCEPTED');
    expect(res.body.report?.summary).toContain('revoked');

    const result = res.body.report?.credentialResults?.[0];
    expect(result?.valid).toBe(false);
    expect(result?.checks?.statusActive).toBe(false);
  });

  it('REJECTS an otherwise-ACTIVE credential that the revocation registry has revoked', async () => {
    revokeCredential({
      credentialId: 'cred-e2e-registry-revoked',
      issuer: 'did:vitalcv:issuer:e2e',
      reason: 'license revoked by state board',
    });

    const res = await request(app)
      .post('/api/verifier/accept')
      .send({
        presentation: buildPresentation({
          credentialId: 'cred-e2e-registry-revoked',
          status: 'ACTIVE',
        }),
      });

    expect(res.status).toBe(200);
    expect(res.body.report?.decision).toBe('REJECTED');

    const result = res.body.report?.credentialResults?.[0];
    expect(result?.checks?.statusActive).toBe(false);
    expect(String(result?.errors)).toContain('has been revoked');
  });

  it('blocks the accept mutation entirely for a caller without an org role under RBAC enforce', async () => {
    const prev = process.env.VERIFIER_RBAC_MODE;
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    try {
      const res = await request(app)
        .post('/api/verifier/accept')
        .send({
          presentation: buildPresentation({
            credentialId: 'cred-e2e-rbac',
            status: 'ACTIVE',
          }),
        });

      expect(res.status).toBe(403);
    } finally {
      if (prev === undefined) delete process.env.VERIFIER_RBAC_MODE;
      else process.env.VERIFIER_RBAC_MODE = prev;
    }
  });
});
