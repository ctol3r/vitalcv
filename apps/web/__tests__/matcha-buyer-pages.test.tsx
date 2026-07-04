// Enable the buyer-pages flag BEFORE importing the page modules (flags read env at load).
process.env.NEXT_PUBLIC_FEATURE_MATCHA_BUYER_PAGES = 'true';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Full banned-string list from CLAUDE.md truth contract.
const BANNED = [
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'risk transferred',
  'final verification without review',
  'source confirmed before response',
  'certified compliant',
  'hipaa compliant',
  'soc2 certified',
];

function expectClean(markup: string) {
  const lower = markup.toLowerCase();
  for (const phrase of BANNED) {
    expect(lower).not.toContain(phrase);
  }
}

const PAGES: Array<{ name: string; path: string }> = [
  { name: 'recruiters', path: '../app/matcha/recruiters/page' },
  { name: 'hospitals', path: '../app/matcha/hospitals/page' },
  { name: 'investors', path: '../app/matcha/investors/page' },
];

describe('MATCHA buyer pages — honest copy', () => {
  for (const page of PAGES) {
    it(`${page.name}: renders without any banned truth-contract strings`, async () => {
      const { default: Page } = await import(page.path);
      const markup = renderToStaticMarkup(<Page />);
      expect(markup.length).toBeGreaterThan(500);
      expectClean(markup);
    });

    it(`${page.name}: carries the "not customer-reported results" honesty disclaimer`, async () => {
      const { default: Page } = await import(page.path);
      const markup = renderToStaticMarkup(<Page />);
      // Each page frames benefits as directional / illustrative, not customer results.
      expect(markup.toLowerCase()).toContain('not customer-reported results');
    });
  }

  it('investors page renders the compounding-loop ecosystem stages', async () => {
    const { default: Page } = await import('../app/matcha/investors/page');
    const markup = renderToStaticMarkup(<Page />);
    expect(markup).toContain('Network effects');
    expect(markup).toContain('MATCHA');
    expect(markup).toContain('Recognition');
  });
});
