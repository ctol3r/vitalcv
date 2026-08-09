/**
 * The homepage sells job matching. These pin the line it may not cross.
 *
 * The section exists to sell a category ("a job board that reads your
 * credentials") on the strength of the MATCHA engine — which really does hard-
 * gate on credential requirements and explain each result. What it must never
 * do is sell INVENTORY. VitalCV does not have a stocked board, and a volume
 * claim on the homepage would be a promise the product cannot keep the moment
 * a visitor enters an NPI and the feed comes back empty.
 *
 * The illustrative readout is held to the same rule the hero's work surface is:
 * it may show the SHAPE of a match, and it may not invent an employer. A demo
 * fixture wearing a real health system's name is exactly how a fabricated
 * posting reached production once already — see
 * `services/opportunities/__tests__/launchOpportunityRetirement.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';

const html = renderHomepageHtml();

/** Tags stripped, entities decoded enough to match prose across element joins. */
const text = html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&mdash;/g, '—')
  .replace(/&rsquo;/g, '’')
  .replace(/&middot;/g, '·')
  .replace(/&eacute;/g, 'é')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

describe('homepage — the matching section is present', () => {
  it('renders the matching section on the served route', () => {
    expect(html).toContain('data-home-matching');
  });

  it('sells the credential-aware differentiator, not a keyword board', () => {
    expect(text).toContain('reads your credentials, not your keywords');
    expect(text).toMatch(/scores a role against\s+what your record already shows/i);
  });

  it('promises an explanation and a blocker, which the engine actually produces', () => {
    // matchaEngine returns MatchExplanation + MatchBlocker and hard-gates on
    // credentials; these two claims are the ones backed by real behaviour.
    expect(text).toMatch(/every match explains itself/i);
    expect(text).toMatch(/blockers before you apply/i);
  });
});

describe('homepage — no inventory claim', () => {
  /**
   * Volume language. The board's size is not something the homepage may assert:
   * it is whatever the Opportunity table holds at request time, which today is
   * small and may legitimately be zero for a given clinician.
   */
  const INVENTORY_CLAIMS: ReadonlyArray<RegExp> = [
    /\b\d[\d,.]*\+?\s*(?:open\s+)?(?:jobs|roles|positions|openings|listings)\b/i,
    /\bthousands\s+of\s+(?:jobs|roles|positions|openings)\b/i,
    /\bhundreds\s+of\s+(?:jobs|roles|positions|openings)\b/i,
    /\bevery\s+healthcare\s+job\b/i,
    /\bmillions\s+of\b/i,
    /\bbrowse\s+\d/i,
    /\ball\s+the\s+(?:jobs|roles|openings)\b/i,
    /\blargest\b/i,
  ];

  it('states no number of roles anywhere on the page', () => {
    for (const pattern of INVENTORY_CLAIMS) {
      expect(text, `inventory claim on the homepage: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('scopes matching to the roles VitalCV actually has', () => {
    expect(text).toMatch(/doesn’t crawl the rest of\s+the internet/i);
    expect(text).toMatch(/says nothing fits instead of padding the list/i);
  });
});

describe('homepage — the readout invents nobody', () => {
  it('labels the match readout illustrative', () => {
    expect(text).toMatch(/Illustrative — the shape of a match, not a real posting/i);
  });

  it('names no employer in the readout', () => {
    // Every organization the demo fixture has ever carried, plus the real
    // health system it once impersonated.
    for (const org of [
      'Kaiser',
      'Permanente',
      'Northgate Valley',
      'Bay Area Cardiac',
      'MindBridge',
      'Sacramento Medical Center',
      'Northwest Locums',
    ]) {
      expect(text, `employer name "${org}" reached the homepage`).not.toContain(org);
    }
  });

  it('makes no verification claim in the new copy', () => {
    // The page-wide ban lives in homepage-truth-contract; this keeps the
    // matching section honest on its own terms as it gets edited.
    expect(text).not.toMatch(/\bverified\b/i);
    expect(text).not.toMatch(/\bpre-?screened\b/i);
    expect(text).not.toMatch(/\bguaranteed\b/i);
  });
});
