/**
 * Homepage artifact contracts after the four-step-spine promotion.
 *
 * The homepage carries two illustrative SVGs — NPI resolution and the packet
 * handoff — plus a real interactive proof inspector and one live source ledger.
 * Drawings name their parts, never pretend to be source results, and ship their
 * complete resting frame for no-JS and reduced-motion readers.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/analytics/funnel', () => ({
  FUNNEL_EVENTS: new Proxy({}, { get: (_target, key) => String(key) }),
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

  it('renders one four-step spine instead of the retired section stack', () => {
    expect(html).toContain('data-home-spine');
    expect(html.match(/role="tab"/g)).toHaveLength(9); // four spine tabs + five inspector claims
    expect(html).not.toContain('class="ask-chapter"');
    expect(html).not.toContain('class="ask-beat"');
  });
});

describe('artifacts are understandable without motion or sight', () => {
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

  it('names the parts of the NPI and packet-handoff drawings', () => {
    const labels = [
      'your npi',
      'identity',
      'exclusions',
      'enrollment',
      'receipt',
      'your record',
      'the packet',
      'your review',
      'what is missing',
      'source + time on every claim',
      'your decision, your committee',
    ];
    const lower = html.toLowerCase();
    for (const label of labels) expect(lower).toContain(`>${label}<`);
  });

  it('labels caption the drawing, never the state of data', () => {
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) =>
      match[1].toLowerCase(),
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      for (const stateWord of ['verified', 'checked', 'live', 'nppes', 'oig', 'pecos', 'fresh']) {
        expect(text).not.toContain(stateWord);
      }
    }
  });

  it('labels both drawings and the proof inspector as illustrative', () => {
    expect(html.match(/Illustrative — not a live result/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('keeps the proof inspector and live source ledger outside glass', () => {
    const ledgerStart = html.indexOf('data-home-lane-ledger');
    expect(ledgerStart).toBeGreaterThan(0);
    const ledgerPanel = html.slice(
      html.lastIndexOf('<div id="spine-panel-evidence"', ledgerStart),
      html.indexOf('</div><div id="spine-panel-packet"', ledgerStart),
    );
    expect(ledgerPanel).not.toContain('vt-artifact--glass');
    expect(ledgerPanel).not.toContain('Illustrative — not a live result');

    const inspectorStart = html.indexOf('data-proof-packet-inspector');
    expect(inspectorStart).toBeGreaterThan(0);
    const inspectorWrapper = html.slice(
      html.lastIndexOf('<div data-ask-artifact="once"', inspectorStart),
      inspectorStart,
    );
    expect(inspectorWrapper).not.toContain('vt-artifact--glass');
  });
});

describe('motion is explain-on-entry, then rest', () => {
  it('static markup is the final composition — no play class before JS runs', () => {
    expect(html).not.toContain('ask-art-play');
    expect(html).toContain('ask-art-step-1');
    expect(html).toContain('ask-art-step-3');
  });

  it('the stylesheet animates only under prefers-reduced-motion: no-preference', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(__dirname, '..', 'styles', 'artifact-motion.css'), 'utf8');
    const askCss = readFileSync(join(__dirname, '..', 'styles', 'ask-home.css'), 'utf8');
    const motion = readFileSync(join(__dirname, '..', 'styles', 'motion.css'), 'utf8');

    const noPreference = css.split('@media (prefers-reduced-motion: no-preference)')[1] ?? '';
    expect(noPreference).toContain('ask-art-appear');
    expect(noPreference).toContain('ask-art-draw');
    expect(css.replace(noPreference, '')).not.toMatch(/animation:.*ask-art/);
    expect(askCss).not.toMatch(/animation:.*ask-art/);

    expect(css).not.toMatch(/@keyframes/);
    expect(askCss).not.toMatch(/@keyframes/);
    expect(motion).toContain('@keyframes ask-art-appear');
    expect(motion).toContain('@keyframes ask-art-draw');

    expect(css).not.toMatch(/ask-art[^}]*animation[^;]*infinite/);
    expect(askCss).not.toMatch(/ask-art[^}]*animation[^;]*infinite/);
    expect(motion).not.toMatch(/ask-art[^}]*infinite/);
  });
});
