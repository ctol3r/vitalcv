/**
 * Homepage diagram contracts — comprehension and motion honesty.
 *
 * The two illustrative diagrams ("See what actually fits." and "Your
 * evidence. Your permission.") shipped as unlabeled shapes: no accessible
 * name, no part labels, and no motion anywhere on the page. The fix animates
 * each diagram's state sequence once on entry (CD-11: then it rests) and
 * names the diagram parts in plain words.
 *
 * The honesty line these tests hold: part names ("role", "your record",
 * "you", "employer", "your permission") are captions for the drawing. STATE
 * words ("verified", "checked", "live", source names, freshness) would be
 * claims, and an illustrative drawing may never make one.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/analytics/funnel', () => ({
  FUNNEL_EVENTS: new Proxy({}, { get: (_t, k) => String(k) }),
  trackFunnelEvent: () => undefined,
}));

let html = '';

beforeAll(async () => {
  const { AskHome } = await import('@/components/home/ask/AskHome');
  html = renderToStaticMarkup(React.createElement(AskHome));
});

describe('the hero is evidence-led', () => {
  it('carries the settled headline, not the speed promise', () => {
    expect(html).toContain('Your career evidence, ready before your next job.');
    expect(html).not.toContain('Get hired faster');
  });
});

describe('diagrams are understandable without motion or sight', () => {
  it('every illustrative svg has an accessible name', () => {
    const svgs = (html.match(/<svg[^>]*>/g) ?? []).filter((tag) =>
      /class="ask-art[ "]/.test(tag),
    );
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    for (const tag of svgs) {
      expect(tag).toContain('role="img"');
      expect(tag).toContain('aria-label=');
    }
  });

  it('names the parts of each diagram, in clinical vocabulary', () => {
    // "ER role" and "the hospital" rather than "role" and "employer" — the
    // founder's 2026-07-27 review of the generic labels was "I can't tell
    // this is for clinicians". The parts must be named AND the names must
    // say healthcare.
    for (const label of ['er role', 'your record', 'you', 'the hospital', 'your permission']) {
      expect(html.toLowerCase()).toContain(`>${label}<`);
    }
    // The wide chapter artifacts speak the same grammar: check categories and
    // regions, never sources or states (the ban below still applies to them).
    for (const label of ['your npi', 'identity', 'exclusions', 'enrollment', 'receipt', 'the packet', 'what is missing']) {
      expect(html.toLowerCase()).toContain(`>${label}<`);
    }
  });

  it('labels caption the drawing, never the state of data', () => {
    // Extract only the diagram <text> content; the page legitimately says
    // e.g. "checks" in prose.
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) =>
      m[1].toLowerCase(),
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      for (const stateWord of ['verified', 'checked', 'live', 'nppes', 'oig', 'pecos', 'fresh']) {
        expect(t).not.toContain(stateWord);
      }
    }
  });

  it('keeps the illustrative caption on every drawn figure', () => {
    expect(html).toContain('Illustrative — not a live result');
  });
});

describe('motion is explain-on-entry, then rest', () => {
  it('static markup is the FINAL composition — no play class before JS runs', () => {
    // The no-JS/reduced-motion contract: the base page is the complete
    // picture. The observer adds `ask-art-play` at runtime; it must never be
    // serialized into the static render.
    expect(html).not.toContain('ask-art-play');
    expect(html).toContain('ask-art-step-1');
    expect(html).toContain('ask-art-step-3');
  });

  it('the stylesheet animates only under prefers-reduced-motion: no-preference', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    // The animation references moved from ask-home.css to the shared
    // artifact-motion.css when the pattern went site-wide (employers, trust,
    // pilot). The contract is unchanged; only the file carrying it moved.
    const css = readFileSync(join(__dirname, '..', 'styles', 'artifact-motion.css'), 'utf8');
    const askCss = readFileSync(join(__dirname, '..', 'styles', 'ask-home.css'), 'utf8');
    const motion = readFileSync(join(__dirname, '..', 'styles', 'motion.css'), 'utf8');

    // Every ask-art animation REFERENCE must sit inside the no-preference
    // media block, so reduced-motion readers get the final frame instantly.
    const noPref = css.split('@media (prefers-reduced-motion: no-preference)')[1] ?? '';
    expect(noPref).toContain('ask-art-appear');
    expect(noPref).toContain('ask-art-draw');
    const outside = css.replace(noPref, '');
    expect(outside).not.toMatch(/animation:.*ask-art/);
    // ...and ask-home.css may no longer carry ANY animation reference — a
    // rule reintroduced there would dodge the guard above.
    expect(askCss).not.toMatch(/animation:.*ask-art/);

    // The DEFINITIONS live in the house motion file — the one place LINT-03
    // permits keyframe definitions — and only there.
    expect(css).not.toMatch(/@keyframes/);
    expect(askCss).not.toMatch(/@keyframes/);
    expect(motion).toContain('@keyframes ask-art-appear');
    expect(motion).toContain('@keyframes ask-art-draw');

    // CD-11: nothing idles. One play, no loop, in any of the three files.
    expect(css).not.toMatch(/ask-art[^}]*animation[^;]*infinite/);
    expect(askCss).not.toMatch(/ask-art[^}]*animation[^;]*infinite/);
    expect(motion).not.toMatch(/ask-art[^}]*infinite/);
  });
});
