import express from 'express';
import request from 'supertest';

jest.mock('../src/services/entity/passportService', () => ({
  buildPassport: jest.fn(),
}));

jest.mock('../src/services/passport/npiPassportContract', () => ({
  buildPassportDataByNpi: jest.fn(),
}));

jest.mock('../src/services/passport/passportPdf', () => ({
  renderPassportPdf: jest.fn(),
}));

import { buildPassport } from '../src/services/entity/passportService';
import { buildPassportDataByNpi } from '../src/services/passport/npiPassportContract';
import { renderPassportPdf } from '../src/services/passport/passportPdf';
import { registerPassportEntityRoutes } from '../src/routes/passportEntity';

const buildPassportMock = buildPassport as jest.MockedFunction<typeof buildPassport>;
const buildPassportDataByNpiMock = buildPassportDataByNpi as jest.MockedFunction<typeof buildPassportDataByNpi>;
const renderPassportPdfMock = renderPassportPdf as jest.MockedFunction<typeof renderPassportPdf>;

function createApp() {
  const app = express();
  app.use(express.json());
  registerPassportEntityRoutes(app);
  app.use((
    err: { status?: number; message?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Unknown error' });
  });
  return app;
}

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      entityId: 'entity-1',
      displayName: 'Ada Lovelace',
      npi: '1234567890',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
    },
    authority: {
      credentials: [],
      summary: {
        active: 0,
        expired: 0,
        stale: 0,
        missing: [],
      },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.',
      negativeFindings: [],
    },
    readiness: {
      status: 'READY',
      score: 92,
      readiness_score: 92,
      level: 'L3',
      blockers: [],
      gaps: [],
      estimatedStartDays: 3,
      nextActions: [],
    },
    sources: {
      checked: ['NPPES_API'],
      lastFetch: {
        NPPES_API: '2026-04-06T12:00:00.000Z',
      },
    },
    sourceCoverage: {
      checks: [],
      summary: {
        checked: ['NPPES_API'],
        stale: [],
        pending: [],
        gated: [],
        unavailable: [],
      },
    },
    truth: {
      identity: { status: 'VERIFIED', reason: 'Identity confirmed' },
      safety: { status: 'VERIFIED', reason: 'Safety clear' },
      authority: { status: 'VERIFIED', reason: 'Authority verified' },
      eligibility: { status: 'VERIFIED', reason: 'Eligibility verified' },
      overall: { status: 'VERIFIED', reason: 'Decision-grade trust coverage available' },
    },
    trustPosture: {
      band: 'L3',
      bandLabel: 'Decision grade',
      score: 92,
      dimensions: [],
      freshness: {
        state: 'current',
        label: 'Current',
        items: [],
      },
      safeToRelyOnNow: ['Identity confirmed via CMS NPPES.'],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    decisionPosture: {
      status: 'READY',
      headline: 'Decision-grade trust coverage available now.',
      proven: [],
      missing: [],
      blockers: [],
      freshness: {
        state: 'current',
        label: 'Current',
        items: [],
      },
      nextAction: 'Accept VitalCV Authority.',
    },
    lastCheckedAt: '2026-04-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('passport entity pdf routes', () => {
  beforeEach(() => {
    buildPassportMock.mockReset();
    buildPassportDataByNpiMock.mockReset();
    renderPassportPdfMock.mockReset();
  });

  it('renders an entity passport PDF export', async () => {
    buildPassportMock.mockResolvedValue(buildPassportPayload() as never);
    renderPassportPdfMock.mockResolvedValue(Buffer.from('%PDF-entity'));

    const response = await request(createApp())
      .get('/api/passport/entity/550e8400-e29b-41d4-a716-446655440000/pdf')
      .expect(200);

    expect(renderPassportPdfMock).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 'entity-1',
    }));
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('vitalcv-passport-1234567890.pdf');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.toString('utf8')).toBe('%PDF-entity');
  });

  it('renders an NPI passport PDF export', async () => {
    buildPassportDataByNpiMock.mockResolvedValue(buildPassportPayload() as never);
    renderPassportPdfMock.mockResolvedValue(Buffer.from('%PDF-npi'));

    const response = await request(createApp())
      .get('/api/passport/npi/1234567890/pdf')
      .expect(200);

    expect(buildPassportDataByNpiMock).toHaveBeenCalledWith('1234567890');
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('vitalcv-passport-1234567890.pdf');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.toString('utf8')).toBe('%PDF-npi');
  });

  it('fails closed when the entity passport cannot be built', async () => {
    buildPassportMock.mockResolvedValue(null);

    const response = await request(createApp())
      .get('/api/passport/entity/550e8400-e29b-41d4-a716-446655440000/pdf')
      .expect(404);

    expect(response.body).toEqual({
      error: 'Entity not found.',
    });
    expect(renderPassportPdfMock).not.toHaveBeenCalled();
  });
});
