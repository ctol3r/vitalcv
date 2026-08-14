/**
 * `/` serves the Direction-D production experience — the record builds in the
 * first viewport while the real NPI action remains available.
 *
 * These pin what the production homepage IS, and what it must never claim.
 * They render the ROUTE (`app/page.tsx`), not the component, so a future
 * composition swap cannot leave them asserting a page no visitor reaches —
 * the same trap that let every homepage guard stay green through the #859
 * film switch.
 *
 * The founder's UX-V1 removal list is asserted NEGATIVELY here: the retired
 * journey-rail vocabulary, the evidence-network framing, and the film-era
 * story may not reappear on the served homepage. Both predecessors stay
 * renderable as env-switched rollbacks and keep their own coverage.
 *
 * Behaviours needing a browser (live NPI resolution, the work-surface
 * timeline, reduced motion, overflow at multiple viewports) are pinned in
 * tests/e2e/home-easy.spec.ts against a real production build.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';
import {
  DEFAULT_HOME_VARIANT,
  FALLBACK_HOME_VARIANT,
  resolveHomeVariant,
} from '@/lib/home/variant';

const ORIGINAL = process.env.PUBLIC_HOME_VARIANT;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PUBLIC_HOME_VARIANT;
  else process.env.PUBLIC_HOME_VARIANT = ORIGINAL;
  vi.resetModules();
});

/** Render `/` under a given variant, re-importing so the env read is fresh. */
async function renderRoot(variant?: string): Promise<string> {
  if (variant === undefined) delete process.env.PUBLIC_HOME_VARIANT;
  else process.env.PUBLIC_HOME_VARIANT = variant;
  vi.resetModules();
  const mod = await import('@/app/page');
  const React = await import('react');
  return renderToStaticMarkup(React.createElement(mod.default));
}

/** Markers unique to each composition. */
const EASY = 'ezh-npi';
const LOOP = 'clh-npi';
const FILM = 'data-film-scene';

// ── 1–3 · the cutover and its rollbacks ─────────────────────────────────────

describe('1 — / renders the UX-V1 experience by default', () => {
  it('serves the Easy Button hero with no variant configured', async () => {
    const html = await renderRoot(undefined);
    expect(html).toContain(EASY);
    expect(html).toContain('The Provider Career Evidence Network.');
    expect(html).toContain('One career record. More ways forward.');
    expect(html).toContain('Start my CV Wallet');
    expect(html).toContain('Explore clinician opportunities');
    expect(html).toContain('data-home-work-surface');
  });

  it('the resolver defaults to easy', () => {
    expect(DEFAULT_HOME_VARIANT).toBe('easy');
    expect(resolveHomeVariant(undefined)).toBe('easy');
    expect(resolveHomeVariant('')).toBe('easy');
    expect(resolveHomeVariant('easy')).toBe('easy');
  });
});

describe('2 — / visibly differs from every former homepage', () => {
  it('ships neither predecessor composition when easy is active', async () => {
    const html = await renderRoot('easy');
    expect(html).not.toContain(FILM);
    expect(html).not.toContain(LOOP);
  });

  it('the retired story vocabulary does not survive the cutover', async () => {
    const html = await renderRoot(undefined);
    for (const retired of [
      'A number becomes a career',
      'Work that fits more than a résumé',
      'Get hired for the right opportunity',
      'The packet',
      'Their decision',
      'The same profile, handed over',
      'Review starts ahead, not from zero',
      'Your career evidence, ready before your next job',
    ]) {
      expect(html, `retired copy "${retired}" reached the UX-V1 homepage`).not.toContain(retired);
    }
  });

  it('sends ONE composition, never several', async () => {
    const easy = await renderRoot('easy');
    const loop = await renderRoot('career-loop');
    const film = await renderRoot('film');
    for (const html of [easy, loop, film]) {
      const markers = [EASY, LOOP, FILM].filter((m) => html.includes(m));
      expect(markers.length).toBe(1);
    }
    expect(easy).not.toEqual(loop);
    expect(easy).not.toEqual(film);
  });
});

describe('3 — both rollbacks still render', () => {
  it('serves the career loop when asked', async () => {
    const html = await renderRoot('career-loop');
    expect(html).toContain(LOOP);
    expect(html).toContain('Get hired for the right opportunity');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('serves the film when asked', async () => {
    const html = await renderRoot('film');
    expect(html).toContain(FILM);
    expect(html).not.toContain(EASY);
    expect(html.length).toBeGreaterThan(1000);
  });

  it('an unknown value fails safe to film rather than to a blank page', () => {
    expect(FALLBACK_HOME_VARIANT).toBe('film');
    for (const bogus of ['loop', 'EASY_MODE', 'true', '1', 'off', 'undefined']) {
      expect(resolveHomeVariant(bogus)).toBe('film');
    }
  });

  it('is case- and whitespace-tolerant for the values it does accept', () => {
    expect(resolveHomeVariant('  FILM  ')).toBe('film');
    expect(resolveHomeVariant('Easy')).toBe('easy');
    expect(resolveHomeVariant('Career-Loop')).toBe('career-loop');
  });
});

// ── identity honesty in the untouched state ─────────────────────────────────

describe('the idle homepage invents no clinician', () => {
  it('ships no fictional clinician on the live path', () => {
    const html = renderHomepageHtml();
    for (const fixture of ['K. Osei', 'Cascade Regional', 'Blue Harbor', 'JEAN ABBOTT']) {
      expect(html, `fixture "${fixture}" reached the production homepage`).not.toContain(fixture);
    }
  });

  it('the explainer is labelled illustrative and renders no NPI digits', () => {
    const html = renderHomepageHtml();
    expect(html).toMatch(/illustrative/i);
    // The masked seed renders bullet glyphs, never ten digits.
    expect(html).not.toMatch(/\d{10}/);
  });

  it('the old demo-fixture control is gone — the illustration replaced it', () => {
    expect(renderHomepageHtml()).not.toContain('Load an illustrative example');
  });

  it('states the NPI action honestly before any lookup', () => {
    const html = renderHomepageHtml();
    // Countable progress, not an implied result.
    expect(html).toContain('0/10 digits');
    expect(html).not.toMatch(/\bverified\b/i);
  });

  it('names no readiness verdict, score or band at rest', () => {
    const html = renderHomepageHtml();
    for (const leak of ['matchBand', 'matchScore', 'INELIGIBLE', 'readiness score', 'profileCompleteness']) {
      expect(html).not.toContain(leak);
    }
  });
});

// ── completion language ─────────────────────────────────────────────────────

describe('nothing claims completion before a backend success', () => {
  it('"Start confirmed" does not exist', () => {
    expect(renderHomepageHtml()).not.toContain('Start confirmed');
  });

  it('no completion wording appears in the untouched state', () => {
    const html = renderHomepageHtml();
    for (const banned of [
      'Start confirmed', 'Credentialing complete', 'Cleared', 'Fully verified',
      'Guaranteed start', 'Application submitted', 'Employer received', 'Delivered',
    ]) {
      expect(html, `"${banned}" must not render before a real backend event`).not.toContain(banned);
    }
  });

  it('says outright that nothing has been sent', () => {
    expect(renderHomepageHtml()).toContain('nothing has been sent');
  });

  it('keeps the institution as the deciding step', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-truth-boundary');
    expect(html).toMatch(/institution review/i);
  });
});

// ── the work surface tells the truthful progression ─────────────────────────

describe('the work surface states record truth without manufacturing an outcome', () => {
  it('names source state, control, and access limits in the first viewport', () => {
    const html = renderHomepageHtml();
    for (const line of [
      'CV Wallet',
      'Identity',
      'Source-backed',
      'Access required',
      'Needs your review',
      'Choose what you share',
    ]) {
      expect(html).toContain(line);
    }
    expect(html).not.toMatch(/start (confirmed|guaranteed)/i);
  });

  it('labels sources and limitations while keeping the sharing boundary explicit', () => {
    const html = renderHomepageHtml();
    for (const source of ['NPPES', 'State board']) {
      expect(html).toContain(source);
    }
    expect(html).toContain('nothing has been sent');
  });

  it('the mobility sequence names clinician choice and institution review honestly', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('Employer review');
    expect(html).toContain('You select what the employer may review.');
    expect(html).toContain('Only after the employer records that decision.');
  });
});

// ── indexability ────────────────────────────────────────────────────────────

describe('the root is the indexable surface', () => {
  it('the root page declares no noindex', async () => {
    const mod = await import('@/app/page');
    const robots = (mod.metadata as { robots?: unknown } | undefined)?.robots;
    expect(robots).toBeUndefined();
  });

  it('root metadata describes the actual product, not credentialing plumbing', async () => {
    const mod = await import('@/app/page');
    const meta = mod.metadata as { title?: { absolute?: string }; description?: string };
    const copy = `${meta.title?.absolute ?? ''} ${meta.description ?? ''}`.toLowerCase();
    expect(copy).toMatch(/npi/);
    expect(copy).toMatch(/profile/);
    expect(copy).toMatch(/apply/);
    // SEO must not lead with infrastructure vocabulary.
    expect(copy).not.toMatch(/sd-jwt|blockchain|verifiable credential|trust tier/);
  });

  it('canonical still points at the bare root', async () => {
    const mod = await import('@/app/page');
    const meta = mod.metadata as { alternates?: { canonical?: string } };
    expect(meta.alternates?.canonical).toBe('https://vitalcv.com');
  });
});

// ── /design/* never reaches canonical production ────────────────────────────

describe('/design/* is unavailable in canonical production', () => {
  it('refuses canonical production even when DESIGN_PREVIEW is set', async () => {
    const { isDesignPreviewAllowed } = await import('@/lib/design/preview');
    expect(isDesignPreviewAllowed({
      NODE_ENV: 'production', RAILWAY_ENVIRONMENT: 'production', DESIGN_PREVIEW: '1',
    })).toBe(false);
    expect(isDesignPreviewAllowed({
      NODE_ENV: 'production', VERCEL_ENV: 'production', DESIGN_PREVIEW: '1',
    })).toBe(false);
  });

  it('still allows a non-canonical production build to serve references', async () => {
    const { isDesignPreviewAllowed } = await import('@/lib/design/preview');
    expect(isDesignPreviewAllowed({ NODE_ENV: 'production', DESIGN_PREVIEW: '1' })).toBe(true);
    expect(isDesignPreviewAllowed({ NODE_ENV: 'production' })).toBe(false);
  });
});

// ── banned vocabulary and claims stay out of the homepage ───────────────────

describe('banned vocabulary and claims stay out of the homepage', () => {
  it('makes no credentialing or verification guarantee', () => {
    const html = renderHomepageHtml();
    for (const banned of [
      'automatically verified', 'guaranteed verification', 'complete credentialing',
      'instant credentialing', 'legally accepted', 'risk transferred',
      'certified compliant', 'HIPAA compliant', 'SOC2 certified',
    ]) {
      expect(html.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  it('keeps infrastructure vocabulary out of the acquisition copy', () => {
    const html = renderHomepageHtml().toLowerCase();
    for (const term of [
      'sd-jwt', 'blockchain', 'merkle', 'w3c verifiable credential', 'zero-knowledge',
      'provenance', 'trust tier', 'dossier',
    ]) {
      expect(html).not.toContain(term);
    }
  });

  it('states source cadence rather than a blanket "live"', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-source-cadence');
    // The one lane genuinely read per request is named; the snapshots are not
    // allowed to inherit its freshness.
    expect(html).toMatch(/snapshot/i);
  });
});
