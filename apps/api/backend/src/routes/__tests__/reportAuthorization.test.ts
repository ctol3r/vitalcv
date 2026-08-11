/**
 * A credential intelligence report is a derived assessment of a named
 * clinician — readiness score, blockers, risk flags, time-to-start — and its
 * subject used to come straight from the URL.
 *
 * WHY THE OLD ROUTES WERE NOT SAFE, DESPITE A "SECURITY:" HEADER
 * The file documented "All external input treated as unsafe (NPI validated)".
 * That is input validation: it answers whether the parameter is well-formed,
 * never whether the caller may read that person's assessment. NPIs are public
 * NPPES identifiers, so a well-formed subject is *enumerable* — validating it
 * harder does not help.
 *
 * The only thing in front of the handlers was the global tenant guard, and that
 * guard is a turnstile rather than a scope: `TENANT_ORG_BINDING` defaults to
 * `off`, and organizationContext.ts documents its own query/header sources as
 * unauthenticated and "NOT an authorization decision" even under `enforce`.
 *
 * These cases therefore assert on the RESPONSE and on whether the report
 * generator ran at all — never on which middleware was mounted. A guard that is
 * present but not reached would pass a mounting assertion.
 *
 * The throwaway app mirrors routes/__tests__/verifierPipelineAuthorization:
 * it exercises the handlers without depending on the full app boot.
 */

import express from 'express';
import request from 'supertest';

// The first setup() pays the whole module-init + ts-jest compile cost for the
// route chain; the requests themselves are single-digit milliseconds. Without
// this the FIRST case times out at 5s and the other nine pass, which reads as a
// flake rather than as the fixed startup cost it is.
jest.setTimeout(180_000);

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    npiOwnership: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../services/report/credentialIntelligenceReport', () => ({
  generateCredentialIntelligenceReport: jest.fn(),
}));

interface PrismaMock {
  user: { findUnique: jest.Mock };
  npiOwnership: { findFirst: jest.Mock; findMany: jest.Mock };
}

// Taken AFTER jest.resetModules() inside setup(), never at module load — the
// mock factory re-runs on reset and hands out fresh jest.fn()s, so a handle
// captured up here would configure a dead generation and every denial below
// would pass for the wrong reason.
let prisma: PrismaMock;
let generate: jest.Mock;
let app: express.Express;

const ALICE_CLERK = 'user_2aliceAAAAAAAAAAAAAAAA';
const ALICE_INTERNAL = '11111111-1111-4111-8111-111111111111';
const ALICE_NPI = '1234567893';
/** A real, well-formed NPI that is simply not Alice's. */
const STRANGER_NPI = '1245319599';

const VERIFIED = {
  verifiedAt: new Date('2026-02-01T00:00:00Z'),
  verificationMethod: 'ADMIN_VERIFIED',
  revokedAt: null,
};
const PENDING = { verifiedAt: null, verificationMethod: 'CLAIMED', revokedAt: null };

function setup(options: { session?: string; binding?: unknown } = {}): void {
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  prisma = require('../../graphql/prisma_client').default as PrismaMock;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  generate = require('../../services/report/credentialIntelligenceReport')
    .generateCredentialIntelligenceReport as jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerReportRoutes } = require('../report');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../middleware/errorHandler');

  prisma.user.findUnique.mockResolvedValue({ id: ALICE_INTERNAL });
  prisma.npiOwnership.findFirst.mockResolvedValue(
    'binding' in options ? options.binding : VERIFIED,
  );
  generate.mockResolvedValue({
    npi: ALICE_NPI,
    displayName: 'REPORT_BODY_MARKER',
    specialty: null,
    generatedAt: '2026-08-11T00:00:00Z',
    reportId: 'r_1',
    readinessStatus: 'PARTIAL',
    readinessScore: 42,
    readinessLevel: 'partial',
    trustPosture: { band: 'B', bandLabel: 'b', score: 1 },
    timeToStart: {},
    blockers: [],
    riskFlags: [],
    missingData: [],
    gatedData: [],
    reportHash: 'h',
    methodology: 'm',
  });

  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as express.Request & { verifiedAuth?: unknown }).verifiedAuth = options.session
      ? { outcome: 'verified_match', verifiedUserId: options.session }
      : { outcome: 'anonymous' };
    next();
  });
  // The turnstile the routes used to sit behind: org context asserted by the
  // caller about itself. Present here on purpose, so a pass cannot be credited
  // to its absence.
  a.use((req, _res, next) => {
    req.headers['x-org-id'] = 'any-org-the-caller-names';
    next();
  });
  registerReportRoutes(a);
  a.use(errorHandler);
  app = a;
}

const PATHS = [
  { method: 'get' as const, path: `/api/report/${STRANGER_NPI}`, label: 'GET :npi' },
  { method: 'get' as const, path: `/api/report/${STRANGER_NPI}/summary`, label: 'GET :npi/summary' },
];

describe('credential intelligence reports require a bound holder', () => {
  it.each(PATHS)('$label — anonymous caller is refused, and no report is generated', async ({ method, path }) => {
    setup();

    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
    // The generator never ran, so nothing was computed about this clinician.
    expect(generate).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('REPORT_BODY_MARKER');
  });

  it.each(PATHS)("$label — a signed-in caller cannot read a stranger's report", async ({ method, path }) => {
    // Alice is verified for her own NPI; the request names someone else's.
    setup({ session: ALICE_CLERK, binding: null });

    const res = await request(app)[method](path);

    expect(res.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('REPORT_BODY_MARKER');
  });

  it.each(PATHS)('$label — a PENDING claim is not authority', async ({ method, path }) => {
    setup({ session: ALICE_CLERK, binding: PENDING });

    const res = await request(app)[method](path);

    expect(res.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it('POST /api/report — anonymous caller is refused before any generation', async () => {
    setup();

    const res = await request(app).post('/api/report').send({ npi: STRANGER_NPI });

    expect(res.status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("POST /api/report — a signed-in caller cannot report on a stranger", async () => {
    setup({ session: ALICE_CLERK, binding: null });

    const res = await request(app).post('/api/report').send({ npi: STRANGER_NPI });

    expect(res.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it('a bound holder still gets her own report — the guard is not a blanket refusal', async () => {
    setup({ session: ALICE_CLERK, binding: VERIFIED });

    const res = await request(app).get(`/api/report/${ALICE_NPI}`);

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('REPORT_BODY_MARKER');
    expect(generate).toHaveBeenCalledWith({ npi: ALICE_NPI });
  });

  it('still rejects a malformed NPI, and does so without generating', async () => {
    setup({ session: ALICE_CLERK, binding: VERIFIED });

    const res = await request(app).get('/api/report/12345');

    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
});
