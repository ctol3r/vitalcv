import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $use: jest.fn(),
    // C2: the authorization path resolves the NPI<->user binding here.
    npiOwnership: { findFirst: jest.fn() },
  },
}));

jest.mock('../../services/employers/employerService', () => ({
  getEmployerBySlug: jest.fn().mockResolvedValue({
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    trustScore: 94,
    hiringStatus: 'HIRING_NOW',
    timeToStart: '2-3 weeks',
  }),
}));

/*
 * The shape `getLiveMatchesForNpi` ACTUALLY returns (liveMatchaService.ts:470).
 * The previous mock invented an `opportunities` key the service never emits,
 * so the assertions below only ever proved the route echoed its own mock.
 */
const LIVE_RESULT = {
  npi: '1003000126',
  clinicianName: 'JEAN ABBOTT',
  specialty: 'Cardiology',
  state: 'CA',
  opportunitySource: 'database' as const,
  matches: [
    {
      opportunityId: 'opp-1',
      band: 'PARTIAL',
      score: 61,
      blockers: [{ label: 'Missing state license: CA' }],
      fitReasons: ['Specialty matches: cardiology'],
      durable: true,
      status: 'ACTIVE',
      opportunity: {
        id: 'opp-1',
        title: 'Interventional Cardiologist',
        organizationId: '11111111-2222-3333-4444-555555555555',
        organizationName: 'Bay Area Cardiac Group',
        employerSlug: 'bay-area-cardiac-group',
        state: 'CA',
        hiringType: 'Full-time',
      },
      explanation: {
        matchBand: 'PARTIAL',
        matchScore: 61,
        fitReasons: [
          { label: 'Specialty matches: cardiology', dimension: 'specialty' },
          { label: '40% of requirements met at L3', dimension: 'coverage' },
        ],
        blockers: [{ label: 'Missing state license: CA' }],
      },
    },
  ],
};

jest.mock('../../services/matcha/liveMatchaService', () => ({
  getLiveMatchesForNpi: jest.fn(),
  scoreOpportunityForNpi: jest.fn(),
}));

import prismaClient from '../../graphql/prisma_client';
import { registerMatchaRoutes } from '../matcha';
import { getLiveMatchesForNpi } from '../../services/matcha/liveMatchaService';

const getLiveMatchesMock = getLiveMatchesForNpi as jest.Mock;
const npiOwnershipFindFirst = (prismaClient as unknown as {
  npiOwnership: { findFirst: jest.Mock };
}).npiOwnership.findFirst;

beforeEach(() => {
  getLiveMatchesMock.mockReset();
  getLiveMatchesMock.mockResolvedValue(LIVE_RESULT);
  // Default: the verified user DOES own the NPI. Tests that need the
  // unauthorized path override this explicitly.
  npiOwnershipFindFirst.mockReset();
  npiOwnershipFindFirst.mockResolvedValue(
    // Wave 1075: a VERIFIED binding; a bare row is now a pending claim.
    { verifiedAt: new Date('2026-02-01T00:00:00Z'), verificationMethod: 'ADMIN_VERIFIED', revokedAt: null },
  );
});

async function invokeRoute(
  app: express.Express,
  routePath: string,
  params: Record<string, string>,
  opts: { headers?: Record<string, string>; query?: Record<string, string>; verifiedUserId?: string } = {},
) {
  const router = (app as unknown as {
    _router?: {
      stack?: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: (req: express.Request, res: express.Response, next: express.NextFunction) => unknown }>;
        };
      }>;
    };
  })._router;
  const layer = router?.stack?.find((candidate) => (
    candidate.route?.path === routePath && candidate.route.methods.get
  ));

  if (!layer?.route?.stack?.[0]) {
    throw new Error(`Route not found: GET ${routePath}`);
  }
  const route = layer.route;

  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    let statusCode = 200;
    const req = {
      params,
      query: opts.query ?? {},
      headers: opts.headers ?? {},
      // Set by verifiedIdentityMiddleware from a verified Clerk JWT. Absent =
      // anonymous, exactly as it is for a caller who forges x-clerk-user-id.
      ...(opts.verifiedUserId ? { verifiedAuth: { verifiedUserId: opts.verifiedUserId } } : {}),
    } as unknown as express.Request;
    /*
     * `locals` is always present on a real Express response, and route
     * middleware legitimately reads it (publicApiRateLimit looks for
     * res.locals.api_key_id). Omitting it made the fake response diverge from
     * Express in a way that only surfaced once a rate limiter was mounted.
     */
    const res = {
      locals: {} as Record<string, unknown>,
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        resolve({ status: statusCode, body: payload });
        return this;
      },
      setHeader() { return this; },
    } as unknown as express.Response;

    /*
     * Run the WHOLE route stack, not just stack[0]. These routes now carry
     * middleware ahead of the handler, and invoking only the first entry
     * exercised the middleware while asserting on the handler's output.
     */
    const stack = route.stack;
    const step = (index: number): void => {
      if (index >= stack.length) return;
      try {
        const result = stack[index].handle(
          req,
          res,
          (() => step(index + 1)) as unknown as express.NextFunction,
        );
        Promise.resolve(result).catch(reject);
      } catch (error) {
        reject(error);
      }
    };
    step(0);
  });
}

describe('GET /api/matcha/opportunities/:npi', () => {
  it('returns employer linkage and askContext for each opportunity', async () => {
    const app = express();
    app.use(express.json());
    registerMatchaRoutes(app);

    const response = await invokeRoute(app, '/api/matcha/opportunities/:npi', {
      npi: '1003000126',
    }, { verifiedUserId: 'user_owner' });
    const payload = response.body as {
      visibility: string;
      matches: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(payload.visibility).toBe('authenticated');
    expect(payload.matches.length).toBeGreaterThan(0);
    expect(payload.matches[0]).toHaveProperty('opportunity.organizationId');
    expect(payload.matches[0]).toHaveProperty('opportunity.employerSlug');
    expect(payload.matches[0]).toHaveProperty('explanation.matchBand');
    expect(payload.matches[0]).toHaveProperty('explanation.blockers');
  });
});

/*
 * C2 — an NPI is public; the readiness profile compiled from it is not. These
 * pin BOTH levels of the one route. They replace an assertion that anonymous
 * callers receive the full credential-derived object, which was the defect.
 */
describe('GET /api/matcha/opportunities/:npi — public vs authenticated levels', () => {
  const NPI = '1003000126';

  function buildApp() {
    const app = express();
    app.use(express.json());
    registerMatchaRoutes(app);
    return app;
  }

  it('projects an anonymous caller down to public-safe facts', async () => {
    const response = await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI });
    const body = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect((response.body as { visibility: string }).visibility).toBe('public');
    // Credential-derived detail must be absent, not merely unrendered.
    for (const leak of ['matchBand', 'matchScore', 'blockers', 'PARTIAL', 'clinicianName', 'requirements met']) {
      // eslint-disable-next-line jest/valid-expect -- the leak name is in the loop label below
      expect({ leak, body: body.includes(leak) }).toEqual({ leak, body: false });
    }
    // Public facts about the LISTING still come through.
    const match = (response.body as { matches: Array<Record<string, unknown>> }).matches[0];
    expect(match.title).toBe('Interventional Cardiologist');
    expect(match.fitIndication).toBe('possible_fit');
    expect(match.publicReasons).toEqual(['Specialty matches: cardiology']);
  });

  it('refuses the full level to a session that does not own the NPI', async () => {
    npiOwnershipFindFirst.mockResolvedValueOnce(null);
    const response = await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      verifiedUserId: 'user_someone_else',
    });
    expect((response.body as { visibility: string }).visibility).toBe('public');
  });

  it('ignores a forged x-clerk-user-id header', async () => {
    const response = await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-clerk-user-id': 'user_attacker' },
    });
    expect((response.body as { visibility: string }).visibility).toBe('public');
  });
});

describe('GET /api/matcha/opportunities/:npi — preference intent wiring', () => {
  const NPI = '1003000126';
  const intent = { npi: NPI, preferredStates: ['CA'], remoteOnly: true, preferredHiringTypes: ['locums'] };

  function buildApp() {
    const app = express();
    app.use(express.json());
    registerMatchaRoutes(app);
    return app;
  }


  it('forwards a valid x-matcha-intent header to the scorer (preference-driven ranking)', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': JSON.stringify(intent) },
      verifiedUserId: 'user_owner',
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(
      NPI,
      expect.anything(),
      expect.objectContaining({ npi: NPI, remoteOnly: true, preferredStates: ['CA'] }),
    );
  });

  /*
   * C2: stated preferences only ever shape a caller's OWN feed. Honouring an
   * anonymous caller's intent would let them probe how another clinician's
   * ranking responds to location, pay and timing.
   */
  it('ignores the intent header entirely when the caller is not the NPI owner', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': JSON.stringify(intent) },
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });

  it('passes null when no preference header is present (credential-only fallback)', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, { verifiedUserId: 'user_owner' });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });

  it('ignores an intent whose NPI does not match the route', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': JSON.stringify({ ...intent, npi: '9999999999' }) },
      verifiedUserId: 'user_owner',
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });

  it('ignores a malformed intent header (never breaks the feed)', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': '{not valid json' },
      verifiedUserId: 'user_owner',
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });
});
