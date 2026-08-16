/**
 * The homepage exposes the real anonymous opportunity feed immediately below
 * the hero. SSR carries an honest loading boundary, then the client renders
 * only service-returned roles — never a fixture dressed as inventory.
 *
 * This file pins the static contract. Browser coverage owns the fetched rows,
 * source URL, observation time, availability wording, and the external-versus-
 * integrated application boundary.
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

describe('homepage — the public opportunity horizon is present', () => {
  it('renders the acquisition surface directly on the served route', () => {
    expect(html).toContain('data-home-opportunity-horizon');
    // The Roles heading (amendment E): the feed framed by the
    // match-explanation figure, scored on the record rather than keywords.
    expect(text).toContain('A job board that reads your credentials, not your keywords.');
    expect(html).toContain('href="/explore"');
  });

  it('server-renders an honest pending state instead of fictional inventory', () => {
    expect(text).toContain('Reading the current opportunity feed…');
    expect(text).not.toMatch(/Internal Medicine · California/i);
  });

  it('states the external and integrated application boundary before results load', () => {
    expect(text).toContain('Public-feed roles open at their original source.');
    expect(text).toContain(
      'Apply with VitalCV appears only for opportunities connected to VitalCV.',
    );
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

  it('names no employer before the real feed answers', () => {
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

  it('makes no verification or automatic-eligibility claim', () => {
    // The page-wide ban lives in homepage-truth-contract; this keeps the
    // matching section honest on its own terms as it gets edited.
    expect(text).not.toMatch(/\bverified\b/i);
    expect(text).not.toMatch(/\bpre-?screened\b/i);
    expect(text).not.toMatch(/\bguaranteed\b/i);
    expect(text).not.toMatch(/ready now/i);
    expect(text).not.toMatch(/automatically eligible/i);
  });
});
