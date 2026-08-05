/**
 * `/` serves the one real clinician career loop — Wave 1075.
 *
 * The cutover replaced the evidence film at the root. These pin what the
 * production homepage IS, and what it must never claim. They render the ROUTE
 * (`app/page.tsx`), not the component, so a future composition swap cannot
 * leave them asserting a page no visitor reaches — the same trap that let
 * every homepage guard stay green through the #859 film switch.
 *
 * Behaviours needing a browser (live NPI resolution, the Apply boundary,
 * reduced motion, overflow at six viewports) are pinned in
 * tests/e2e/home-career-loop.spec.ts against a real production build.
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
const LOOP = 'clh-npi';
const FILM = 'data-film-scene';

// ── 1–3 · the cutover and its rollback ──────────────────────────────────────

describe('1 — / renders the career-loop homepage by default', () => {
  it('serves the loop with no variant configured', async () => {
    const html = await renderRoot(undefined);
    expect(html).toContain(LOOP);
    expect(html).toContain('Your clinician profile');
    expect(html).toContain('Build my free profile');
  });

  it('the resolver defaults to career-loop', () => {
    expect(DEFAULT_HOME_VARIANT).toBe('career-loop');
    expect(resolveHomeVariant(undefined)).toBe('career-loop');
    expect(resolveHomeVariant('')).toBe('career-loop');
    expect(resolveHomeVariant('career-loop')).toBe('career-loop');
  });
});

describe('2 — / visibly differs from the former homepage', () => {
  it('does not ship the film composition when the loop is active', async () => {
    const html = await renderRoot('career-loop');
    expect(html).not.toContain(FILM);
    // The old headline must not survive alongside the new one.
    expect(html).not.toContain('Your career evidence, ready before your next job');
  });

  it('sends ONE composition, never both', async () => {
    const loop = await renderRoot('career-loop');
    const film = await renderRoot('film');
    expect(loop.includes(LOOP) && loop.includes(FILM)).toBe(false);
    expect(film.includes(LOOP) && film.includes(FILM)).toBe(false);
    expect(loop).not.toEqual(film);
  });
});

describe('3 — film rollback still renders', () => {
  it('serves the film when asked', async () => {
    const html = await renderRoot('film');
    expect(html).toContain(FILM);
    expect(html).not.toContain(LOOP);
    expect(html.length).toBeGreaterThan(1000);
  });

  it('an unknown value fails safe to film rather than to a blank page', () => {
    expect(FALLBACK_HOME_VARIANT).toBe('film');
    for (const bogus of ['loop', 'CAREER_LOOP', 'true', '1', 'off', 'undefined']) {
      expect(resolveHomeVariant(bogus)).toBe('film');
    }
  });

  it('is case- and whitespace-tolerant for the values it does accept', () => {
    expect(resolveHomeVariant('  FILM  ')).toBe('film');
    expect(resolveHomeVariant('Career-Loop')).toBe('career-loop');
  });
});

// ── 5–7 · identity honesty in the untouched state ───────────────────────────

describe('5–7 — the idle homepage invents no clinician', () => {
  it('7. ships no fictional clinician on the live path', () => {
    const html = renderHomepageHtml();
    for (const fixture of ['K. Osei', 'Cascade Regional', 'Blue Harbor', 'JEAN ABBOTT']) {
      expect(html, `fixture "${fixture}" reached the production homepage`).not.toContain(fixture);
    }
  });

  it('offers the illustrative example only as an explicit, labelled control', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('Load an illustrative example');
  });

  it('6. states the NPI action honestly before any lookup', () => {
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

// ── 14–15 · completion language ─────────────────────────────────────────────

describe('14–15 — nothing claims completion before a backend success', () => {
  it('15. "Start confirmed" does not exist', () => {
    expect(renderHomepageHtml()).not.toContain('Start confirmed');
  });

  it('14. no completion wording appears in the untouched state', () => {
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

// ── the truthful progression ────────────────────────────────────────────────

describe('the rail states the truthful progression and stops at review', () => {
  it('ends at Review, never at a confirmed start', () => {
    const html = renderHomepageHtml();
    /*
     * Wave 1077 retired 'Packet' from the rail: packet is machinery language
     * the strategy keeps behind the transaction, and 'Their decision' made the
     * employer's verdict the emotional endpoint. The loop still ends at
     * review.
     */
    for (const step of ['NPI', 'Profile', 'Roles', 'Apply', 'Review']) {
      expect(html).toContain(step);
    }
    expect(html).not.toContain('Packet');
    expect(html).not.toMatch(/start (confirmed|guaranteed)/i);
  });
});

// ── 17 · indexability ───────────────────────────────────────────────────────

describe('17 — the root is the indexable surface', () => {
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

// ── 16 · the design subtree never reaches canonical production ─────────────

describe('16 — /design/* is unavailable in canonical production', () => {
  it('refuses canonical production even when DESIGN_PREVIEW is set', async () => {
    const { isDesignPreviewAllowed } = await import('@/lib/design/preview');
    // The e2e server boots with DESIGN_PREVIEW=1 so other suites can drive
    // /design/*, which is exactly why this is asserted on the guard rather
    // than by fetching the route there.
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

// ── 20 · the acquisition hierarchy stays free of infrastructure language ────

describe('20 — banned vocabulary and claims stay out of the homepage', () => {
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

  it('keeps trust-tier and cryptography vocabulary out of the acquisition copy', () => {
    const html = renderHomepageHtml().toLowerCase();
    for (const term of ['sd-jwt', 'blockchain', 'merkle', 'w3c verifiable credential', 'zero-knowledge']) {
      expect(html).not.toContain(term);
    }
  });

  it('never claims blanket freshness in the acquisition hierarchy', () => {
    /*
     * Wave 1077 moved the per-lane cadence sentence OUT of the idle hero and
     * beside the resolved profile — the first moment a source has actually
     * answered, so the first moment a cadence is about anything. The
     * disclosure was relocated, not removed; homepage-truth-contract asserts
     * it renders in the resolved state.
     *
     * What must still hold at rest: the idle page makes no freshness claim it
     * cannot support.
     */
    const html = renderHomepageHtml();
    expect(html).not.toMatch(/\bread live\b/i);
    expect(html).not.toMatch(/always up to date|continuously verified/i);
    // What it does say is bounded and true.
    expect(html).toContain('Reads public sources');
  });
});
