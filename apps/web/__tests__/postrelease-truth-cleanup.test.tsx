import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  useInView: () => true,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
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
  default: ({ label = 'Get Prequalified' }: { label?: string }) => <a>{label}</a>,
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

describe('post-release truth cleanup', () => {
  it('keeps public nav and homepage language aligned with checked/preview wording', async () => {
    const [{ default: Navbar }, { HowItWorksSection }] = await Promise.all([
      import('../components/layout/Navbar'),
      import('../components/marketing/HomeSections'),
    ]);

    const navbarMarkup = renderToStaticMarkup(<Navbar />);
    const homeMarkup = renderToStaticMarkup(<HowItWorksSection />);

    expect(navbarMarkup).toContain('Get Ready');
    expect(navbarMarkup).not.toContain('Get Verified');

    expect(homeMarkup).toContain('Source-backed readiness snapshot');
    expect(homeMarkup).toContain('Checked from live sources');
    expect(homeMarkup).not.toContain('Primary sources verify you');
  });

  it('keeps the readiness preview on checked and packet-preview language', async () => {
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
    expect(markup).toContain('Continue to packet preview');
    expect(markup).toContain('Source checks');
    expect(markup).toContain('Source-backed preview');
    expect(markup).not.toContain('Identity verified');
    expect(markup).not.toContain('Source verification');
  });

  it('keeps explore and labs surfaces on source-backed wording', async () => {
    const [{ default: ExplorePage, metadata: exploreMetadata }, { default: LabsPage }] = await Promise.all([
      import('../app/explore/page'),
      import('../app/labs/page'),
    ]);

    const exploreMarkup = renderToStaticMarkup(<ExplorePage />);
    const labsMarkup = renderToStaticMarkup(<LabsPage />);

    expect(exploreMetadata.description).toBe(
      'Trust-native clinical opportunities matched to your source-backed readiness snapshot. Know what is checked before you apply.',
    );
    expect(exploreMarkup).toContain('Already Matched For.');
    expect(exploreMarkup).toContain('Check Readiness Free');
    expect(exploreMarkup).not.toContain('Already Cleared For.');

    expect(labsMarkup).toContain('source-backed readiness snapshot');
    expect(labsMarkup).not.toContain('verified readiness snapshot');
  });

  it('renders interview, review, and SDK routes without broken truth language', async () => {
    const [{ default: InterviewPage }, { default: ReviewLandingPage }, { default: SdkDocsPage }] = await Promise.all([
      import('../app/interview/page'),
      import('../app/review/page'),
      import('../app/docs/sdk/page'),
    ]);

    const interviewMarkup = renderToStaticMarkup(await InterviewPage({
      searchParams: Promise.resolve({}),
    }));
    const reviewMarkup = renderToStaticMarkup(<ReviewLandingPage />);
    const sdkMarkup = renderToStaticMarkup(<SdkDocsPage />);

    expect(interviewMarkup).toContain('packet preview');
    expect(interviewMarkup).toContain('source-backed readiness snapshot');
    expect(interviewMarkup).not.toContain('real verified readiness');

    expect(reviewMarkup).toContain('Open a shared packet preview');
    expect(reviewMarkup).toContain('share when a real packet exists');

    expect(sdkMarkup).toContain('Client Libraries');
    expect(sdkMarkup).toContain('@vitalcv/verifier-sdk');
  });
});
