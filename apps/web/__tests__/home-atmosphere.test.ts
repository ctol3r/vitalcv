/**
 * Wave 4, D2 — what the hero phase is allowed to SPEND.
 *
 * D1 publishes `data-home-phase`; this is the half that consumes it. The
 * derivation is guarded in `home-phase.test.tsx` and is deliberately not
 * re-tested here.
 *
 * The assertions that matter are the negative ones. A phase may change how
 * PRESENT the decoration is and nothing else — the moment it can restyle
 * something that asserts, the page has a second, silent channel for saying how
 * a lookup went, and that channel answers to no source.
 *
 * Contract: docs/design/home-evidence-experience-v2.md §7.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const surfaces = readFileSync(join(process.cwd(), 'styles/home-surfaces.css'), 'utf8');
const cinematic = readFileSync(join(process.cwd(), 'styles/cinematic-home.css'), 'utf8');

describe('the phase carries no verdict', () => {
  it('the three committed phases share one atmosphere value', () => {
    // If `resolved` were quieter than `system-error`, the page would be
    // reporting an outcome through styling — the décor-alone equivalent of the
    // colour-alone signalling CD-2 forbids. They must be one rule.
    const rule = surfaces
      .split("[data-home-atmosphere]:has(~ [data-home-phase='resolving'])")[1]
      ?.split('}')[0];
    expect(rule).toBeTruthy();
    expect(rule).toContain("[data-home-phase='resolved']");
    expect(rule).toContain("[data-home-phase='system-error']");
  });

  it('no phase selector sets a colour', () => {
    for (const [, body] of surfaces.matchAll(/\[data-home-phase=[^{]*\{([^}]*)\}/g)) {
      expect(body).not.toMatch(/color|background|fill|border|--vt-state/i);
    }
  });

  it('the atmosphere multiplier is the only thing a phase moves', () => {
    // Guards the blast radius. A later wave that wants a phase to move real
    // content should have to change this test and say so out loud.
    const blocks = [...surfaces.matchAll(/\[data-home-phase=[^{]*\{([^}]*)\}/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const [, body] of blocks) {
      const props = [...body.matchAll(/^\s*([\w-]+)\s*:/gm)].map((m) => m[1]);
      expect(props).toEqual(props.filter((p) => p === '--home-atmosphere'));
    }
  });
});

describe('atmosphere presence', () => {
  it('is a multiplier over the base, so responsive step-downs survive', () => {
    // A phase rule written as a flat `opacity` would override the small-screen
    // thinning and make the decoration LOUDER on a phone than on a desktop.
    expect(cinematic).toContain('var(--cinematic-presence) * var(--home-atmosphere, 1)');
    expect(cinematic).toMatch(/--cinematic-presence:\s*0\.42/);
    expect(cinematic).toMatch(/--cinematic-presence:\s*0\.32/);
  });

  it('resolves instantly under reduced motion, without losing the end state', () => {
    const reduce = cinematic.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
    expect(reduce).toContain('.cinematic-evidence-field,');
    expect(reduce).toContain('transition: none !important');
    // The end state must still be COMPUTED — never forced back to full opacity.
    expect(reduce).not.toMatch(/\.cinematic-evidence-field\s*\{[^}]*opacity:\s*1/);
  });
});

describe('decorative words never render clipped', () => {
  it('labels and the caption are dropped wherever the artwork overflows', () => {
    // At 768px the artwork is 70rem wide on a 768px viewport, so all four
    // perimeter labels were sliced by the edge (`identity` began at x=-41,
    // `licensure` ended at x=800) and the caption crossed the employer link.
    // The layer's own comment already rules that decorative words landing on
    // live copy read as a rendering fault; a word sawn in half is the same
    // fault. Only the ≤640 band used to drop them.
    const band = cinematic.split('@media (max-width: 899px)')[1]?.split('@media')[0] ?? '';
    expect(band).toContain('.cinematic-evidence-field__label');
    expect(band).toContain('.cinematic-evidence-field__caption');
    expect(band).toMatch(/display:\s*none/);
  });
});
