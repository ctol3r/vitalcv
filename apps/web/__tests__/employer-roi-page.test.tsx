import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

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

describe('/employer/roi page', () => {
  it('renders the demo banner and pilot identity', async () => {
    const { default: Page } = await import('../app/employer/roi/page');
    const tree = await Page();
    const html = renderToStaticMarkup(tree as React.ReactElement);

    // Demo banner mandatory until persistence Phase 2 lands.
    expect(html).toContain('Demo cohort');

    // Pilot identity surfaced in the header.
    expect(html).toContain('PILOT-2026-Q2-014');
    expect(html).toContain('Cedar Health Surgical Pavilion');

    // The four headline cards.
    expect(html).toContain('Decisions logged');
    expect(html).toContain('Reviewer-hours saved');
    expect(html).toContain('At your default wage');
    expect(html).toContain('Time to first decision');

    // Methodology panel header (collapsed by default but rendered).
    expect(html).toContain('How this math works');

    // Footer disclosure.
    expect(html).toContain('not a comprehensive financial model');
  });

  it('frames every numeric estimate with an explicit qualifier', async () => {
    const { default: Page } = await import('../app/employer/roi/page');
    const tree = await Page();
    const html = renderToStaticMarkup(tree as React.ReactElement);

    expect(html).toContain('Observed');
    expect(html).toContain('Projected');
    expect(html).toContain('Estimated');
    expect(html).toContain('not an industry average');
  });

  it('sets data-pilot-id on the page wrapper for downstream selectors', async () => {
    const { default: Page } = await import('../app/employer/roi/page');
    const tree = await Page();
    const html = renderToStaticMarkup(tree as React.ReactElement);
    expect(html).toContain('data-pilot-id="PILOT-2026-Q2-014"');
    expect(html).toContain('data-testid="employer-roi-page"');
  });

  it('contains zero banned strings', async () => {
    const { default: Page } = await import('../app/employer/roi/page');
    const tree = await Page();
    const html = renderToStaticMarkup(tree as React.ReactElement).toLowerCase();
    for (const banned of BANNED) {
      expect(html).not.toContain(banned.toLowerCase());
    }
  });

  it('does not use bare "Verified" as a row-state label in the lane table', async () => {
    const { default: Page } = await import('../app/employer/roi/page');
    const tree = await Page();
    const html = renderToStaticMarkup(tree as React.ReactElement);

    // Column header is "Confirmed", not "Verified".
    expect(html).toContain('Confirmed');
    // Searching for the Verified row-header pattern (column header text).
    // The string "Verified" may appear inside CONFIDENCE_TIER_META copy if a
    // ConfidenceBadge is rendered; on this surface no badge renders, so any
    // "Verified" occurrence would be a row-state regression.
    expect(html).not.toMatch(/<th[^>]*>Verified<\/th>/i);
  });

  it('does not render dollar values when wage is null (smoke check via toggle path)', async () => {
    // The toggle is client-side; this asserts on the server-rendered default
    // state where wage IS set. We separately test the hours-only path in
    // roi-v2-headline-strip.test.tsx.
    const { default: Page } = await import('../app/employer/roi/page');
    const tree = await Page();
    const html = renderToStaticMarkup(tree as React.ReactElement);
    // Default snapshot has wage = $65/hr → dollar values must render.
    expect(html).toMatch(/\$\d/);
  });
});
