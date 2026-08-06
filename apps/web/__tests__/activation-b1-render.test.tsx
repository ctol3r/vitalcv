/**
 * What the B1 activation surface actually renders — Wave 1076.
 *
 * The logic suite proves the decisions; this proves they reach the screen, and
 * that the screen does not say anything the truth contract forbids. The
 * assertions that matter most are negative: no banned claim, no bare
 * "Verified", no client-controlled Activate button, no readiness score.
 *
 * Rendered through `react-dom/server` per the house pattern — the point is the
 * markup and the words in it, not interaction.
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TruthBadge } from '@/components/activation/TruthBadge';
import { ReadinessPlannerPanel } from '@/components/activation/ReadinessPlannerPanel';
import type { ProfileFieldSpec, ProfileView } from '@/lib/activation/profileView';

/** Split-joined so this file is not itself a banned-string match. */
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

const NPI = '1003000126';

const SPECS: ProfileFieldSpec[] = [
  { key: 'fullName', label: 'Name', supports: 'Identifies the profile.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'contactEmail', label: 'Contact email', supports: 'A reply path.', origin: 'clinician_only', required: true, freeText: true },
];

const ACTIVE: ProfileView = {
  npi: NPI,
  state: 'profile_saved',
  disclosure: 'Your profile is saved and reusable.',
  fields: [
    { key: 'fullName', value: 'JEAN ABBOTT', truthClass: 'public_source', source: 'NPPES' },
    { key: 'contactEmail', value: 'jean@example.com', truthClass: 'clinician_provided' },
  ],
  missingRequired: [],
  reviewedAt: '2026-08-05T00:00:00.000Z',
  sharingConfirmedAt: '2026-08-05T00:00:00.000Z',
  savedAt: '2026-08-05T00:00:00.000Z',
  activatedAt: '2026-08-05T00:00:00.000Z',
  permissions: {
    reusableProfile: true,
    opportunityDiscovery: true,
    selfAttestedSharing: true,
    privateCredentialHoldings: false,
  },
  fieldSpecs: SPECS,
};

describe('the truth badge', () => {
  it('names the registry for a public-source value', () => {
    const html = renderToStaticMarkup(<TruthBadge truthClass="public_source" source="NPPES" />);
    expect(html).toContain('Found in NPPES');
    expect(html).toContain('data-truth-class="public_source"');
  });

  it('attributes a clinician value to the clinician', () => {
    const html = renderToStaticMarkup(<TruthBadge truthClass="clinician_provided" />);
    expect(html).toContain('Added or changed by you');
  });

  it('renders no bare "Verified" for any class', () => {
    for (const c of ['public_source', 'clinician_provided', 'ownership_verified', 'employer_reviewed'] as const) {
      const html = renderToStaticMarkup(<TruthBadge truthClass={c} />);
      expect(html).not.toMatch(/>\s*Verified\s*</);
    }
  });

  it('carries the meaning, not just the label', () => {
    const html = renderToStaticMarkup(<TruthBadge truthClass="public_source" source="NPPES" />);
    expect(html).toContain('not confirmation that the NPI is yours');
  });

  it('styles the two everyday classes differently', () => {
    const pub = renderToStaticMarkup(<TruthBadge truthClass="public_source" source="NPPES" />);
    const own = renderToStaticMarkup(<TruthBadge truthClass="clinician_provided" />);
    expect(pub).not.toBe(own);
  });
});

describe('the Readiness Planner panel', () => {
  const html = () => renderToStaticMarkup(<ReadinessPlannerPanel view={ACTIVE} />);

  it('opens with the opportunity step', () => {
    expect(html()).toContain('data-planner-step="review_opportunities"');
  });

  it('names who controls every step it shows', () => {
    const markup = html();
    expect(markup).toContain('data-planner-controller=');
    expect(markup).toContain('data-planner-vitalcv-role=');
  });

  it('says plainly where VitalCV cannot act', () => {
    const markup = html();
    expect(markup).toContain('VitalCV cannot do this');
    expect(markup).toContain('The employer decides this');
  });

  it('shows no percentage, score, or grade', () => {
    const markup = html();
    expect(markup).not.toMatch(/\d+%/);
    expect(markup.toLowerCase()).not.toContain('readiness score');
  });

  it('renders nothing at all before the server activated the profile', () => {
    const pending = { ...ACTIVE, activatedAt: null };
    expect(renderToStaticMarkup(<ReadinessPlannerPanel view={pending} />)).toBe('');
  });

  it('contains no banned claim', () => {
    const markup = html().toLowerCase();
    for (const phrase of BANNED) expect(markup).not.toContain(phrase.toLowerCase());
  });
});

describe('the activation page', () => {
  async function renderPage(opts: { signedIn: boolean; npi?: string }): Promise<string> {
    vi.resetModules();
    vi.doMock('@clerk/nextjs/server', () => ({
      auth: async () => (opts.signedIn ? { userId: 'user_1' } : { userId: null }),
    }));
    const Page = (await import('../app/profile/activate/page')).default;
    const element = await Page({
      searchParams: Promise.resolve(opts.npi ? { npi: opts.npi } : {}),
    });
    return renderToStaticMarkup(element as React.ReactElement);
  }

  it('shows the anonymous preview to a signed-out visitor', async () => {
    const html = await renderPage({ signedIn: false, npi: NPI });
    expect(html).toContain('data-activation-stage="preview"');
    expect(html).toContain('no account needed to preview');
  });

  it('does not render the durable flow to a signed-out visitor', async () => {
    const html = await renderPage({ signedIn: false, npi: NPI });
    expect(html).not.toContain('data-activation-stage="review"');
    expect(html).not.toContain('data-sharing-control');
  });

  it('renders the flow for a signed-in clinician', async () => {
    const html = await renderPage({ signedIn: true, npi: NPI });
    // The flow resolves its profile in the browser; server output is its
    // loading state, which is what a client component renders here.
    expect(html).toContain('Finding your profile');
  });

  it('falls back to the preview when Clerk is unavailable, rather than failing', async () => {
    vi.resetModules();
    vi.doMock('@clerk/nextjs/server', () => ({
      auth: async () => {
        throw new Error('clerkMiddleware() was not run');
      },
    }));
    const Page = (await import('../app/profile/activate/page')).default;
    const html = renderToStaticMarkup(
      (await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
    );
    expect(html).toContain('data-activation-stage="preview"');
  });

  it('ignores an NPI in the query that is not an NPI', async () => {
    const html = await renderPage({ signedIn: false, npi: '../../etc/passwd' });
    expect(html).not.toContain('etc/passwd');
  });

  it('keeps a per-clinician working surface out of search indexes', async () => {
    vi.resetModules();
    const { metadata } = await import('../app/profile/activate/page');
    expect(metadata.robots).toMatchObject({ index: false });
  });
});

describe('the preview surface', () => {
  async function preview(): Promise<string> {
    vi.resetModules();
    vi.doMock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: null }) }));
    const Page = (await import('../app/profile/activate/page')).default;
    return renderToStaticMarkup(
      (await Page({ searchParams: Promise.resolve({ npi: NPI }) })) as React.ReactElement,
    );
  }

  it('contains no banned claim', async () => {
    const html = (await preview()).toLowerCase();
    for (const phrase of BANNED) expect(html).not.toContain(phrase.toLowerCase());
  });

  it('renders no bare "Verified" status label', async () => {
    expect(await preview()).not.toMatch(/>\s*Verified\s*</);
  });

  it('offers no Activate control — activation is a server conclusion', async () => {
    const html = (await preview()).toLowerCase();
    expect(html).not.toContain('>activate<');
  });
});
