import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPROVED_PUBLIC_WORDING,
  PROHIBITED_EMPLOYER_PUBLIC_STRINGS,
  PROHIBITED_PUBLIC_STRINGS,
  PUBLIC_WEDGE_ROUTE_TARGETS,
  findHrefByText,
} from './helpers/public-copy-guard';

const {
  fetchLaunchEmployerMock,
  fetchLaunchOpportunitiesMock,
} = vi.hoisted(() => ({
  fetchLaunchEmployerMock: vi.fn(),
  fetchLaunchOpportunitiesMock: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
	    div: ({
	      children,
	      animate: _animate,
	      initial: _initial,
	      transition: _transition,
	      viewport: _viewport,
	      whileHover: _whileHover,
	      whileInView: _whileInView,
	      whileTap: _whileTap,
	      ...props
	    }: React.HTMLAttributes<HTMLDivElement> & {
	      animate?: unknown;
	      initial?: unknown;
	      transition?: unknown;
	      viewport?: unknown;
	      whileHover?: unknown;
	      whileInView?: unknown;
	      whileTap?: unknown;
	    }) => <div {...props}>{children}</div>,
	  },
  useInView: () => true,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname ?? '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/useUxTelemetry', () => ({
  useUxTelemetry: () => ({ track: vi.fn() }),
}));

vi.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div>Theme toggle</div>,
}));

vi.mock('@/lib/telemetry/ux-tracker', () => ({
  trackUxEvent: vi.fn(),
}));

vi.mock('@/components/prequalify/PrequalifyTrigger', () => ({
  default: ({ label = 'Get Prequalified' }: { label?: string }) => (
    <a href="/onboarding">{label}</a>
  ),
}));

vi.mock('@/components/apply/ApplyWithVitalCV', () => ({
  ApplyWithVitalCV: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

vi.mock('@/lib/api', () => ({
  getBackendBase: () => 'http://backend.test',
  getPublicApiBase: () => 'https://api.vitalcv.test',
  getPublicApiHostLabel: () => 'api.vitalcv.test',
}));

vi.mock('@/components/developers/ApiKeyManager', () => ({
  ApiKeyManager: () => <div>API key manager</div>,
}));

vi.mock('@/components/developers/ApiSandbox', () => ({
  ApiSandbox: () => <div>API sandbox</div>,
}));

vi.mock('@/components/developers/ConformanceReport', () => ({
  ConformanceReport: () => <div>Conformance report</div>,
}));

vi.mock('@/components/developers/DropInSection', () => ({
  DropInSection: () => <div>Drop-in section</div>,
}));

vi.mock('@/components/developers/HealthStartDocs', () => ({
  HealthStartDocs: () => <div>HealthStart docs</div>,
}));

vi.mock('@/components/developers/SdkDocs', () => ({
  SdkDocs: () => <div>SDK docs</div>,
}));

vi.mock('@/components/developers/WebhookLog', () => ({
  WebhookLog: () => <div>Webhook log</div>,
}));

vi.mock('@/components/network/GatewayConnections', () => ({
  GatewayConnections: () => <div>Gateway connections</div>,
}));

vi.mock('@/lib/launch/marketplace', () => ({
  fetchLaunchEmployer: fetchLaunchEmployerMock,
  fetchLaunchOpportunities: fetchLaunchOpportunitiesMock,
}));

Object.assign(globalThis, { React });

const SAMPLE_TRUST_STATE = {
  npi: '1234567890',
  identityVerified: true,
  licensureStatus: 'verified',
  exclusionClear: true,
  exclusionStatus: 'CLEAR',
  credentialCount: 1,
  readiness_level: 'L2',
  readiness_status: 'Source-backed snapshot available',
  readiness_score: 88,
  gap_summary: [],
  methodology_version: 'm1',
  computed_at: '2026-03-26T16:05:00.000Z',
  facts: [
    {
      factType: 'PERSONAL_IDENTITY',
      source: 'CMS NPPES',
      status: 'checked',
      details: 'Ada Lovelace',
    },
    {
      factType: 'SPECIALTY',
      source: 'CMS NPPES',
      status: 'checked',
      details: 'Internal Medicine',
    },
  ],
  gaps: [],
} as const;

const SAMPLE_EMPLOYER_DIRECTORY = {
  employers: [
    {
      id: 'org_1',
      slug: 'sample-health',
      name: 'Sample Health',
      facilityType: 'Hospital system',
      tagline: 'Current regional care network with public role coverage.',
      specialties: ['ICU', 'Hospital Medicine'],
      states: ['CA', 'NV'],
      openRoles: 4,
      trustScore: 89,
      hiringStatus: 'HIRING_NOW',
      verified: true,
      trustIndicators: ['Current directory listing', 'Source-backed role requirements'],
    },
  ],
  total: 1,
} as const;

const SAMPLE_EMPLOYER_DETAIL = {
  id: 'org_1',
  slug: 'sample-health',
  name: 'Sample Health',
  facilityType: 'Hospital system',
  tagline: 'Current regional care network with public role coverage.',
  specialties: ['ICU', 'Hospital Medicine'],
  states: ['CA', 'NV'],
  openRoles: 4,
  trustScore: 89,
  hiringStatus: 'HIRING_NOW',
  verified: true,
  trustIndicators: ['Current directory listing', 'Source-backed role requirements'],
  description: 'This employer profile reflects the current directory entry and the public role feed attached to it.',
  timeToStart: '2-3 weeks',
  timeToOnboard: '5 business days',
  hiringTypes: ['Full-time', 'Locums'],
  requirements: [
    { label: 'Licensure', level: 'Current' },
    { label: 'NPI', level: 'Checked' },
  ],
  clearToStartThreshold: 'Current licensure, NPI identity, and review-ready packet context.',
  payTransparency: true,
  payRange: '$240k-$280k',
  recentHires: 6,
  website: 'https://example.org',
  verifiedSince: '2026-01-10T00:00:00.000Z',
} as const;

const SAMPLE_EMPLOYER_OPPORTUNITIES = {
  opportunities: [
    {
      id: 'opp_1',
      organizationId: 'org_1',
      organizationName: 'Sample Health',
      organizationSlug: 'sample-health',
      title: 'ICU Physician',
      specialty: 'ICU',
      hiringType: 'Full-time',
      state: 'CA',
      payRange: '$240k-$280k',
      requirementLevel: 'Current',
      description: 'Current ICU role from the public employer feed.',
      remote: false,
      status: 'OPEN',
      createdAt: '2026-03-20T00:00:00.000Z',
    },
  ],
  total: 1,
} as const;

function expectMarkupExcludes(markup: string, phrases: readonly string[]) {
  for (const phrase of phrases) {
    expect(markup).not.toContain(phrase);
  }
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('post-release truth cleanup', () => {
  it('keeps public nav and homepage language aligned with checked/preview wording', async () => {
    const [{ default: Navbar }, { HowItWorksSection }] = await Promise.all([
      import('../components/layout/Navbar'),
      import('../components/marketing/HomeSections'),
    ]);

    const navbarMarkup = renderToStaticMarkup(<Navbar />);
    const homeMarkup = renderToStaticMarkup(<HowItWorksSection />);

    expect(navbarMarkup).toContain('Check Readiness');
    expect(navbarMarkup).toContain('Explore Roles');
    expect(navbarMarkup).toContain('For Employers');
    expect(navbarMarkup).toContain('Developers');
    expectMarkupExcludes(navbarMarkup, ['Get Verified', 'Get Verified Free']);

    expect(homeMarkup).toContain('Source-backed readiness snapshot');
    expect(homeMarkup).toContain('Checked from source runs');
    expect(homeMarkup).toContain('Portable across employers');
    expect(homeMarkup).toContain(APPROVED_PUBLIC_WORDING.sourceBacked);
    expect(homeMarkup).toContain(APPROVED_PUBLIC_WORDING.checked);
    expectMarkupExcludes(homeMarkup, ['Primary sources verify you']);
  });

  it('keeps the readiness preview on checked and passport handoff language', async () => {
    const { ReadinessPreview } = await import('../components/hero/ReadinessPreview');

    const markup = renderToStaticMarkup(
      <ReadinessPreview
        npi="1234567890"
        realState={SAMPLE_TRUST_STATE}
        isDemo={false}
        visible
        onContinue={vi.fn()}
      />,
    );

    expect(markup).toContain('Identity checked');
    expect(markup).toContain('Checked in this run');
    expect(markup).toContain('Continue to passport');
    expect(markup).toContain('Source checks');
    expect(markup).toContain('Source-backed preview');
    expect(markup).toContain('Access required');
    expect(markup).toContain('Review required');
    expectMarkupExcludes(markup, ['Identity verified', 'Source verification']);
  });

  it('keeps explore hero copy and CTA routes aligned with the public wedge', async () => {
    const [{ default: ExplorePage, metadata: exploreMetadata }, { default: LabsPage }] = await Promise.all([
      import('../app/explore/page'),
      import('../app/labs/page'),
    ]);

    const exploreMarkup = renderToStaticMarkup(<ExplorePage />);
    const labsMarkup = renderToStaticMarkup(<LabsPage />);

    expect(exploreMetadata.description).toBe(
      'Trust-native clinical opportunities matched to your source-backed readiness snapshot. Know what is checked before you apply.',
    );
    expect(exploreMarkup).toContain('Clinical Opportunities.');
    expect(exploreMarkup).toContain('See roles where your readiness snapshot may apply');
    expect(exploreMarkup).toContain('Check Readiness Free');
    expect(findHrefByText(exploreMarkup, 'Check Readiness Free')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.explorePrimary);
    expect(findHrefByText(exploreMarkup, 'Ask about a role')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.exploreSecondary);
    expectMarkupExcludes(exploreMarkup, PROHIBITED_PUBLIC_STRINGS);

    expect(labsMarkup).toContain('source-backed readiness snapshot');
    expect(labsMarkup).not.toContain('verified readiness snapshot');
  });

  it('renders interview and review entry copy without unsupported public-share promises', async () => {
    const [{ default: InterviewPage }, { default: ReviewLandingPage }] = await Promise.all([
      import('../app/interview/page'),
      import('../app/review/page'),
    ]);

    const interviewMarkup = renderToStaticMarkup(await InterviewPage({
      searchParams: Promise.resolve({}),
    }));
    const reviewMarkup = renderToStaticMarkup(<ReviewLandingPage />);

    expect(interviewMarkup).toContain('homepage NPI lookup');
    expect(findHrefByText(interviewMarkup, 'Start with NPI lookup')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.interviewBlocked);
    expectMarkupExcludes(interviewMarkup, [
      'real verified readiness',
      'verified readiness',
      'signed link',
      'expires in 24h',
      'no account needed',
    ]);

    expect(reviewMarkup).toContain('Open a shared passport review');
    expect(reviewMarkup).toContain('share when a real passport exists');
    expect(findHrefByText(reviewMarkup, 'Start with NPI lookup')).toBe('/');
    expect(findHrefByText(reviewMarkup, 'View passport')).toBe('/passport');
  }, 20000);

  it('keeps developers and docs pages on current/preview wording', async () => {
    const [{ default: DeveloperPortalPage, metadata: developerMetadata }, { default: DocsPage, metadata: docsMetadata }] = await Promise.all([
      import('../app/developers/page'),
      import('../app/docs/page'),
    ]);

    const developerMarkup = renderToStaticMarkup(<DeveloperPortalPage />);
    const docsMarkup = renderToStaticMarkup(<DocsPage />);

    expect(developerMetadata.description).toBe(
      'Current VitalCV API routes, SDKs, and webhook registration surfaces backed by this branch.',
    );
    expect(developerMarkup).toContain('Build against the');
    expect(developerMarkup).toContain('current VitalCV API preview.');
    expect(findHrefByText(developerMarkup, 'API Reference')).toBe('/docs/api');
    expect(findHrefByText(developerMarkup, 'SDKs')).toBe('/docs/sdk');
    expect(findHrefByText(developerMarkup, 'Webhook Guide')).toBe('/docs/webhooks');
    expect(developerMarkup).toContain(APPROVED_PUBLIC_WORDING.current);
    expect(developerMarkup).toContain(APPROVED_PUBLIC_WORDING.preview);

    expect(docsMetadata.description).toBe(
      'Everything you need to build on the current VitalCV API and documentation surface.',
    );
    expect(docsMarkup).toContain('Build on VitalCV');
    expectMarkupExcludes(developerMarkup, ['Trust Protocol']);
    expectMarkupExcludes(docsMarkup, ['Trust Protocol']);
  });

  it('keeps adjacent share and profile surfaces off unsupported share promises', async () => {
    const [{ ApplyWidgetSection }, { ProfileSummaryCard }] = await Promise.all([
      import('../components/apply/ApplyWidgetSection'),
      import('../components/ui/ProfileSummaryCard'),
    ]);

    const applyMarkup = renderToStaticMarkup(<ApplyWidgetSection npi="1234567890" />);
    const profileMarkup = renderToStaticMarkup(
      <ProfileSummaryCard
        name="Ada Lovelace"
        role="Internal Medicine"
        statusLevel="L2"
        statusLabel="Current"
      />,
    );

    expect(applyMarkup).toContain('current passport share flow');
    expect(profileMarkup).toContain('current credential status');
    expectMarkupExcludes(applyMarkup, ['verified bundle link', 'no account needed']);
    expectMarkupExcludes(profileMarkup, ['Trust Protocol']);
  });

  it('keeps employers hero, card, and status copy aligned with the public review wedge', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => SAMPLE_EMPLOYER_DIRECTORY,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 4 }),
      });

    vi.stubGlobal('fetch', fetchMock);
    fetchLaunchEmployerMock.mockResolvedValue(SAMPLE_EMPLOYER_DETAIL);
    fetchLaunchOpportunitiesMock.mockResolvedValue(SAMPLE_EMPLOYER_OPPORTUNITIES);

    const [{ default: EmployersPage }, { default: EmployerProfilePage }] = await Promise.all([
      import('../app/employers/page'),
      import('../app/employers/[slug]/page'),
    ]);

    const employersMarkup = renderToStaticMarkup(await EmployersPage());
    const employerProfileMarkup = renderToStaticMarkup(await EmployerProfilePage({
      params: Promise.resolve({ slug: 'sample-health' }),
    }));

    expect(employersMarkup).toContain('See current employers, roles, and review entry points.');
    expect(employersMarkup).toContain('Employer entry');
    expect(findHrefByText(employersMarkup, 'Check clinician readiness')).toBe('/onboarding?returnTo=%2Fexplore');
    expect(findHrefByText(employersMarkup, 'Open employer review')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.employerEntry);
    expect(findHrefByText(employersMarkup, 'Browse current roles')).toBe('/explore');
    expect(employersMarkup).toContain('Directory listed');
    expectMarkupExcludes(employersMarkup, PROHIBITED_EMPLOYER_PUBLIC_STRINGS);

    expect(employerProfileMarkup).toContain('Directory profile');
    expect(employerProfileMarkup).toContain('Directory signal');
    expect(employerProfileMarkup).toContain('Profile first listed');
    expect(findHrefByText(employerProfileMarkup, 'Employer review')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.employerEntry);
    expect(findHrefByText(employerProfileMarkup, 'Current roles')).toBe('/explore?organizationSlug=sample-health');
    expectMarkupExcludes(employerProfileMarkup, PROHIBITED_EMPLOYER_PUBLIC_STRINGS);
  }, 20000);
});
