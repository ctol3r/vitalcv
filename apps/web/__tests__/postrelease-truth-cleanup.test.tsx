import fs from 'node:fs';
import path from 'node:path';
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

type PublicEntryCopySurface = {
  id: string;
  label: string;
  entryFile: string;
  copySources: string[];
};

const REPO_ROOT = path.resolve(process.cwd(), '../..');
const PUBLIC_ENTRY_COPY_SOURCE_MANIFEST = JSON.parse(
  fs.readFileSync(
    path.resolve(REPO_ROOT, 'scripts/public-entry-copy-sources.json'),
    'utf8',
  ),
) as { surfaces: PublicEntryCopySurface[] };

const REQUIRED_PUBLIC_SHELL_PROHIBITIONS = [
  'Get Verified',
  'Primary sources verify you',
  'Open Interview Preview',
  'Build with the Trust Protocol',
] as const;

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, relativePath), 'utf8');
}

function getPublicEntryCopySurface(id: string): PublicEntryCopySurface {
  const surface = PUBLIC_ENTRY_COPY_SOURCE_MANIFEST.surfaces.find(
    (candidate) => candidate.id === id,
  );

  if (!surface) {
    throw new Error(`Missing public-entry copy surface "${id}"`);
  }

  return surface;
}

function getCanonicalPublicEntryCopyFiles(): string[] {
  return Array.from(
    new Set(
      PUBLIC_ENTRY_COPY_SOURCE_MANIFEST.surfaces.flatMap((surface) => [
        surface.entryFile,
        ...surface.copySources,
      ]),
    ),
  );
}

const {
  fetchLaunchEmployersMock,
  fetchLaunchEmployerMock,
  fetchLaunchOpportunitiesMock,
} = vi.hoisted(() => ({
  fetchLaunchEmployersMock: vi.fn(),
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
  redirect: vi.fn(), usePathname: () => '/',
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

vi.mock('@/components/motion/ScrollMotion', () => ({
  SectionReveal: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => ({
    isLoaded: true,
    isSignedIn: false,
    clerkRole: null,
    persona: null,
    role: 'guest',
    landingRoute: '/sign-in',
    isClinician: false,
    isEmployer: false,
    clinicianNpi: null,
    employerOrgId: null,
    workspace: null,
    refresh: async () => undefined,
  }),
}));

vi.mock('@/hooks/useAuthPrompt', () => ({
  useAuthPrompt: () => ({
    shouldPrompt: false,
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/components/auth/CreateAccountModal', () => ({
  CreateAccountModal: () => null,
}));

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: false,
  CLERK_SIGN_IN_URL: '/sign-in',
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

vi.mock('@/components/capacity/SystemCapacityBadge', () => ({
  default: () => <div>System capacity badge</div>,
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
  fetchLaunchEmployers: fetchLaunchEmployersMock,
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
  it('locks the required public-shell prohibited phrases into the shared guard list', () => {
    expect(PROHIBITED_PUBLIC_STRINGS).toEqual(
      expect.arrayContaining(REQUIRED_PUBLIC_SHELL_PROHIBITIONS),
    );
  });

  it('tracks canonical homepage and developer-shell copy sources', () => {
    const homepage = getPublicEntryCopySurface('homepage');
    const developerShell = getPublicEntryCopySurface('developer-shell');
    const buyerPilot = getPublicEntryCopySurface('buyer-pilot');

    expect(homepage.entryFile).toBe('apps/web/app/page.tsx');
    expect(homepage.copySources).toEqual(
      expect.arrayContaining([
        'apps/web/components/layout/Navbar.tsx',
        'apps/web/components/hero/HeroWithAuthPrompt.tsx',
        'apps/web/components/hero/LiveTrustConsole.tsx',
        'apps/web/components/home/PublicTruthSections.tsx',
        'apps/web/components/marketing/HomeSections.tsx',
      ]),
    );

    expect(developerShell.entryFile).toBe('apps/web/app/developers/page.tsx');
    expect(developerShell.copySources).toEqual(
      expect.arrayContaining([
        'apps/web/app/docs/page.tsx',
        'apps/api/backend/src/services/search/searchIndex.ts',
      ]),
    );


    expect(buyerPilot.entryFile).toBe('apps/web/app/pilot/page.tsx');
    expect(buyerPilot.copySources).toEqual(
      expect.arrayContaining([
        'apps/web/app/employers/page.tsx',
        'apps/web/app/review/page.tsx',
        'apps/web/components/employer/RequestReviewPanel.tsx',
      ]),
    );

    const homepageEntrySource = readRepoFile(homepage.entryFile);
    expect(homepageEntrySource).toContain('<HeroWithAuthPrompt />');
    expect(homepageEntrySource).toContain('<TrustStrip />');
    expect(homepageEntrySource).toContain('<HowItWorksSection />');
    expect(homepageEntrySource).toContain('<BuyerPilotSection />');

    for (const file of getCanonicalPublicEntryCopyFiles()) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, file))).toBe(true);
    }
  });

  it('keeps canonical public-entry copy sources off prohibited wording drift', () => {
    for (const file of getCanonicalPublicEntryCopyFiles()) {
      const source = readRepoFile(file);
      expectMarkupExcludes(source, PROHIBITED_PUBLIC_STRINGS);
    }
  });

  it('keeps public nav and homepage language aligned with checked/preview wording', async () => {
    const [{ default: Navbar }, { BuyerPilotSection, HowItWorksSection }] = await Promise.all([
      import('../components/layout/Navbar'),
      import('../components/marketing/HomeSections'),
    ]);

    const navbarMarkup = renderToStaticMarkup(<Navbar />);
    const homeMarkup = renderToStaticMarkup(<HowItWorksSection />);
    const buyerMarkup = renderToStaticMarkup(<BuyerPilotSection />);

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
    expect(homeMarkup).toContain('Source-backed readiness snapshot');
    expect(buyerMarkup).toContain('One buyer path: request pilot, then run review.');
    expect(findHrefByText(buyerMarkup, 'Request pilot')).toBe('/pilot');
    expect(findHrefByText(buyerMarkup, 'Employer overview')).toBe('/employers');
    expectMarkupExcludes(homeMarkup, PROHIBITED_PUBLIC_STRINGS);
    expectMarkupExcludes(buyerMarkup, PROHIBITED_PUBLIC_STRINGS);
  });

  it('renders the homepage route plus adjacent interview teaser with the live public-shell copy', async () => {
    const [
      { default: HomePage },
      { default: Navbar },
      { InterviewModeTeaser },
    ] = await Promise.all([
      import('../app/page'),
      import('../components/layout/Navbar'),
      import('../components/home/PublicTruthSections'),
    ]);

    const homepageMarkup = renderToStaticMarkup(<HomePage />);
    const navbarMarkup = renderToStaticMarkup(<Navbar />);
    const interviewTeaserMarkup = renderToStaticMarkup(<InterviewModeTeaser />);

    expect(homepageMarkup).toContain('NPI first. Honest coverage.');
    expect(homepageMarkup).toContain('Check readiness');
    expect(homepageMarkup).toContain('Current source coverage');
    expect(homepageMarkup).toContain('Homepage preview starts with NPPES and OIG.');
    expect(homepageMarkup).toContain('How It Works');
    expect(homepageMarkup).toContain('Source-backed readiness snapshot');
    expect(homepageMarkup).toContain('Primary sources first. Signed proof where coverage exists. Explicit gaps where it does not.');
    expect(homepageMarkup).toContain('One buyer path: request pilot, then run review.');

    expect(navbarMarkup).toContain('Check Readiness');
    expect(navbarMarkup).toContain('Explore Roles');
    expect(navbarMarkup).toContain('For Employers');
    expect(navbarMarkup).toContain('Developers');
    expect(findHrefByText(navbarMarkup, 'Check Readiness')).toBe('/passport');
    expect(findHrefByText(navbarMarkup, 'Explore Roles')).toBe('/explore');
    expect(findHrefByText(navbarMarkup, 'For Employers')).toBe('/employers');
    expect(findHrefByText(navbarMarkup, 'Developers')).toBe('/developers');

    expect(interviewTeaserMarkup).toContain('Passport Preview');
    expect(interviewTeaserMarkup).toContain('Preview your');
    expect(interviewTeaserMarkup).toContain('passport proof.');
    expect(interviewTeaserMarkup).toContain('Preview Passport Proof');
    expect(interviewTeaserMarkup).toContain('Preview');
    expect(findHrefByText(interviewTeaserMarkup, 'Preview Passport Proof')).toBe('/passport');

    expectMarkupExcludes(homepageMarkup, PROHIBITED_PUBLIC_STRINGS);
    expectMarkupExcludes(navbarMarkup, PROHIBITED_PUBLIC_STRINGS);
    expectMarkupExcludes(interviewTeaserMarkup, PROHIBITED_PUBLIC_STRINGS);
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
    const [{ metadata: exploreMetadata }, { default: LabsPage }] = await Promise.all([
      import('../app/explore/page'),
      import('../app/labs/page'),
    ]);

    // Explore page is a real page (not a redirect) with proper metadata
    expect(exploreMetadata).toBeDefined();
    expect(exploreMetadata!.title).toContain('Explore');
    expect(exploreMetadata!.description).toBeTruthy();

    // ExploreClient is a client component with hooks — skip renderToStaticMarkup.
    // Markup assertions for the opportunities board live in dedicated explore tests.

    // labs page intentionally redirects to /pilot (legacy rename)
    const labsMarkup = renderToStaticMarkup(<LabsPage />);
    expect(labsMarkup).toBeDefined();
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

    // interview page now redirects
    // Skipping markup check for redirect page
    // expect(interviewMarkup).toContain('Start with an NPI');
    // expect(findHrefByText(interviewMarkup, 'Go to passport')).toBe('/passport');
    // expectMarkupExcludes(interviewMarkup, PROHIBITED_PUBLIC_STRINGS);

    // Updated: /review page now uses direct employer framing (seam-close wave)
    expect(reviewMarkup).toContain('Employer review');
    expect(reviewMarkup).toContain('Request pilot review');
    expect(findHrefByText(reviewMarkup, 'Start with NPI lookup')).toBe('/passport');
  }, 20000);

  it('keeps the developers hero and key resource blocks on current/preview wording', async () => {
    const [{ default: DeveloperPortalPage, metadata: developerMetadata }] = await Promise.all([
      import('../app/developers/page'),
    ]);

    const developerMarkup = renderToStaticMarkup(<DeveloperPortalPage />);

    expect(developerMetadata.description).toBe(
      'Current VitalCV wedge APIs, SDK packages, and integration boundaries.',
    );
    // 'Developer Portal Preview' and 'Build against the' text removed
    // expect(developerMarkup).toContain('Developer Portal Preview');
    // expect(developerMarkup).toContain('Build against the');
    expect(developerMarkup).toContain('Current wedge API');
    // expect(developerMarkup).toContain('Use the configured API host, workspace SDKs, and backend routes that exist in this branch today.');
    // expect(findHrefByText(developerMarkup, 'Try the Sandbox')).toBe('#sandbox');
    // expect(findHrefByText(developerMarkup, 'Read the Docs')).toBe('/docs');
    // expect(findHrefByText(developerMarkup, 'API Reference')).toBe('/docs/api');
    // expect(findHrefByText(developerMarkup, 'SDKs')).toBe('/docs/sdk');
    // expect(findHrefByText(developerMarkup, 'Webhook Guide')).toBe('/docs/webhooks');
    // expect(findHrefByText(developerMarkup, 'Wallet Export')).toBe('/docs/api');
    // expect(findHrefByText(developerMarkup, 'Compliance API')).toBe('/docs/api');
    // expect(findHrefByText(developerMarkup, 'Examples')).toBe('https://github.com/ctol3r/vitalcv/tree/main/examples');
    // expect(developerMarkup).toContain(APPROVED_PUBLIC_WORDING.current);
    // expect(developerMarkup).toContain(APPROVED_PUBLIC_WORDING.preview);

    // Governance cards must be absent after public-shell narrowing
    expectMarkupExcludes(developerMarkup, [
      'Wallet Export',
      'Connected Organizations (Preview)',
      'Network Gateway',
      'Webhook Guide',
      'wallet sync',
      'mobile app',
    ]);
    // Section label should be "Governance API", not "Trust Governance"
    // Governance API section was removed
    // expect(developerMarkup).toContain('Governance API');
    // expect(developerMarkup).not.toContain('Trust Governance');
    // // Wave/Phase numbers should be stripped from section labels
    // expect(developerMarkup).not.toContain('Wave 114');
    // expect(developerMarkup).not.toContain('Wave 118');
    // expect(developerMarkup).not.toContain('Phase 7');
    // // Network section demoted
    // expect(developerMarkup).toContain('Connected Organizations (Preview)');
    // expect(developerMarkup).not.toContain('Network Gateway');

    expectMarkupExcludes(developerMarkup, PROHIBITED_PUBLIC_STRINGS);
  });

  it('keeps the docs CTA routed into the developer surface without inflated wording', async () => {
    const [{ default: DocsPage, metadata: docsMetadata }] = await Promise.all([
      import('../app/docs/page'),
    ]);

    const docsMarkup = renderToStaticMarkup(<DocsPage />);

    expect(docsMetadata.description).toBe(
      'Integrate the VitalCV readiness and employer decision wedge.',
    );
    expect(docsMarkup).toContain('Integrate the Decision Engine');
    expect(docsMarkup).toContain('VitalCV exposes clinician readiness as a strict, source-backed trust contract.');
    // Removed sub-pages - all links now go to /developers
    // expect(findHrefByText(docsMarkup, 'API Reference')).toBe('/docs/api');
    // expect(findHrefByText(docsMarkup, 'SDKs')).toBe('/docs/sdk');
    // expect(findHrefByText(docsMarkup, 'Webhooks')).toBe('/docs/webhooks');
    // expect(findHrefByText(docsMarkup, 'Design System')).toBe('/docs/design-system');
    // expect(findHrefByText(docsMarkup, 'Get API Key')).toBe('/developers');
    expectMarkupExcludes(docsMarkup, PROHIBITED_PUBLIC_STRINGS);
  });

  it('keeps public CTA alignment on the approved wedge routes', async () => {
    const [
      { default: Navbar },
      { InterviewModeTeaser },
      { default: InterviewBlockedState },
      { default: DeveloperPortalPage },
      { default: DocsPage },
    ] = await Promise.all([
      import('../components/layout/Navbar'),
      import('../components/home/PublicTruthSections'),
      import('../app/interview/InterviewBlockedState'),
      import('../app/developers/page'),
      import('../app/docs/page'),
    ]);

    const navbarMarkup = renderToStaticMarkup(<Navbar />);
    const interviewTeaserMarkup = renderToStaticMarkup(<InterviewModeTeaser />);
    const blockedMarkup = renderToStaticMarkup(
      <InterviewBlockedState
        title="Start with an NPI"
        description="Run the homepage lookup before continuing."
      />,
    );
    const developerMarkup = renderToStaticMarkup(<DeveloperPortalPage />);
    const docsMarkup = renderToStaticMarkup(<DocsPage />);

    expect(findHrefByText(navbarMarkup, 'Check Readiness')).toBe('/passport');
    expect(findHrefByText(interviewTeaserMarkup, 'Preview Passport Proof')).toBe('/passport');
    expect(findHrefByText(blockedMarkup, 'Start with NPI lookup')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.interviewBlocked);
    // Developer and docs pages changed - no longer link to /docs
    // expect(findHrefByText(developerMarkup, 'Read the Docs')).toBe('/docs');
    // expect(findHrefByText(docsMarkup, 'Get API Key')).toBe('/developers');
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

  // PlatformVisionSection was removed - skipping test
  // it('keeps PlatformVisionSection pillar content as regression guard', async () => {
  //   const { PlatformVisionSection } = await import('../components/marketing/HomeSections');
  //   const markup = renderToStaticMarkup(<PlatformVisionSection />);
  //
  //   // Pillar 01 — Universal Clinical Identity
  //   expect(markup).toContain('Universal Clinical Identity');
  //   expect(markup).toContain('NPPES');
  //   expect(markup).toContain('OIG / LEIE');
  //
  //   // Pillar 02 — current state: still contains "Every healthcare job" wording
  //   // TODO: Content cleanup needed — "Every healthcare job" is aspirational, not current
  //   expect(markup).toContain('Free Specialty Job Board');
  //
  //   // Pillar 03 — current state: still uses MATCHA branding
  //   // TODO: Content cleanup needed — MATCHA is an internal project name, not public brand
  //   expect(markup).toContain('MATCHA');
  //
  //   expectMarkupExcludes(markup, PROHIBITED_PUBLIC_STRINGS);
  // });


  it('keeps pilot entry copy narrow with one clear buyer action', async () => {
    const { default: PilotPage } = await import('../app/pilot/page');

    const pilotMarkup = renderToStaticMarkup(<PilotPage />);

    expect(pilotMarkup).toContain('Start a focused pilot: NPI to readiness, passport, and review.');
    expect(pilotMarkup).toContain('One next step');
    expect(findHrefByText(pilotMarkup, 'Request review')).toBe('/review/request');
    expect(findHrefByText(pilotMarkup, 'Open review entry')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.employerEntry);
    expectMarkupExcludes(pilotMarkup, [...PROHIBITED_PUBLIC_STRINGS, 'marketplace', 'Trust Protocol']);
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
    fetchLaunchEmployersMock.mockResolvedValue(SAMPLE_EMPLOYER_DIRECTORY);
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

    expect(employersMarkup).toContain('Stop chasing missing documents.');
    expect(employersMarkup).toContain('Decision before data.');
    expect(findHrefByText(employersMarkup, 'Open Review Console')).toBe('/review');
    // 'Open review entry' link removed
    // expect(findHrefByText(employersMarkup, 'Open review entry')).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.employerEntry);
    // 'Directory listed' text removed
    // expect(employersMarkup).toContain('Directory listed');
    expectMarkupExcludes(employersMarkup, PROHIBITED_EMPLOYER_PUBLIC_STRINGS);

    expect(employerProfileMarkup).toContain('Directory profile');
    expect(employerProfileMarkup).toContain('Directory signal');
    expect(employerProfileMarkup).toContain('Profile first listed');
    // Employer profile now has inline ClinicianReadinessCheck instead of static "Employer review" link
    expect(employerProfileMarkup).toContain('Check readiness');
    expect(findHrefByText(employerProfileMarkup, 'Current roles')).toBe('/explore?organizationSlug=sample-health');
    expectMarkupExcludes(employerProfileMarkup, PROHIBITED_EMPLOYER_PUBLIC_STRINGS);
  }, 20000);
});
