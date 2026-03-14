import express from 'express';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      upsert: jest.fn(),
    },
    personProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('../../../services/trust/trustStateEngine', () => ({
  getCachedTrustState: jest.fn(),
}));

jest.mock('../../../services/decision/capsuleEngine', () => ({
  capsuleEngine: {
    createDecisionCapsule: jest.fn(),
  },
}));

jest.mock('../../../services/matcha/liveMatchaService', () => ({
  getLiveMatchesForNpi: jest.fn().mockResolvedValue({ opportunities: [] }),
  scoreOpportunityForNpi: jest.fn(),
}));

jest.mock('../../../services/matcha/mockData', () => ({
  getMockProfile: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../../services/matcha/opportunityRegistry', () => {
  const opportunities = [
    {
      id: 'opp-green',
      title: 'Emergency Medicine Locums',
      organization: 'Garden State Hospital',
      organizationId: 'org-green',
      employerSlug: 'garden-state-hospital',
      facility: 'Garden State Hospital',
      location: 'Newark, NJ',
      state: 'NJ',
      specialty: 'Emergency Medicine',
      hiringType: 'locums',
      employerType: 'hospital',
      startUrgency: 'immediate',
      urgency: 'immediate',
      payRange: '$250-$300/hr',
      payMin: 250,
      payMax: 300,
      premiumRate: 320,
      remote: false,
      requirements: [
        { key: 'state_license', label: 'NJ Medical License', level: 'L3', priority: 'required', state: 'NJ' },
      ],
      minimumTrustBand: 'L2',
      credentialRequirements: ['NJ Medical License'],
      postedAt: '2026-03-10T00:00:00Z',
      active: true,
      tags: ['emergency-medicine', 'NJ'],
    },
    {
      id: 'opp-yellow',
      title: 'Internal Medicine Perm',
      organization: 'Hudson Medical Group',
      organizationId: 'org-yellow',
      employerSlug: 'hudson-medical-group',
      facility: 'Hudson Medical Group',
      location: 'Jersey City, NJ',
      state: 'NJ',
      specialty: 'Internal Medicine',
      hiringType: 'perm',
      employerType: 'practice',
      startUrgency: 'within_month',
      urgency: 'within_30_days',
      payRange: '$180-$220/hr',
      payMin: 180,
      payMax: 220,
      premiumRate: 225,
      remote: false,
      requirements: [
        { key: 'state_license', label: 'NJ Medical License', level: 'L2', priority: 'required', state: 'NJ' },
      ],
      minimumTrustBand: 'L2',
      credentialRequirements: ['NJ Medical License'],
      postedAt: '2026-03-10T00:00:00Z',
      active: true,
      tags: ['internal-medicine', 'NJ'],
    },
  ];

  return {
    __esModule: true,
    OPPORTUNITIES: opportunities,
    getOpportunity: jest.fn((id: string) => opportunities.find((opportunity) => opportunity.id === id)),
    listActiveOpportunities: jest.fn((filters?: { specialty?: string; state?: string }) => opportunities.filter((opportunity) => {
      if (filters?.specialty && opportunity.specialty !== filters.specialty) {
        return false;
      }
      if (filters?.state && opportunity.state !== filters.state) {
        return false;
      }
      return opportunity.active;
    })),
    createOpportunity: jest.fn(),
  };
});

jest.mock('../../../services/matcha/matchaEngine', () => ({
  scoreOpportunity: jest.fn(),
  buildDecisionAudit: jest.fn((npi: string, opportunity: { id: string }, explanation: {
    matchBand: string;
    matchScore: number;
    blockers: Array<{ label: string }>;
  }) => ({
    decisionId: `${npi}-${opportunity.id}`,
    npi,
    opportunityId: opportunity.id,
    band: explanation.matchBand,
    score: explanation.matchScore,
    blockers: explanation.blockers.map((blocker) => blocker.label),
    decidedAt: '2026-03-15T00:00:00Z',
    version: '187.1',
  })),
  checkInstantOfferEligibility: jest.fn((npi: string, opportunity: { id: string }, explanation: {
    instantOfferEligible: boolean;
    matchScore: number;
  }) => ({
    npi,
    opportunityId: opportunity.id,
    eligible: explanation.instantOfferEligible,
    score: explanation.matchScore,
    reason: explanation.instantOfferEligible ? 'eligible' : 'not eligible',
    checkedAt: '2026-03-15T00:00:00Z',
  })),
}));

import prisma from '../../../graphql/prisma_client';
import { capsuleEngine } from '../../../services/decision/capsuleEngine';
import { getMockProfile } from '../../../services/matcha/mockData';
import {
  getAvailability,
  searchAvailablePool,
  setAvailability,
} from '../availabilityRegistry';
import { scoreOpportunity } from '../../../services/matcha/matchaEngine';
import { registerMatchaRoutes } from '../../../routes/matcha';
import { getCachedTrustState } from '../../../services/trust/trustStateEngine';

type TrustState = {
  npi: string;
  identityVerified: boolean;
  licensureStatus: 'verified' | 'pending' | 'expired' | 'unknown';
  exclusionClear: boolean;
  exclusionStatus?: 'CLEAR' | 'EXCLUDED' | 'UNKNOWN';
  credentialCount: number;
  readiness_level: 'L0' | 'L1' | 'L2' | 'L3';
  readiness_status: string;
  readiness_score: number;
  gap_summary: string[];
  methodology_version: string;
  computed_at: string;
  trustBand: 'L0' | 'L1' | 'L2' | 'L3';
  trustScore: number;
  facts: Array<{
    factType: string;
    source: string;
    status: string;
    verifiedAt?: string;
    expiresAt?: string;
    details?: string;
  }>;
  gaps: string[];
  computedAt: string;
};

const prismaMock = prisma as unknown as {
  user: {
    upsert: jest.Mock;
  };
  personProfile: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    updateMany: jest.Mock;
  };
  $executeRawUnsafe: jest.Mock;
  $queryRawUnsafe: jest.Mock;
};

const trustStateMock = {
  getCachedTrustState: getCachedTrustState as jest.Mock,
};

const capsuleEngineMock = {
  createDecisionCapsule: capsuleEngine.createDecisionCapsule as jest.Mock,
};

const matchaEngineMock = {
  scoreOpportunity: scoreOpportunity as jest.Mock,
};

const mockDataMock = {
  getMockProfile: getMockProfile as jest.Mock,
};

function makeTrustState(overrides: Partial<TrustState> = {}): TrustState {
  return {
    npi: '1234567890',
    identityVerified: true,
    licensureStatus: 'verified',
    exclusionClear: true,
    exclusionStatus: 'CLEAR',
    credentialCount: 3,
    readiness_level: 'L3',
    readiness_status: 'Ready to credential — all evidence verified',
    readiness_score: 92,
    gap_summary: [],
    methodology_version: '243.1',
    computed_at: '2026-03-15T00:00:00Z',
    trustBand: 'L3',
    trustScore: 92,
    facts: [
      { factType: 'IdentityClaim', source: 'CMS NPPES', status: 'ACTIVE' },
      { factType: 'License', source: 'STATE_BOARD', status: 'VERIFIED', details: 'NJ Medical Board · NJ' },
      { factType: 'BoardCertification', source: 'ABMS', status: 'VERIFIED', details: 'Emergency Medicine Board Certification' },
    ],
    gaps: [],
    computedAt: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

function makeExplanation(overrides: Partial<{
  matchBand: 'CLEAR' | 'NEAR_CLEAR' | 'PARTIAL' | 'INELIGIBLE';
  matchScore: number;
  blockers: Array<{ label: string }>;
  instantOfferEligible: boolean;
}> = {}) {
  return {
    matchBand: overrides.matchBand ?? 'CLEAR',
    matchScore: overrides.matchScore ?? 95,
    confidence: 0.9,
    fitReasons: [],
    blockers: overrides.blockers ?? [],
    missingCredentials: [],
    instantOfferEligible: overrides.instantOfferEligible ?? false,
    generatedAt: '2026-03-15T00:00:00Z',
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  registerMatchaRoutes(app);
  return app;
}

async function invokeRoute(
  app: express.Express,
  method: 'get' | 'post',
  routePath: string,
  input: {
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: unknown }> {
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
    candidate.route?.path === routePath
    && candidate.route.methods[method]
  ));

  if (!layer?.route?.stack?.[0]) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  }

  const handler = layer.route.stack[0].handle;

  return new Promise((resolve, reject) => {
    const req = {
      body: input.body ?? {},
      params: input.params ?? {},
      query: input.query ?? {},
      headers: input.headers ?? {},
    } as unknown as express.Request;

    let statusCode = 200;
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

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

describe('marketplace wave', () => {
  beforeEach(() => {
    prismaMock.user.upsert.mockReset();
    prismaMock.personProfile.findUnique.mockReset();
    prismaMock.personProfile.upsert.mockReset();
    prismaMock.personProfile.updateMany.mockReset();
    prismaMock.$executeRawUnsafe.mockReset();
    prismaMock.$queryRawUnsafe.mockReset();
    trustStateMock.getCachedTrustState.mockReset();
    capsuleEngineMock.createDecisionCapsule.mockReset();
    matchaEngineMock.scoreOpportunity.mockReset();
    mockDataMock.getMockProfile.mockReset();

    prismaMock.personProfile.findUnique.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      specialty: 'Emergency Medicine',
      stateOfPractice: 'NJ',
    });
    prismaMock.personProfile.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.personProfile.upsert.mockResolvedValue({ id: 'person-1' });
    prismaMock.user.upsert.mockResolvedValue({ id: 'user-1' });
    prismaMock.$executeRawUnsafe.mockResolvedValue(1);
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);
    capsuleEngineMock.createDecisionCapsule.mockResolvedValue({ id: 'capsule-1' });
  });

  it('setAvailability + getAvailability round-trip', async () => {
    let storedAvailability: Record<string, unknown> | null = null;

    prismaMock.personProfile.findUnique.mockResolvedValueOnce(null);
    prismaMock.$executeRawUnsafe.mockImplementation(async (_sql: string, patch?: string) => {
      if (typeof patch === 'string') {
        storedAvailability = JSON.parse(patch).availability as Record<string, unknown>;
      }
      return 1;
    });
    prismaMock.$queryRawUnsafe.mockImplementation(async () => storedAvailability
      ? [{
        npi: storedAvailability.npi,
        specialty: storedAvailability.specialty,
        state_of_practice: 'NJ',
        metadata: { availability: storedAvailability },
      }]
      : []);

    const saved = await setAvailability('1234567890', {
      specialty: 'Emergency Medicine',
      locations: ['NJ', 'NY'],
      availableFrom: '2026-03-20',
      urgency: 'immediate',
      rateFloor: 250,
      trustBand: 'L3',
    });
    const loaded = await getAvailability('1234567890');

    expect(saved).toEqual(loaded);
    expect(prismaMock.user.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.personProfile.upsert).toHaveBeenCalledTimes(1);
  });

  it('searchAvailablePool filters by specialty', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValue([
      {
        npi: '1234567890',
        specialty: 'Emergency Medicine',
        state_of_practice: 'NJ',
        metadata: {
          availability: {
            npi: '1234567890',
            specialty: 'Emergency Medicine',
            locations: ['NJ'],
            availableFrom: '2026-03-20T00:00:00.000Z',
            urgency: 'immediate',
            updatedAt: '2026-03-15T00:00:00.000Z',
          },
        },
      },
      {
        npi: '9999999999',
        specialty: 'Cardiology',
        state_of_practice: 'NJ',
        metadata: {
          availability: {
            npi: '9999999999',
            specialty: 'Cardiology',
            locations: ['NJ'],
            availableFrom: '2026-03-20T00:00:00.000Z',
            urgency: 'within_30_days',
            updatedAt: '2026-03-15T00:00:00.000Z',
          },
        },
      },
    ]);
    trustStateMock.getCachedTrustState
      .mockResolvedValueOnce(makeTrustState({ npi: '1234567890', readiness_level: 'L3' }))
      .mockResolvedValueOnce(makeTrustState({ npi: '9999999999', readiness_level: 'L2' }));

    const pool = await searchAvailablePool({ specialty: 'Emergency Medicine' });

    expect(pool).toHaveLength(1);
    expect(pool[0]).toEqual(expect.objectContaining({
      npi: '1234567890',
      specialty: 'Emergency Medicine',
      trustBand: 'L3',
    }));
  });

  it('POST /api/marketplace/match returns ranked matches', async () => {
    trustStateMock.getCachedTrustState.mockResolvedValue(
      makeTrustState({
        readiness_level: 'L2',
        trustBand: 'L2',
        readiness_score: 72,
        trustScore: 72,
      }),
    );
    matchaEngineMock.scoreOpportunity.mockImplementation((_clinician, _intent, opportunity: { id: string }) => (
      opportunity.id === 'opp-green'
        ? makeExplanation({ matchBand: 'NEAR_CLEAR', matchScore: 78 })
        : makeExplanation({ matchBand: 'PARTIAL', matchScore: 41, blockers: [{ label: 'Board certification gap' }] })
    ));

    const response = await invokeRoute(createApp(), 'post', '/api/marketplace/match', {
      headers: { 'x-clerk-user-id': 'clerk-user-1' },
      body: {
        npi: '1234567890',
        specialty: 'Emergency Medicine',
        state: 'NJ',
      },
    });
    const payload = response.body as { matches: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.matches).toHaveLength(1);
    expect(payload.matches[0]).toEqual(expect.objectContaining({
      opportunityId: 'opp-green',
      matchScore: 78,
      matchBand: 'YELLOW',
      capsuleCreated: false,
    }));
  });

  it('POST /api/marketplace/match fires capsule at GREEN match', async () => {
    trustStateMock.getCachedTrustState.mockResolvedValue(makeTrustState());
    matchaEngineMock.scoreOpportunity.mockImplementation((_clinician, _intent, opportunity: { id: string }) => (
      opportunity.id === 'opp-green'
        ? makeExplanation({ matchBand: 'CLEAR', matchScore: 96 })
        : makeExplanation({ matchBand: 'PARTIAL', matchScore: 22, blockers: [{ label: 'Coverage gap' }] })
    ));

    const response = await invokeRoute(createApp(), 'post', '/api/marketplace/match', {
      headers: { 'x-clerk-user-id': 'clerk-user-1' },
      body: { npi: '1234567890', state: 'NJ' },
    });
    const payload = response.body as { matches: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.matches[0]).toEqual(expect.objectContaining({
      opportunityId: 'opp-green',
      matchBand: 'GREEN',
      capsuleCreated: true,
    }));
    expect(capsuleEngineMock.createDecisionCapsule).toHaveBeenCalledWith(expect.objectContaining({
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      sourceReferenceId: 'opp-green',
    }));
  });

  it('GET /api/marketplace/pool returns credential-ready pool', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValue([
      {
        npi: '1234567890',
        specialty: 'Emergency Medicine',
        state_of_practice: 'NJ',
        metadata: {
          availability: {
            npi: '1234567890',
            specialty: 'Emergency Medicine',
            locations: ['NJ'],
            availableFrom: '2026-03-20T00:00:00.000Z',
            urgency: 'immediate',
            updatedAt: '2026-03-15T00:00:00.000Z',
          },
        },
      },
      {
        npi: '9999999999',
        specialty: 'Emergency Medicine',
        state_of_practice: 'NY',
        metadata: {
          availability: {
            npi: '9999999999',
            specialty: 'Emergency Medicine',
            locations: ['NY'],
            availableFrom: '2026-03-25T00:00:00.000Z',
            urgency: 'within_30_days',
            updatedAt: '2026-03-15T00:00:00.000Z',
          },
        },
      },
    ]);
    trustStateMock.getCachedTrustState.mockImplementation(async (npi: string) => (
      npi === '1234567890'
        ? makeTrustState({ npi, readiness_level: 'L3', trustBand: 'L3', readiness_score: 95, trustScore: 95 })
        : makeTrustState({ npi, readiness_level: 'L2', trustBand: 'L2', readiness_score: 70, trustScore: 70 })
    ));

    const response = await invokeRoute(createApp(), 'get', '/api/marketplace/pool', {
      headers: { 'x-clerk-user-id': 'clerk-user-1' },
      query: {
        specialty: 'Emergency Medicine',
        state: 'NJ',
        trustBand: 'L3',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      total: 1,
      pool: [
        {
          npi: '1234567890',
          specialty: 'Emergency Medicine',
          locations: ['NJ'],
          trustBand: 'L3',
          readinessScore: 95,
          availableFrom: '2026-03-20T00:00:00.000Z',
          urgency: 'immediate',
          passportUrl: 'https://vitalcv.com/p/1234567890',
        },
      ],
    });
  });

  it('getMockProfile is no longer called in instant-offer route', async () => {
    trustStateMock.getCachedTrustState.mockResolvedValue(makeTrustState());
    matchaEngineMock.scoreOpportunity.mockReturnValue(
      makeExplanation({ matchBand: 'CLEAR', matchScore: 93, instantOfferEligible: true }),
    );

    const response = await invokeRoute(createApp(), 'get', '/api/matcha/instant-offer/:npi/:opportunityId', {
      headers: { 'x-clerk-user-id': 'clerk-user-1' },
      params: {
        npi: '1234567890',
        opportunityId: 'opp-green',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      npi: '1234567890',
      opportunityId: 'opp-green',
      eligible: true,
      band: 'GREEN',
      capsuleCreated: true,
    }));
    expect(mockDataMock.getMockProfile).not.toHaveBeenCalled();
  });
});
