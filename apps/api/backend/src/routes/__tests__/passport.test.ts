import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      findFirst: jest.fn(),
    },
    decisionCapsule: {
      findMany: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/rateLimitFactory', () => ({
  proofRateLimit: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../services/passport/shareLink', () => ({
  generateShareLink: jest.fn((npi: string) => ({
    url: `https://app.vitalcv.com/p/${npi}?t=passport-token`,
    token: 'passport-token',
    npi,
    generatedAt: '2026-03-01T00:00:00.000Z',
    expiresAt: '2026-03-31T00:00:00.000Z',
  })),
}));

jest.mock('../../services/trust/trustStateEngine', () => ({
  getCachedTrustState: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { getCachedTrustState } from '../../services/trust/trustStateEngine';
import { registerPassportRoutes } from '../passport';

type RouteHandler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => void | Promise<void>;

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  text: string;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  send: (payload: unknown) => MockResponse;
  type: (contentType: string) => MockResponse;
  setHeader: (name: string, value: string) => void;
};

const prismaMock = prisma as unknown as {
  provider: {
    findFirst: jest.Mock;
  };
  decisionCapsule: {
    findMany: jest.Mock;
  };
  verificationArtifact: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
};

const trustStateMock = getCachedTrustState as jest.Mock;

function createApp() {
  const app = express();
  app.use(express.json());
  registerPassportRoutes(app);
  return app;
}

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    text: '',
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.headers['content-type'] = this.headers['content-type'] ?? 'application/json; charset=utf-8';
      this.body = payload;
      this.text = JSON.stringify(payload);
      return this;
    },
    send(payload: unknown) {
      if (typeof payload === 'string') {
        this.text = payload;
      } else {
        this.body = payload;
        this.text = JSON.stringify(payload);
      }
      return this;
    },
    type(contentType: string) {
      this.headers['content-type'] = contentType;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
  };
}

function getRouteHandlers(
  app: express.Express,
  method: 'get',
  path: string,
): RouteHandler[] {
  const stack = (
    app as unknown as {
      _router?: {
        stack: Array<{
          route?: {
            path: string;
            methods: Record<string, boolean>;
            stack: Array<{ handle: RouteHandler }>;
          };
        }>;
      };
    }
  )._router?.stack ?? [];

  const routeLayer = stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  if (!routeLayer?.route) {
    throw new Error(`Unable to find route ${method.toUpperCase()} ${path}`);
  }

  return routeLayer.route.stack.map((layer) => layer.handle);
}

async function executeHandler(
  handler: RouteHandler,
  req: express.Request,
  res: express.Response,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let nextCalled = false;

    const next: express.NextFunction = (error?: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      nextCalled = true;
      resolve(true);
    };

    Promise.resolve(handler(req, res, next))
      .then(() => {
        if (!nextCalled) {
          resolve(false);
        }
      })
      .catch(reject);
  });
}

async function invokeGetRoute(
  app: express.Express,
  path: string,
  options: {
    params: Record<string, string>;
    query?: Record<string, string>;
  },
): Promise<MockResponse> {
  const req = {
    params: options.params,
    query: options.query ?? {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as express.Request;
  const res = createMockResponse() as unknown as express.Response;
  const handlers = getRouteHandlers(app, 'get', path);

  for (const handler of handlers) {
    const nextCalled = await executeHandler(handler, req, res);
    if (!nextCalled) {
      break;
    }
  }

  return res as unknown as MockResponse;
}

function seedPassportData(overrides?: {
  provider?: Record<string, unknown> | null;
  artifacts?: Array<Record<string, unknown>>;
  capsules?: Array<Record<string, unknown>>;
  oigArtifact?: Record<string, unknown> | null;
  trustState?: Record<string, unknown> | null;
}) {
  prismaMock.provider.findFirst.mockResolvedValue(Object.prototype.hasOwnProperty.call(overrides ?? {}, 'provider')
    ? overrides?.provider ?? null
    : {
    fullName: 'Dr. Ada Lovelace',
    taxonomyCode: 'Internal Medicine',
    providerType: 'INDIVIDUAL',
    stateOfPractice: 'CA',
  });
  prismaMock.verificationArtifact.findMany.mockResolvedValue(overrides?.artifacts ?? [
    {
      id: 'artifact-npi',
      source: 'NPPES',
      status: 'ACTIVE',
      verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
      expiresAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      rawPayload: {
        provider_name: 'Dr. Ada Lovelace',
        practice_state: 'CA',
      },
    },
    {
      id: 'artifact-license',
      source: 'STATE_BOARD',
      status: 'ACTIVE',
      verifiedAt: new Date('2026-03-02T00:00:00.000Z'),
      expiresAt: new Date('2027-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
      rawPayload: {
        state: 'CA',
        license_number: 'CA-12345',
        board_name: 'California Medical Board',
      },
    },
    {
      id: 'artifact-board',
      source: 'ABMS',
      status: 'ACTIVE',
      verifiedAt: new Date('2026-03-03T00:00:00.000Z'),
      expiresAt: new Date('2028-03-03T00:00:00.000Z'),
      createdAt: new Date('2026-03-03T00:00:00.000Z'),
      rawPayload: {
        board_name: 'American Board of Internal Medicine',
        specialty: 'Internal Medicine',
      },
    },
    {
      id: 'artifact-dea',
      source: 'DEA',
      status: 'ACTIVE',
      verifiedAt: new Date('2026-03-04T00:00:00.000Z'),
      expiresAt: new Date('2027-03-04T00:00:00.000Z'),
      createdAt: new Date('2026-03-04T00:00:00.000Z'),
      rawPayload: {
        registration_number: 'DEA-SECRET-123',
      },
    },
  ]);
  prismaMock.decisionCapsule.findMany.mockResolvedValue(overrides?.capsules ?? []);
  prismaMock.verificationArtifact.findFirst.mockResolvedValue(
    Object.prototype.hasOwnProperty.call(overrides ?? {}, 'oigArtifact')
      ? overrides?.oigArtifact ?? null
      : null,
  );
  trustStateMock.mockResolvedValue(Object.prototype.hasOwnProperty.call(overrides ?? {}, 'trustState')
    ? overrides?.trustState ?? null
    : {
    npi: '1234567890',
    identityVerified: true,
    licensureStatus: 'verified',
    exclusionClear: true,
    credentialCount: 4,
    readiness_level: 'L2',
    readiness_status: 'ready_for_share',
    readiness_score: 91,
    gap_summary: [],
    methodology_version: '243.1',
    computed_at: '2026-03-05T00:00:00.000Z',
    trustBand: 'L2',
    trustScore: 91,
    facts: [],
    gaps: [],
    computedAt: '2026-03-05T00:00:00.000Z',
  });
}

describe('passport routes', () => {
  beforeEach(() => {
    prismaMock.provider.findFirst.mockReset();
    prismaMock.decisionCapsule.findMany.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.verificationArtifact.findFirst.mockReset();
    trustStateMock.mockReset();
  });

  it('rejects invalid NPIs across passport endpoints', async () => {
    const app = createApp();

    const passport = await invokeGetRoute(app, '/api/passport/:npi', {
      params: { npi: 'not-an-npi' },
    });
    const trust = await invokeGetRoute(app, '/api/passport/:npi/trust', {
      params: { npi: 'not-an-npi' },
    });

    expect(passport.statusCode).toBe(400);
    expect(passport.body).toEqual(expect.objectContaining({ error: 'invalid_npi' }));
    expect(trust.statusCode).toBe(400);
    expect(trust.body).toEqual(expect.objectContaining({ error: 'invalid_npi' }));
  });

  it('returns a privacy-layered public passport with only public credentials exposed', async () => {
    seedPassportData();

    const response = await invokeGetRoute(createApp(), '/api/passport/:npi', {
      params: { npi: '1234567890' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      npi: '1234567890',
      public: expect.objectContaining({
        name: 'Dr. Ada Lovelace',
        specialty: 'Internal Medicine',
        providerType: 'INDIVIDUAL',
        state: 'CA',
        trustBand: 'GREEN',
        readinessScore: 91,
        totalCredentials: 4,
        activeCredentials: 4,
        shareUrl: 'https://app.vitalcv.com/p/1234567890',
        embedUrl: 'https://app.vitalcv.com/api/passport/1234567890/embed.svg',
      }),
      meta: {
        methodology: '243.1',
        computedAt: '2026-03-05T00:00:00.000Z',
        passportVersion: '2.0',
      },
    }));

    const body = response.body as { credentials: Array<Record<string, unknown>> };
    expect(body.credentials).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'NPI_IDENTITY',
        name: 'NPI Identity',
        issuer: 'CMS NPPES',
        isPublic: true,
      }),
      expect.objectContaining({
        type: 'STATE_LICENSE',
        name: 'CA State License',
        issuer: 'California Medical Board',
        isPublic: true,
      }),
      expect.objectContaining({
        type: 'BOARD_CERTIFICATION',
        name: 'Internal Medicine Board Certification',
        issuer: 'American Board of Internal Medicine',
        isPublic: true,
      }),
    ]));
    expect(body.credentials).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'DEA_REGISTRATION',
      }),
    ]));
    expect(JSON.stringify(response.body)).not.toContain('DEA-SECRET-123');
  });

  it('prefers live NPPES identity fields over a stored provider stub name', async () => {
    seedPassportData({
      provider: {
        fullName: 'Dr. Sarah Chen',
        taxonomyCode: 'Internal Medicine',
        providerType: 'INDIVIDUAL',
        stateOfPractice: 'CA',
      },
      artifacts: [
        {
          id: 'artifact-npi',
          source: 'NPPES_API',
          status: 'ACTIVE',
          verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
          expiresAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          rawPayload: {
            enumeration_type: 'NPI-1',
            basic: {
              first_name: 'Ardalan',
              last_name: 'Enkeshafi',
            },
          },
        },
      ],
    });

    const response = await invokeGetRoute(createApp(), '/api/passport/:npi', {
      params: { npi: '1234567890' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      public: expect.objectContaining({
        name: 'Ardalan Enkeshafi',
      }),
    }));
  });

  it('returns 404 when cached trust state is unavailable', async () => {
    seedPassportData({ trustState: null });

    const response = await invokeGetRoute(createApp(), '/api/passport/:npi', {
      params: { npi: '1234567890' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual(expect.objectContaining({ error: 'passport_not_available' }));
  });

  it('returns a public trust summary for the passport', async () => {
    seedPassportData();

    const response = await invokeGetRoute(createApp(), '/api/passport/:npi/trust', {
      params: { npi: '1234567890' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      npi: '1234567890',
      trustBand: 'GREEN',
      readinessScore: 91,
      readinessStatus: 'ready_for_share',
      computedAt: '2026-03-05T00:00:00.000Z',
      shareUrl: 'https://app.vitalcv.com/p/1234567890',
    });
  });

  it('returns an inline SVG badge with cache headers', async () => {
    seedPassportData({
      provider: {
        fullName: 'Dr. <Ada> & Co',
        taxonomyCode: 'Internal Medicine',
        providerType: 'INDIVIDUAL',
        stateOfPractice: 'CA',
      },
      artifacts: [
        {
          id: 'artifact-npi',
          source: 'NPPES',
          status: 'ACTIVE',
          verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
          expiresAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          rawPayload: {
            provider_name: 'Dr. <Ada> & Co',
            practice_state: 'CA',
          },
        },
      ],
    });

    const response = await invokeGetRoute(createApp(), '/api/passport/:npi/embed.svg', {
      params: { npi: '1234567890' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/svg+xml');
    expect(response.headers['cache-control']).toBe('public, max-age=3600');
    expect(response.text).toContain('Dr. &lt;Ada&gt; &amp; Co');
    expect(response.text).toContain('#10b981');
    expect(response.text).toContain('Verified by VitalCV');
  });

  it('returns a JSON-LD clinician passport card', async () => {
    seedPassportData();

    const response = await invokeGetRoute(createApp(), '/api/passport/:npi/card.json', {
      params: { npi: '1234567890' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/ld+json');
    expect(response.body).toEqual({
      '@context': 'https://vitalcv.com/schema/v1',
      '@type': 'ClinicianPassport',
      npi: '1234567890',
      name: 'Dr. Ada Lovelace',
      trustBand: 'GREEN',
      readinessScore: 91,
      shareUrl: 'https://app.vitalcv.com/p/1234567890',
      badgeUrl: 'https://app.vitalcv.com/api/passport/1234567890/embed.svg',
      verifiedAt: '2026-03-05T00:00:00.000Z',
      issuer: 'VitalCV',
    });
  });
});
