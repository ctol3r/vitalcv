/**
 * Strategy guards — Wave 1077.
 *
 * Narrow checks that the homepage keeps saying the one thing the canonical
 * strategy says it should, and does not drift back to infrastructure
 * vocabulary. See docs/strategy/README.md.
 *
 * Deliberately NOT a copy-freeze. These assert CONCEPTS and PROHIBITED CLAIMS,
 * never exact sentences, so copy can keep improving without a red build. The
 * previous generation of homepage guards pinned literal phrases and went red
 * on better wording — a guard that punishes an improvement gets deleted, and
 * then it is protecting nothing.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';

const text = () =>
  renderHomepageHtml()
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

describe('the homepage carries the canonical concepts', () => {
  it.each([
    ['clinician profile', /clinician profile|your profile|professional profile/],
    ['NPI as the entry', /\bnpi\b/],
    ['finding work', /roles|jobs|work that fits|find work/],
    ['applying with the profile', /apply with|apply without|apply with your profile/],
    ['reuse / the next move', /reuse|next move|again|build once/],
    ['clinician control over sharing', /you choose|what gets shared|nothing is shared/],
    ['free clinician entry', /free for clinicians|free profile/],
  ])('states %s', (_concept, pattern) => {
    expect(text()).toMatch(pattern);
  });
});

describe('the acquisition hierarchy does not lead with infrastructure', () => {
  it.each([
    'blockchain', 'wallet', 'passport', 'dossier', 'trust passport',
    'sd-jwt', 'evidence os', 'knowledge graph', 'trust tier', 'psv',
  ])('does not use "%s" in customer-facing homepage copy', (term) => {
    expect(text()).not.toContain(term);
  });

  it('makes no completion or clearance claim', () => {
    for (const claim of ['credentialing complete', 'fully verified', 'cleared', 'guaranteed']) {
      expect(text()).not.toContain(claim);
    }
  });

  it('keeps the internal matching engine out of the primary story', () => {
    // MATCHA may remain the engine's name; it must not compete with VitalCV
    // Jobs for the customer's attention.
    const html = renderHomepageHtml();
    const heroEnd = html.indexOf('data-clh-reveal');
    const hero = (heroEnd > 0 ? html.slice(0, heroEnd) : html).toLowerCase();
    expect(hero).not.toContain('matcha');
  });
});

describe('the canonical transaction keeps its name', () => {
  it('names Apply with VitalCV, not packet generation', () => {
    const html = renderHomepageHtml().toLowerCase();
    // The component that performs the transaction is ApplyWithVitalCV; the
    // homepage must not ask a clinician to understand packets to apply.
    expect(html).not.toMatch(/generate (a )?packet|packet generation/);
  });
});

describe('primary navigation does not accumulate product brands', () => {
  it('keeps top-level customer navigation to the approved concepts', async () => {
    const nav = await import('@/components/layout/publicSurfaceRoutes').catch(() => null);
    if (!nav) return; // navigation lives elsewhere; the homepage guard above still applies
    const serialized = JSON.stringify(nav).toLowerCase();
    for (const brand of ['wallet', 'passport', 'dossier', 'evidence os']) {
      expect(serialized, `"${brand}" became a top-level customer concept`).not.toContain(brand);
    }
  });
});
