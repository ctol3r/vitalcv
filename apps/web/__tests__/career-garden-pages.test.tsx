import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GARDEN_UNAVAILABLE,
  fixtureGardenData,
  type GardenData,
} from '@/lib/career-garden/gardenViews';

/**
 * Server-render contract for the Career Garden pages in their live mount.
 * loadGardenData is mocked at the boundary (the serverSource suite covers
 * its real behavior); rendering through react-dom/server proves the whole
 * flow — note detail, grow review, composer — reads without client JS.
 */

let mockData: GardenData;

vi.mock('@/lib/career-garden/serverSource', () => ({
  loadGardenData: vi.fn(async () => mockData),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

import { GardenWorkspaceProvider } from '@/components/career-garden/GardenWorkspaceProvider';
import CareerGardenCvPage from '@/app/holder/garden/cv/page';
import CareerGardenHomePage from '@/app/holder/garden/page';
import CareerGardenNotesPage from '@/app/holder/garden/notes/page';
import CareerGardenOpportunitiesPage from '@/app/holder/garden/opportunities/page';
import CareerGardenPrivacyPage from '@/app/holder/garden/privacy/page';
import CareerGardenResearchPage from '@/app/holder/garden/research/page';

beforeEach(() => {
  // Live mount over the fixture content: same safe dataset, real code path.
  mockData = { ...fixtureGardenData(), mode: 'live' };
});

function sp<T extends Record<string, string>>(params: T) {
  return { searchParams: Promise.resolve(params) };
}

async function render(el: React.ReactElement | Promise<React.ReactElement>) {
  return renderToStaticMarkup(
    <GardenWorkspaceProvider initial={mockData}>{await el}</GardenWorkspaceProvider>,
  );
}

describe('career-garden pages (live server render)', () => {
  it('home carries the privacy line, live-mode notice, grounded today panel, five beds, and tend card', async () => {
    const html = await render(CareerGardenHomePage());
    expect(html).toContain('Private workspace — only you can see notes until you choose to share.');
    expect(html).toContain('saved to your private workspace');
    expect(html).toContain('From your workspace');
    for (const bed of ['Seeds', 'Roots', 'Branches', 'Blooms', 'Harvests']) {
      expect(html).toContain(bed);
    }
    // Sample beds stay unmistakably sample in the live mount.
    expect(html).toContain('Sample — its wave is next');
    expect(html).toContain('Tend your garden');
    expect(html).toContain('Recent activity');
    expect(html).toContain('href="/holder"');
    expect(html).toContain('href="/holder/applications"');
    expect(html).toContain('aria-label="Career Garden sections"');
    expect(html).toContain('aria-current="page"');
  });

  it('notes grow review is an editable draft with explicit approval and honest labels', async () => {
    const html = await render(
      CareerGardenNotesPage(sp({ note: 'seed-journal-club', grow: '1' })),
    );
    expect(html).toContain('Only you can see this.');
    expect(html).toContain('Review before it blooms');
    expect(html).toContain('Self-attested');
    expect(html).toContain('AI-assisted draft — review before sharing.');
    expect(html).toContain('Facts used in this draft');
    expect(html).toContain('Approve — add to Living CV');
    expect(html).toContain('yours to reverse');
    expect(html).toContain('Approving needs JavaScript');
    // The draft never claims a source.
    expect(html).not.toMatch(/Source-backed(?!\s+evidence\b)/);
  });

  it('notes detail without grow offers the review panel, not silent growth', async () => {
    const html = await render(CareerGardenNotesPage(sp({ note: 'seed-pocus-series' })));
    expect(html).toContain('Grow into CV draft');
    expect(html).toContain('nothing changes without your approval');
  });

  it('living cv shows provenance and origin on every line and points at the durable surfaces', async () => {
    const html = await render(CareerGardenCvPage(sp({})));
    expect(html).toContain('Living CV');
    expect(html).toContain('Show origin');
    expect(html).toContain('Self-attested');
    expect(html).toContain('href="/clinician/profile"');
    expect(html).toContain('href="/holder"');
    expect(html).toContain('grows with you');
    expect(html).toContain('removing a line reopens its seed');
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
    expect(html).toContain('Cedar Grove Medical Center (sample employer)');
    expect(html).toContain('7-on / 7-off nights');
    expect(html).toContain('Why this may fit');
    expect(html).toContain('No odds, no scores');
    for (const state of ['Self-attested', 'Needs review', 'Unavailable', 'Access required']) {
      expect(html).toContain(state);
    }
    expect(html).toContain('Facts used in this draft');
    expect(html).toContain('Draft only — review before sharing.');
    expect(html).toContain('AI-assisted draft — review before sharing.');
    expect(html).toContain('Dear hiring team at Cedar Grove Medical Center (sample employer)');
    expect(html).not.toMatch(/>\s*Send\b/);
    expect(html).not.toMatch(/>\s*Submit\b/);
    expect(html).not.toMatch(/>\s*Apply now\b/);
    expect(html).toContain('href="/holder/opportunities"');
    expect(html).toContain('href="/holder/opportunities/discover"');
    expect(html).toContain('href="/holder/applications"');
  });

  it('privacy page keeps the four standings distinct and claims nothing it cannot prove', async () => {
    const html = await render(CareerGardenPrivacyPage());
    expect(html).toContain('Four kinds of standing');
    for (const standing of ['Connected profile', 'Self-added link', 'Source-backed evidence', 'AI-assisted draft']) {
      expect(html).toContain(standing);
    }
    expect(html).toContain('None exists in this prototype');
    expect(html).toContain('no security, compliance, or encryption claims');
    for (const field of ['Connection method', 'What VitalCV observed', 'Refresh', 'Sharing']) {
      expect(html).toContain(field);
    }
    expect(html).toContain('Revocable at any time');
  });

  it('an empty live garden reads as an invitation, not a fixture', async () => {
    mockData = { mode: 'live', notes: [], cvEntries: [] };
    const notesHtml = await render(CareerGardenNotesPage(sp({})));
    expect(notesHtml).toContain('No seeds yet');
    expect(notesHtml).not.toContain('Journal club reflection');
    const cvHtml = await render(CareerGardenCvPage(sp({})));
    expect(cvHtml).toContain('No lines yet — and that is the honest starting point.');
  });

  it('storage outage renders as honest read-only, never a fixture fallback', async () => {
    mockData = GARDEN_UNAVAILABLE;
    const html = await render(CareerGardenNotesPage(sp({})));
    expect(html).toContain('read-only until it returns');
    expect(html).toContain('temporarily unavailable');
    expect(html).not.toContain('Journal club reflection');
  });

  it('every page renders the section nav with an accessible current marker', async () => {
    const pages = [
      render(CareerGardenHomePage()),
      render(CareerGardenCvPage(sp({}))),
      render(CareerGardenNotesPage(sp({}))),
      render(CareerGardenResearchPage(sp({}))),
      render(CareerGardenOpportunitiesPage(sp({}))),
      render(CareerGardenPrivacyPage()),
    ];
    for (const html of await Promise.all(pages)) {
      expect(html).toContain('aria-label="Career Garden sections"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('<h1');
    }
  });
});
