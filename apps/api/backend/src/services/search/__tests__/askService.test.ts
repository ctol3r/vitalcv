jest.mock('../searchIndex', () => ({
  querySearch: jest.fn(),
}));

jest.mock('../../employers/employerService', () => ({
  getEmployerBySlug: jest.fn(),
}));

jest.mock('../../matcha/opportunityRegistry', () => ({
  getOpportunity: jest.fn(),
}));

jest.mock('../../audit/auditService', () => ({
  emitAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
  emitAuditEvent: jest.fn(),
  createTraceId: jest.fn(() => 'trace-123'),
}));

jest.mock('../../../tools/tracing', () => ({
  withToolSpan: jest.fn((_options, invoke: () => Promise<unknown>) => invoke()),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { emitAnalyticsEvent, emitAuditEvent } from '../../audit/auditService';
import { getEmployerBySlug } from '../../employers/employerService';
import { getOpportunity } from '../../matcha/opportunityRegistry';
import { querySearch } from '../searchIndex';
import { ask } from '../askService';

const querySearchMock = querySearch as jest.MockedFunction<typeof querySearch>;
const getEmployerBySlugMock = getEmployerBySlug as jest.MockedFunction<typeof getEmployerBySlug>;
const getOpportunityMock = getOpportunity as jest.MockedFunction<typeof getOpportunity>;
const emitAnalyticsEventMock = emitAnalyticsEvent as jest.MockedFunction<typeof emitAnalyticsEvent>;
const emitAuditEventMock = emitAuditEvent as jest.MockedFunction<typeof emitAuditEvent>;

describe('ask', () => {
  beforeEach(() => {
    querySearchMock.mockReset();
    getEmployerBySlugMock.mockReset();
    getOpportunityMock.mockReset();
    emitAnalyticsEventMock.mockClear();
    emitAuditEventMock.mockClear();
  });

  it('returns ANSWERED only when source-backed citations survive retrieval', async () => {
    querySearchMock.mockResolvedValue({
      query: 'What does Kaiser require?',
      total: 2,
      durationMs: 12,
      sources: ['EMPLOYER_PROFILE', 'TRUST_STATE_SUMMARY'],
      results: [
        {
          id: 'employer:kaiser',
          type: 'EMPLOYER_PROFILE',
          title: 'Kaiser Permanente Northern California',
          snippet: 'Board certification, CA license, DEA, and privileging are required.',
          sourceUrl: '/employers/kaiser-permanente-northern-california',
          referenceId: 'kaiser-permanente-northern-california',
          metadata: { employerSlug: 'kaiser-permanente-northern-california' },
          score: 10,
          freshAt: '2026-03-01T00:00:00Z',
          freshnessStatus: 'FRESH',
          provenance: 'employer_profile',
        },
        {
          id: 'trust:opp-006',
          type: 'TRUST_STATE_SUMMARY',
          title: 'Trust readiness for Kaiser',
          snippet: 'Clear-to-start depends on active CA licensure and source-backed credential checks.',
          sourceUrl: '/employers/kaiser-permanente-northern-california',
          referenceId: 'trust:opp-006',
          metadata: { employerSlug: 'kaiser-permanente-northern-california' },
          score: 8,
          freshAt: '2026-03-01T00:00:00Z',
          freshnessStatus: 'FRESH',
          provenance: 'trust_state_derived',
        },
      ],
    });
    getEmployerBySlugMock.mockResolvedValue({
      id: 'org-1',
      slug: 'kaiser-permanente-northern-california',
      name: 'Kaiser Permanente Northern California',
      facilityType: 'Integrated Health System',
      tagline: 'Delivering total health.',
      specialties: ['Internal Medicine'],
      states: ['CA'],
      openRoles: 12,
      trustScore: 97,
      hiringStatus: 'ACTIVELY_HIRING',
      timeToStart: '4-8 weeks',
      verified: true,
      trustIndicators: ['Verified employer'],
      description: 'Employer description',
      hiringTypes: ['Perm'],
      timeToOnboard: '10-15 business days',
      clearToStartThreshold: 'CA license + board certification',
      payTransparency: false,
      payRange: null,
      requirements: [{ label: 'CA Medical License', level: 'L3' }],
      recentHires: 10,
      website: 'https://example.com',
      verifiedSince: '2024-01-01T00:00:00Z',
      overview: {
        description: 'Employer description',
        website: 'https://example.com',
        facilityType: 'Integrated Health System',
        states: ['CA'],
      },
      specialtiesHired: ['Internal Medicine'],
      requirementsSummary: 'CA license + board certification',
      startSpeed: '4-8 weeks',
      onboardingSpeed: '10-15 business days',
    });
    getOpportunityMock.mockReturnValue(undefined);

    const response = await ask({
      q: 'What does Kaiser require?',
      requestContext: {
        aclLevel: 'HOLDER',
        isAuthenticated: true,
        clerkUserId: 'user-1',
        organizationId: 'org-1',
        membershipRoles: ['HOLDER'],
        queryHash: 'query-hash-1',
      },
      context: {
        employerSlug: 'kaiser-permanente-northern-california',
        employerName: 'Kaiser Permanente Northern California',
      },
    });

    expect(response.status).toBe('ANSWERED');
    expect(response.sources).toHaveLength(2);
    expect(response.provenance.sourceCount).toBe(2);
    expect(response.traceId).toBe('trace-123');
    expect(response.suggestedActions.map((action) => action.label)).toContain('View Employer Profile');
    expect(JSON.stringify(emitAnalyticsEventMock.mock.calls)).not.toContain('What does Kaiser require?');
  });

  it('returns NO_RESULTS when no source-backed citations remain', async () => {
    querySearchMock.mockResolvedValue({
      query: 'Unknown employer',
      total: 0,
      durationMs: 5,
      sources: [],
      results: [],
    });
    getEmployerBySlugMock.mockResolvedValue(null);
    getOpportunityMock.mockReturnValue(undefined);

    const response = await ask({
      q: 'Unknown employer',
      requestContext: {
        aclLevel: 'PUBLIC',
        isAuthenticated: false,
        membershipRoles: ['PUBLIC'],
        queryHash: 'query-hash-2',
      },
    });

    expect(response.status).toBe('NO_RESULTS');
    expect(response.sources).toHaveLength(0);
    expect(emitAuditEventMock).toHaveBeenCalled();
  });
});
