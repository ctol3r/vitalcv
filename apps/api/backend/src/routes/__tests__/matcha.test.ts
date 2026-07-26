import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $use: jest.fn(),
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

jest.mock('../../services/matcha/liveMatchaService', () => ({
  getLiveMatchesForNpi: jest.fn().mockResolvedValue({
    opportunities: [
      {
        opportunityId: 'opp-1',
        employerSlug: 'bay-area-cardiac-group',
        employer: {
          name: 'Bay Area Cardiac Group',
        },
        askContext: {
          opportunityId: 'opp-1',
          employerSlug: 'bay-area-cardiac-group',
        },
      },
    ],
  }),
  scoreOpportunityForNpi: jest.fn(),
}));

import { registerMatchaRoutes } from '../matcha';
import { getLiveMatchesForNpi } from '../../services/matcha/liveMatchaService';

const getLiveMatchesMock = getLiveMatchesForNpi as jest.Mock;

async function invokeRoute(
  app: express.Express,
  routePath: string,
  params: Record<string, string>,
  opts: { headers?: Record<string, string>; query?: Record<string, string> } = {},
) {
  const router = (app as unknown as {
    _router?: {
      stack?: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: (req: express.Request, res: express.Response) => unknown }>;
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
    const req = { params, query: opts.query ?? {}, headers: opts.headers ?? {} } as unknown as express.Request;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        resolve({ status: statusCode, body: payload });
        return this;
      },
    } as unknown as express.Response;

    Promise.resolve(route.stack[0].handle(req, res)).catch(reject);
  });
}

describe('GET /api/matcha/opportunities/:npi', () => {
  it('returns employer linkage and askContext for each opportunity', async () => {
    const app = express();
    app.use(express.json());
    registerMatchaRoutes(app);

    const response = await invokeRoute(app, '/api/matcha/opportunities/:npi', {
      npi: '1003000126',
    });
    const payload = response.body as {
      opportunities: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(payload.opportunities.length).toBeGreaterThan(0);
    expect(payload.opportunities[0]).toHaveProperty('employerSlug');
    expect(payload.opportunities[0]).toHaveProperty('employer.name');
    expect(payload.opportunities[0]).toHaveProperty('askContext.opportunityId');
    expect(payload.opportunities[0]).toHaveProperty('askContext.employerSlug');
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

  beforeEach(() => getLiveMatchesMock.mockClear());

  it('forwards a valid x-matcha-intent header to the scorer (preference-driven ranking)', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': JSON.stringify(intent) },
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(
      NPI,
      expect.anything(),
      expect.objectContaining({ npi: NPI, remoteOnly: true, preferredStates: ['CA'] }),
    );
  });

  it('passes null when no preference header is present (credential-only fallback)', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });

  it('ignores an intent whose NPI does not match the route', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': JSON.stringify({ ...intent, npi: '9999999999' }) },
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });

  it('ignores a malformed intent header (never breaks the feed)', async () => {
    await invokeRoute(buildApp(), '/api/matcha/opportunities/:npi', { npi: NPI }, {
      headers: { 'x-matcha-intent': '{not valid json' },
    });
    expect(getLiveMatchesMock).toHaveBeenCalledWith(NPI, expect.anything(), null);
  });
});
