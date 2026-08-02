/**
 * Scene artifacts — the place, the practice, and the person.
 *
 * Same honesty contract as page-artifacts.test.tsx and ask-home-diagrams:
 * these drawings illustrate, they never stand in for a result. Plus two rules
 * specific to this set:
 *
 *  - a traced path must declare BOTH pathLength and --trace-len. The trace
 *    animation dashes by --trace-len, so a path that omits pathLength has to be
 *    measured by hand and silently desyncs the first time somebody nudges a
 *    control point. pathLength={100} normalises it permanently.
 *  - the drawings must contain no <image> and no photographic reference —
 *    CD-13: the only images VitalCV publishes are its own artifacts.
 */

import { readFileSync } from 'node:fs';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ClinicianArtifact,
  HospitalArtifact,
  SpecialtyArtifact,
} from '@/components/artifacts/SceneArtifacts';

const ARTIFACTS = [
  { name: 'HospitalArtifact', el: <HospitalArtifact /> },
  { name: 'SpecialtyArtifact', el: <SpecialtyArtifact /> },
  { name: 'ClinicianArtifact', el: <ClinicianArtifact /> },
];

/** The claim words a drawing may never make. Identical to the page artifacts. */
const BANNED = ['verified', 'checked', 'live', 'nppes', 'oig', 'pecos', 'fresh', 'clear', 'complete'];

const MOTION_CSS = readFileSync(new URL('../styles/artifact-motion.css', import.meta.url), 'utf8');

describe('scene artifacts honour the artifact grammar', () => {
  for (const { name, el } of ARTIFACTS) {
    const html = renderToStaticMarkup(el);

    it(`${name}: has an accessible name and the wide sizing`, () => {
      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label=');
      expect(html).toContain('ask-art--wide');
    });

    it(`${name}: labels name the parts, never the state of data`, () => {
      const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].toLowerCase());
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) {
        for (const banned of BANNED) {
          expect(t, `"${t}" may not contain "${banned}"`).not.toContain(banned);
        }
      }
    });

    it(`${name}: animates through a sequence and starts at step 1`, () => {
      expect(html).toContain('ask-art-step-1');
      // A single fade is not an explanation — every drawing earns at least
      // three beats, whether through numbered steps or the --i item stagger.
      const hasThirdBeat = html.includes('ask-art-step-3') || html.includes('ask-art-item');
      expect(hasThirdBeat, 'needs a third beat: step-3 or a staggered item set').toBe(true);
    });

    it(`${name}: ships its resting composition, not a play state`, () => {
      // The base markup is the FINAL frame. `ask-art-play` is added by the
      // observer at runtime; if it were baked in, no-JS readers would be
      // handed a half-drawn picture.
      expect(html).not.toContain('ask-art-play');
    });

    it(`${name}: publishes only its own drawing — no photography`, () => {
      expect(html).not.toContain('<image');
      expect(html).not.toContain('background-image');
    });

    it(`${name}: every traced path normalises its length`, () => {
      // Each element carrying ask-art-traced must also carry pathLength.
      const traced = [...html.matchAll(/<path[^>]*ask-art-traced[^>]*>/g)].map((m) => m[0]);
      for (const el of traced) {
        expect(el, 'a traced path must declare pathLength').toContain('pathLength="100"');
        expect(el, 'a traced path must set --trace-len').toContain('--trace-len');
      }
      expect(traced.length).toBeGreaterThan(0);
    });
  }

  it('the specialty set gives every specialty equal weight', () => {
    const html = renderToStaticMarkup(<SpecialtyArtifact />);
    // Identical tile geometry: no specialty is drawn larger than another, so
    // the drawing cannot imply a ranking the product does not make.
    const tiles = [...html.matchAll(/<rect[^>]*ask-art-glass[^>]*>/g)].map((m) => m[0]);
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    const widths = new Set(tiles.map((t) => /width="(\d+)"/.exec(t)?.[1]));
    expect(widths.size, 'all specialty tiles share one width').toBe(1);
  });

  it('the clinician is a figure, never a portrait', () => {
    const html = renderToStaticMarkup(<ClinicianArtifact />);
    // Stroke-only: the figure classes are fill:none in artifact-motion.css.
    expect(html).toContain('ask-art-figure');
    // No skin, hair, or gender signifiers smuggled in as fills.
    expect(html).not.toMatch(/fill="#/);
  });

  it('the hospital carries the decision boundary in its own caption', () => {
    const html = renderToStaticMarkup(<HospitalArtifact />);
    // The drawing puts a packet at a hospital's door. It must say, in the
    // drawing itself, that arriving is not the same as being hired.
    expect(html.toLowerCase()).toContain('the committee still decides');
  });

  /**
   * The step number on the <text> element whose own content is `label`.
   * Read from that element's own class attribute — an earlier version scanned a
   * ±400-character window around the text and picked up whichever step class
   * happened to be nearest in the markup, which quietly reported step 1 for
   * everything and made the assertion vacuous.
   */
  const stepOf = (html: string, label: string): number => {
    const tags = [...html.matchAll(/<text[^>]*class="([^"]*)"[^>]*>([^<]*)<\/text>/g)];
    const hit = tags.find((t) => t[2].trim().toLowerCase() === label);
    expect(hit, `no <text> with content "${label}"`).toBeDefined();
    const m = /ask-art-step-(\d+)/.exec(hit![1]);
    expect(m, `"${label}" carries no step class`).not.toBeNull();
    return Number(m![1]);
  };

  const stepStartMs = (step: number): number => {
    const block = new RegExp(
      `\\.ask-art-play \\.ask-art-step-${step}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
    ).exec(MOTION_CSS)?.[1];
    expect(block, `motion CSS has no step ${step} block`).toBeDefined();
    const delay = /animation:[\s\S]*?\s(\d+)ms\s+both;/.exec(block!)?.[1];
    expect(delay, `step ${step} has no explicit start delay`).toBeDefined();
    return Number(delay);
  };

  const traceDurationMs = (): number => {
    const duration = /\.ask-art-play \.ask-art-traced\s*\{[\s\S]*?animation:\s*ask-art-trace\s+(\d+)ms/.exec(
      MOTION_CSS,
    )?.[1];
    expect(duration, 'the traced-path motion has no explicit duration').toBeDefined();
    return Number(duration);
  };

  it('the hospital lights the review room only AFTER packet delivery completes', () => {
    const html = renderToStaticMarkup(<HospitalArtifact />);
    const roomStep = stepOf(html, 'review room');
    const traceDelay = /--trace-delay:\s*(\d+)ms/.exec(html)?.[1];
    expect(traceDelay, 'the hospital delivery trace has no explicit delay').toBeDefined();

    const deliveryFinishedAt = Number(traceDelay) + traceDurationMs();
    expect(
      stepStartMs(roomStep),
      'the review room cannot begin lighting while the packet is still travelling',
    ).toBeGreaterThanOrEqual(deliveryFinishedAt);
  });

  it('the clinician gains sources after the rows, and travels only once sealed', () => {
    const html = renderToStaticMarkup(<ClinicianArtifact />);
    const delay = (cls: string) => {
      const re = new RegExp(`${cls}[^>]*--set-delay:\\s*(\\d+)ms`);
      const m = re.exec(html);
      expect(m, `no --set-delay found for ${cls}`).not.toBeNull();
      return Number(m![1]);
    };
    const rows = delay('ask-art-line ask-art-item');
    const sources = delay('ask-art-meta ask-art-item');
    const seals = delay('ask-art-seal ask-art-item');
    // A claim GAINING its provenance is the argument; a claim and its
    // provenance appearing together is just a picture.
    expect(sources, 'sources must land after the rows they belong to').toBeGreaterThan(rows);
    expect(seals, 'only a row that names its source may be sealed').toBeGreaterThan(sources);
  });
});
