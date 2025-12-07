import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../../../../backend/src/middleware/accessGuards', () => ({
  loadUserSession: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../../../../services/timeline/getClinicianTimeline', () => ({
  loadClinicianWithUser: jest.fn(),
  buildClinicianTimeline: jest.fn(),
  getTimelineSummary: jest.fn(),
}));

const timelineService = jest.requireMock('../../../../../../services/timeline/getClinicianTimeline');

const mockClinician = {
  id: 'clin-1',
  npi: '1234567890',
  userId: 'user-1',
  user: {
    id: 'user-1',
    did: 'did:example:123',
    roles: ['CLINICIAN'],
    name: 'Dr. Example',
  },
};

const mockTimeline = {
  events: [
    {
      id: 'evt-1',
      phase: 'identity',
      type: 'CLAIM_L1_OK',
      title: 'Level 1 complete',
      timestamp: new Date('2025-01-01T00:00:00Z'),
      status: 'completed',
      source: 'audit_event',
    },
  ],
  phaseGroups: [
    {
      phase: 'identity',
      events: [
        {
          id: 'evt-1',
          phase: 'identity',
          type: 'CLAIM_L1_OK',
          title: 'Level 1 complete',
          timestamp: new Date('2025-01-01T00:00:00Z'),
          status: 'completed',
          source: 'audit_event',
        },
      ],
    },
  ],
};

const { loadClinicianWithUser, buildClinicianTimeline, getTimelineSummary } = timelineService;

const router = require('../list').default;

function getRouteHandler(path: string) {
  const layer = router.stack.find((layer: any) => layer.route?.path === path);
  return layer?.route?.stack?.[0]?.handle;
}

const listHandler = getRouteHandler('/:clinicianId/timeline');
const summaryHandler = getRouteHandler('/:clinicianId/timeline/summary');

const mockRequest = (overrides: Record<string, any> = {}) => ({
  params: { clinicianId: 'clin-1', ...(overrides.params ?? {}) },
  query: overrides.query ?? {},
  user: overrides.user ?? { id: 'user-1', roles: ['CLINICIAN'] },
});

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Clinician timeline routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 404 when clinician not found', async () => {
    loadClinicianWithUser.mockResolvedValueOnce(null);
    const req = mockRequest();
    const res = mockResponse();

    await listHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user lacks access', async () => {
    loadClinicianWithUser.mockResolvedValueOnce(mockClinician);
    const req = mockRequest({ user: { id: 'other-user', roles: ['CLINICIAN'] } });
    const res = mockResponse();

    await listHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns serialized timeline response', async () => {
    loadClinicianWithUser.mockResolvedValueOnce(mockClinician);
    buildClinicianTimeline.mockResolvedValueOnce(mockTimeline);
    const req = mockRequest();
    const res = mockResponse();

    await listHandler(req, res);

    expect(buildClinicianTimeline).toHaveBeenCalledWith({
      clinician: mockClinician,
      sortDirection: 'desc',
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        clinicianId: 'clin-1',
        events: expect.arrayContaining([
          expect.objectContaining({
            id: 'evt-1',
            phase: 'identity',
            timestamp: '2025-01-01T00:00:00.000Z',
          }),
        ]),
        phases: expect.arrayContaining([
          expect.objectContaining({ phase: 'identity' }),
        ]),
      })
    );
  });

  it('returns timeline summary', async () => {
    loadClinicianWithUser.mockResolvedValueOnce(mockClinician);
    getTimelineSummary.mockResolvedValueOnce({ clinicianId: 'clin-1', npi: '1234567890' });
    const req = mockRequest();
    const res = mockResponse();

    await summaryHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: { clinicianId: 'clin-1', npi: '1234567890' },
      })
    );
  });
});


