/**
 * homepage-truth-pass.test.tsx — locks the homepage truth fixes:
 *  1. The hero carries no fabricated readiness percentage. (The static
 *     WalletPreview mockup was replaced by a client-only illustrative graph,
 *     since itself superseded; the anti-fabrication guard here is that no
 *     invented score — e.g. "72%" — reaches the homepage server render.)
 *  2. The hero NPI input still renders its count + honest microcopy (checksum
 *     gating behavior is covered by lib/vital/npi unit tests).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));
vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
}));

import { renderHomepageHtml } from './helpers/render-homepage';

describe('Hero — no fabricated readiness score', () => {
  it('renders no invented readiness percentage on the homepage', () => {
    const html = renderHomepageHtml();
    // The hero previously shipped a static wallet mockup; guard that no
    // fabricated readiness percentage ever reaches the homepage.
    expect(html).not.toContain('72%');
    expect(html).not.toMatch(/\b\d{1,3}% ready\b/i);
  });
});

describe('Hero NPI input — honest microcopy intact', () => {
  it('renders the digit count at rest', () => {
    const html = renderHomepageHtml();
    // E.2 wraps the count number in the pop span, so match through the tag.
    expect(html).toMatch(/0(?:<\/span>)?\/10 digits/);
  });
});
