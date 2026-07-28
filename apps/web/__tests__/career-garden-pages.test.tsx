import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GardenWorkspaceProvider } from '@/components/career-garden/GardenWorkspaceProvider';
import CareerGardenCvPage from '@/app/holder/garden/cv/page';
import CareerGardenHomePage from '@/app/holder/garden/page';
import CareerGardenNotesPage from '@/app/holder/garden/notes/page';
import CareerGardenOpportunitiesPage from '@/app/holder/garden/opportunities/page';
import CareerGardenPrivacyPage from '@/app/holder/garden/privacy/page';
import CareerGardenResearchPage from '@/app/holder/garden/research/page';

/**
 * Server-render contract for the Career Garden pages. The provider wrapper
 * mirrors app/holder/garden/layout.tsx; rendering through
 * react-dom/server proves the whole flow — note detail, grow review,
 * composer — reads without client JavaScript.
 */

function sp<T extends Record<string, string>>(params: T) {
  return { searchParams: Promise.resolve(params) };
}

async function render(el: React.ReactElement | Promise<React.ReactElement>) {
  return renderToStaticMarkup(<GardenWorkspaceProvider>{await el}</GardenWorkspaceProvider>);
}

describe('career-garden pages (server render)', () => {
  it('home carries the privacy line, sample notice, today panel, five beds, and tend card', async () => {
    const html = await render(<CareerGardenHomePage />);
    expect(html).toContain('Private workspace — only you can see notes until you choose to share.');
    expect(html).toContain('Prototype with sample data');
    expect(html).toContain('Today');
    expect(html).toContain('Sample tasks');
    for (const bed of ['Seeds', 'Roots', 'Branches', 'Blooms', 'Harvests']) {
      expect(html).toContain(bed);
    }
    expect(html).toContain('Tend your garden');
    expect(html).toContain('Recent activity');
    // Three-layer orientation strip links to the real surfaces.
    expect(html).toContain('href="/holder"');
    expect(html).toContain('href="/holder/applications"');
    // Section nav is a labeled landmark with a current page.
    expect(html).toContain('aria-label="Career Garden sections"');
    expect(html).toContain('aria-current="page"');
  });

  it('notes grow review shows the draft, its label, facts used, and explicit approval', async () => {
    const html = await render(
      CareerGardenNotesPage(sp({ note: 'seed-journal-club', grow: '1' })),
    );
    expect(html).toContain('Only you can see this.');
    expect(html).toContain('Review before it blooms');
    expect(html).toContain('Self-attested');
    expect(html).toContain('AI-assisted draft — review before sharing.');
    expect(html).toContain('Facts used in this draft');
    expect(html).toContain('Approve — add to Living CV');
    expect(html).toContain('Session-only in this prototype');
    // The draft never claims a source.
    expect(html).not.toMatch(/Source-backed(?!\s+evidence\b)/);
  });

  it('notes detail without grow offers the review panel, not silent growth', async () => {
    const html = await render(CareerGardenNotesPage(sp({ note: 'seed-pocus-series' })));
    expect(html).toContain('Grow into CV draft');
    expect(html).toContain('nothing changes without your approval');
  });

  it('living cv shows provenance stamps and origin details for every line', async () => {
    const html = await render(CareerGardenCvPage(sp({})));
    expect(html).toContain('Living CV');
    expect(html).toContain('Show origin');
    expect(html).toContain('Self-attested');
    expect(html).toContain('href="/clinician/profile"');
    expect(html).toContain('href="/holder"');
    expect(html).toContain('grows with you');
  });

  it('research renders the candidate rule and never asserts authorship', async () => {
    const html = await render(CareerGardenResearchPage(sp({})));
    expect(html).toContain('Publication candidates');
    expect(html).toContain('never an authorship claim');
    expect(html).toContain('Candidate match');
    expect(html).toContain('Needs review');
  });

  it('opportunity detail + composer keep the draft honest and unsendable', async () => {
    const html = await render(
      CareerGardenOpportunitiesPage(sp({ op: 'opp-cedar-grove', compose: '1' })),
    );
    // Posting facts render as data.
    expect(html).toContain('Cedar Grove Medical Center (sample employer)');
    expect(html).toContain('7-on / 7-off nights');
    // Fit explanation with the refusal line, and honest evidence states.
    expect(html).toContain('Why this may fit');
    expect(html).toContain('No odds, no scores');
    for (const state of ['Self-attested', 'Needs review', 'Unavailable', 'Access required']) {
      expect(html).toContain(state);
    }
    // Composer contract.
    expect(html).toContain('Facts used in this draft');
    expect(html).toContain('Draft only — review before sharing.');
    expect(html).toContain('AI-assisted draft — review before sharing.');
    expect(html).toContain('Dear hiring team at Cedar Grove Medical Center (sample employer)');
    // No send/submit/apply control exists on this surface.
    expect(html).not.toMatch(/>\s*Send\b/);
    expect(html).not.toMatch(/>\s*Submit\b/);
    expect(html).not.toMatch(/>\s*Apply now\b/);
    // Links out to the real surfaces instead of recreating them.
    expect(html).toContain('href="/holder/opportunities"');
    expect(html).toContain('href="/holder/opportunities/discover"');
    expect(html).toContain('href="/holder/applications"');
  });

  it('privacy page keeps the four standings distinct and claims nothing it cannot prove', async () => {
    const html = await render(<CareerGardenPrivacyPage />);
    expect(html).toContain('Four kinds of standing');
    for (const standing of ['Connected profile', 'Self-added link', 'Source-backed evidence', 'AI-assisted draft']) {
      expect(html).toContain(standing);
    }
    expect(html).toContain('None exists in this prototype');
    expect(html).toContain('no security, compliance, or encryption claims');
    // Connection cards carry method, observation, refresh, and sharing.
    for (const field of ['Connection method', 'What VitalCV observed', 'Refresh', 'Sharing']) {
      expect(html).toContain(field);
    }
    expect(html).toContain('Revocable at any time');
    // The share record explainer lists the full consent fields.
    for (const line of ['who received it', 'the purpose you chose', 'the moment you consented', 'the packet version', 'every field it contained', 'its full sharing history']) {
      expect(html).toContain(line);
    }
  });

  it('every page renders the section nav with an accessible current marker', async () => {
    const pages = [
      render(<CareerGardenHomePage />),
      render(CareerGardenCvPage(sp({}))),
      render(CareerGardenNotesPage(sp({}))),
      render(CareerGardenResearchPage(sp({}))),
      render(CareerGardenOpportunitiesPage(sp({}))),
      render(<CareerGardenPrivacyPage />),
    ];
    for (const html of await Promise.all(pages)) {
      expect(html).toContain('aria-label="Career Garden sections"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('<h1');
    }
  });
});
