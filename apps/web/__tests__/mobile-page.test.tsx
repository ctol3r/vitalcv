import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('/mobile page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.test';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mobile';
  });

  it('renders live mobile role data with application status and provider identity', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'ada@example.com' },
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'http://backend.test/api/me/workspaces') {
        return new Response(JSON.stringify({
          personProfile: {
            npi: '1234567890',
            firstName: 'Ada',
            lastName: 'Lovelace',
            specialty: 'Psychiatry',
            stateOfPractice: 'CA',
            completeness: 96,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url === 'http://backend.test/api/clinician/applications') {
        return new Response(JSON.stringify([
          {
            id: 'app_1',
            opportunityId: 'opp_2',
            status: 'PENDING',
            createdAt: '2026-03-20T13:00:00.000Z',
            updatedAt: '2026-03-20T13:00:00.000Z',
            employer: { organizationId: 'org_2', name: 'MindBridge Health' },
            opportunity: {
              id: 'opp_2',
              organizationId: 'org_2',
              organizationName: 'MindBridge Health',
              title: 'Telepsychiatry Director',
              specialty: 'Psychiatry',
              hiringType: 'telehealth',
              state: 'CA',
              payRange: '$280k-$310k',
              status: 'ACTIVE',
            },
            readiness: {
              readinessScore: 91,
              readinessLevel: 'L3',
              readinessStatus: 'Ready to credential',
              gapSummary: [],
              keyCredentials: ['State license'],
              trustSignals: ['NPI identity verified'],
            },
          },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url === 'http://backend.test/api/opportunities?limit=24') {
        return new Response(JSON.stringify({
          opportunities: [
            {
              id: 'opp_1',
              organizationId: 'org_1',
              organizationName: 'Bay Area Cardiac Group',
              organizationSlug: 'bay-area-cardiac-group',
              title: 'Cardiology Lead',
              specialty: 'Cardiology',
              hiringType: 'perm',
              state: 'CA',
              payRange: '$320k-$360k',
              requirementLevel: 'L3',
              description: null,
              remote: false,
              status: 'ACTIVE',
              createdAt: '2026-03-18T12:00:00.000Z',
            },
            {
              id: 'opp_2',
              organizationId: 'org_2',
              organizationName: 'MindBridge Health',
              organizationSlug: 'mindbridge-health',
              title: 'Telepsychiatry Director',
              specialty: 'Psychiatry',
              hiringType: 'telehealth',
              state: 'CA',
              payRange: '$280k-$310k',
              requirementLevel: 'L2',
              description: null,
              remote: true,
              status: 'ACTIVE',
              createdAt: '2026-03-20T12:00:00.000Z',
            },
          ],
          total: 2,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url === 'http://backend.test/api/trust-state/1234567890') {
        return new Response(JSON.stringify({
          npi: '1234567890',
          readiness_level: 'L3',
          readiness_score: 91,
          readiness_status: 'Ready to credential',
          trustBand: 'L3',
          trustScore: 91,
          gap_summary: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url === 'http://backend.test/api/matcha/opportunities/1234567890') {
        return new Response(JSON.stringify({
          npi: '1234567890',
          clinicianName: 'Ada Lovelace',
          specialty: 'Psychiatry',
          state: 'CA',
          profileCompleteness: {
            level: 'high',
            missingForHigherMatches: ['DEA registration'],
          },
          matches: [
            {
              opportunityId: 'opp_2',
              band: 'CLEAR',
              score: 98,
              blockers: [],
              fitReasons: ['Telehealth ready'],
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: MobilePage } = await import('../app/_archive/mobile/page');
    const markup = renderToStaticMarkup(await MobilePage({
      searchParams: Promise.resolve({ tab: 'roles' }),
    }));

    expect(markup).toContain('Ada');
    expect(markup).toContain('Trust Workspace Active');
    expect(markup).toContain('Telepsychiatry Director');
    expect(markup).toContain('MindBridge Health');
    expect(markup).toContain('Submitted');
  }, 15000);
});
