/**
 * Homepage truth-contract guards — pointed at the ROUTE.
 *
 * History worth keeping: this file used to render `app/HomePageClient` and
 * assert the vertical stacked composition (journey grid, chapter anchors, H2
 * cap, proof-moment placement). When `/` switched to the six-scene film in
 * #859, every one of those assertions kept passing while describing a page no
 * visitor could reach — the whole vitest suite went green and proved nothing
 * about the homepage.
 *
 * What survives here is the part that was never about a composition: the claims
 * the homepage is forbidden to make, and the disclosures it is required to
 * carry. Those are properties of `/` itself, so they now render `/` itself and
 * cannot be orphaned by the next redesign.
 *
 * The retired structural assertions are NOT re-homed on HomePageClient. That
 * component remains on disk as the documented rollback target, and asserting a
 * rollback target as though it were live is exactly the failure this file is
 * being fixed for. The film's own composition is covered end-to-end by
 * `tests/e2e/film-composition.spec.ts`.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';

/**
 * Claims the public homepage may never make. Several are absolute-verification
 * language the truth contract bans outright; the bare word `verified` is
 * included because a status label reading only "Verified" asserts a completed
 * determination VitalCV does not make.
 */
const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\binstant\s+credentialing\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\bautomatically\s+verified\b/i,
  /\blegally\s+accepted\b/i,
  /\brisk\s+transferred\b/i,
  /\bcertified\s+compliant\b/i,
  /\bHIPAA\s+compliant\b/i,
  /\bSOC2\s+certified\b/i,
  /\bNCQA\s+certified\b/i,
  /\bGet\s+verified\b/i,
  /\baccepted\s+everywhere\b/i,
];

describe('homepage — banned claims', () => {
  it('makes no absolute verification claim anywhere in the server render', () => {
    const html = renderHomepageHtml();
    for (const pattern of BANNED_PATTERNS) {
      expect(html, `banned claim on the homepage: ${pattern}`).not.toMatch(pattern);
    }
  });
});

describe('homepage — required disclosures', () => {
  it('names the institution as the final step', () => {
    // The one non-negotiable boundary: whatever the page shows, the hiring
    // institution still decides. Retained through three homepage rewrites.
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-truth-boundary');
    expect(html).toMatch(/institution review/i);
  });

  it('states each source lane at its real cadence, from the canonical registry', () => {
    // Guards the #822/#817/#824 fix: the homepage may not imply that snapshot
    // sources are read per request. The sentence is derived from
    // lib/trust/sourceLanes.ts, so it cannot drift from /status.
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-source-cadence');
    expect(html).toContain('read live');
    expect(html).toContain('monthly snapshot');
    expect(html).toContain('quarterly snapshot');
    expect(html).toContain('access-gated');
  });

  it('labels its own product imagery illustrative', () => {
    const html = renderHomepageHtml();
    expect(html).toMatch(/illustrative/i);
  });

  it('keeps the NPI action honest and free', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-primary-cta');
    // E.2 wraps the count number in the pop span, so match through the tag.
    expect(html).toMatch(/0(?:<\/span>)?\/10 digits/);
    expect(html).toContain('Free for clinicians');
  });
});

describe('homepage — no fabricated state', () => {
  it('invents no readiness score', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('72%');
    expect(html).not.toMatch(/\b\d{1,3}% ready\b/i);
  });

  it('ships no fixture career graph on the acquisition page', () => {
    // Mandate guardrail 3 — evidence may appear as fragments or traces, never
    // as a node-link graph of invented people and employers.
    const html = renderHomepageHtml();
    expect(html).not.toContain('data-home-evidence-field');
    expect(html).not.toContain('data-field-edges');
    expect(html).not.toContain('data-field-signal');
  });
});

describe('homepage — document outline', () => {
  it('has exactly one h1', () => {
    // The film's first cut rendered every scene as an h2, leaving `/` with no
    // h1 at all. Structural, and invisible to a screenshot.
    const html = renderHomepageHtml();
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });
});
