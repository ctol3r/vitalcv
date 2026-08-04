/**
 * Wave 1501 design-reference guards.
 *
 * The scoping assertions are adapted from `design-wave1505.test.tsx`. They are
 * the reason the port is safe to have on disk at all: wave1500's token layer
 * reuses eight `--vt-*` names that already mean something different in this app
 * — most dangerously `--vt-focus-ring`, which is a COLOUR here and a
 * BOX-SHADOW LIST in wave1500. If a single rule in this stylesheet escapes
 * `.w1501`, focus indication breaks app-wide and no visual test would catch it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Wave1501Client } from '@/components/home/w1501/Wave1501Client';

const CSS = readFileSync(resolve(__dirname, '../styles/wave1501-home.css'), 'utf8');

/* Strip comments so a selector mentioned in prose never counts as a rule. */
const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('wave1501 stylesheet is scoped', () => {
  it('never publishes tokens at :root, html or body', () => {
    expect(stripped).not.toMatch(/:root\s*\{/);
    expect(stripped).toContain('.w1501 {');

    // `html.js.motion-live .w1501 .hp-reveal` is legitimate — the rule's
    // SUBJECT is `.w1501 .hp-reveal` and `html…` is only a state qualifier, so
    // a plain /html[\s.{]/ scan gives a false positive. What must never exist
    // is a rule whose subject IS html or body.
    const subjects = [...stripped.matchAll(/(?:^|\})\s*([^@{}]+?)\s*\{/g)]
      .flatMap((m) => m[1].split(',').map((p) => p.trim()))
      .filter(Boolean);
    expect(subjects.filter((s) => s === 'html' || s === 'body' || s === '*')).toEqual([]);
  });

  it('namespaces every keyframe', () => {
    const names = [...stripped.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.startsWith('w1501-')).toBe(true);
  });

  it('scopes every top-level selector under .w1501', () => {
    // Walk each rule head; skip at-rule heads and keyframe steps (from/to/N%).
    const heads = [...stripped.matchAll(/(?:^|\})\s*([^@{}]+?)\s*\{/g)].map((m) => m[1].trim());
    const offenders: string[] = [];
    for (const head of heads) {
      for (const part of head.split(',').map((p) => p.trim())) {
        if (!part) continue;
        if (/^(from|to|\d+(\.\d+)?%)$/.test(part)) continue;
        if (!part.startsWith('.w1501') && !part.includes('.w1501')) offenders.push(part);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the paper on Cloud Dancer rather than the handoff hex', () => {
    // scene-degradation.spec.ts pins --vt-cloud-dancer to #f0eee9; the handoff
    // shipped #f4f2ec. The guard wins.
    expect(stripped).toContain('--paper-100: var(--vt-cloud-dancer, #f0eee9)');
    expect(stripped).not.toMatch(/--paper-100:\s*#f4f2ec/);
  });
});

describe('wave1501 reference surface', () => {
  const html = renderToStaticMarkup(<Wave1501Client />);

  it('server-renders the full composition without JS', () => {
    // If this design is ever promoted to `/`, the homepage must clear a no-JS
    // SSR floor. Proving it here is the cheap version of that test.
    expect(html).toContain('Find the opportunity. Prove your career once.');
    // Was 'Start faster.' — retired with the speed hero (brand split 2026-07-26).
    expect(html).toContain('Start from evidence.');
    for (const anchor of ['id="top"', 'id="how"', 'id="why"', 'id="matcha"', 'id="sky"', 'id="roles"', 'id="who"']) {
      expect(html).toContain(anchor);
    }
    expect(html).toContain('National Provider Identifier, 10 digits');
    expect(html).toContain('Career horizon, from began to headed');
  });

  it('declares itself a design reference before anything else', () => {
    expect(html).toContain('Skip to content');
    expect(html).toContain('Design reference · wave 1501');
    expect(html).toContain('Illustrative fixture data');
    expect(html).toContain('Illustrative example · not a real clinician');
  });

  it('states each source lane at its real cadence', () => {
    // The handoff marked OIG "Checked · 2h ago" and PECOS "gated · requires
    // enrollment agreement". lib/trust/sourceLanes.ts says OIG is an active
    // MONTHLY snapshot and PECOS an active QUARTERLY one; the lane that is
    // actually access-gated is state licensure.
    expect(html).toContain('Read live');
    expect(html).toContain('Monthly snapshot');
    expect(html).toContain('Quarterly snapshot');
    expect(html).toContain('State boards');
    expect(html).not.toContain('2h ago');
    expect(html).not.toContain('requires enrollment agreement');
  });

  it('never lets the constellation promote an illustrative event', () => {
    // Truth rule: future stars are dashed regardless of the slider. The
    // screen-reader list must agree with the visual encoding.
    expect(html).toContain('illustrative, not recorded');
    expect(html).toContain('Past and future are illustrative');
  });

  it('carries no banned absolute-truth label', () => {
    expect(html).not.toMatch(/>\s*Verified\s*</);
    expect(html).not.toMatch(/\bautomatically verified\b/i);
    expect(html).not.toMatch(/\bHIPAA compliant\b/i);
  });
});
