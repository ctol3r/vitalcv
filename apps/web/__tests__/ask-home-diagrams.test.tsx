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

  it('names the parts of each diagram', () => {
    for (const label of ['role', 'your record', 'you', 'employer', 'your permission']) {
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
    const css = readFileSync(join(__dirname, '..', 'styles', 'ask-home.css'), 'utf8');

    // Every ask-art keyframe reference must sit inside the no-preference
    // media block, so reduced-motion readers get the final frame instantly.
    const noPref = css.split('@media (prefers-reduced-motion: no-preference)')[1] ?? '';
    expect(noPref).toContain('ask-art-appear');
    expect(noPref).toContain('ask-art-draw');
    const outside = css.replace(noPref, '');
    expect(outside).not.toMatch(/animation:.*ask-art/);

    // CD-11: nothing idles. One play, no loop.
    expect(css).not.toMatch(/ask-art[^}]*animation[^;]*infinite/);
  });
});
