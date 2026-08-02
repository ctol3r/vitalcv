import fs from 'node:fs';
import path from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CinematicEvidenceField } from '@/components/home/cinematic/CinematicEvidenceField';

/**
 * Wave 4 / D2 — the decorative atmosphere may not assert a source outcome.
 *
 * This field shipped a checkmark in a circle, painted in
 * `--vt-state-source-confirmed`, on a card reading "YOUR RECORD" — rendered
 * permanently, before any NPI was entered. RISK 1 in the program directive is
 * exactly this: decoration that reads as a successful source result.
 *
 * Phase-gating would not have been a fix. `resolved` includes exclusions and
 * attention states, so a generic success mark is dishonest at every phase.
 * Decoration asserts nothing, full stop.
 *
 * These guards assert the OUTCOME — no success mark, no evidence-state colour
 * anywhere in the decorative stylesheet — rather than naming the two elements
 * that were removed. A guard that names a deleted component goes green the
 * moment someone re-adds the same idea under a different name.
 */
const CSS = fs.readFileSync(
  path.join(process.cwd(), 'styles/cinematic-home.css'),
  'utf8',
);

/** Strip comments so the prose explaining the ban is not mistaken for the ban. */
const cssRules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the decorative evidence field asserts nothing', () => {
  it('is decorative to assistive tech and cannot be interacted with', () => {
    const html = renderToStaticMarkup(<CinematicEvidenceField />);
    expect(html).toContain('aria-hidden="true"');
    // Nothing inside may be focusable or announce itself as meaningful.
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('tabindex');
    expect(html).not.toMatch(/<a[\s>]/);
    expect(html).not.toMatch(/<button[\s>]/);
  });

  /**
   * The colour rule, stated as doctrine in evidence-input.css: green means
   * exactly one thing — a named source returned a match. Decoration never
   * qualifies, so no evidence-state token may appear in this stylesheet.
   */
  it('spends no evidence-state colour on atmosphere', () => {
    for (const token of [
      '--vt-state-source-confirmed',
      '--vt-state-pending',
      '--vt-state-blocked',
      '--vt-state-access',
    ]) {
      expect(cssRules, `${token} is an evidence colour and may not be decorative`).not.toContain(
        token,
      );
    }
  });

  it('draws no success mark', () => {
    const html = renderToStaticMarkup(<CinematicEvidenceField />);
    // A tick is a short two-segment polyline; the seal was the circle behind
    // it. Assert on the concept rather than the old class names.
    expect(html.toLowerCase()).not.toMatch(/tick|seal|check(mark)?|approved|confirmed|verified/);
    expect(cssRules.toLowerCase()).not.toMatch(/__tick|__seal/);
  });

  /**
   * The four labels name SOURCES. They are only safe while nothing next to them
   * reports a result, so the field must carry no status words at all.
   */
  it('names sources without reporting on any of them', () => {
    const html = renderToStaticMarkup(<CinematicEvidenceField />).toLowerCase();
    for (const word of [
      'clear',
      'active',
      'enrolled',
      'excluded',
      'match',
      'passed',
      'complete',
      'valid',
    ]) {
      expect(html, `"${word}" reports an outcome the decoration cannot know`).not.toContain(word);
    }
    // No numbers either — a count or percentage reads as a finding.
    expect(html).not.toMatch(/\d+\s*%/);
  });

  it('never animates forever and owns no scroll behaviour', () => {
    expect(cssRules).not.toMatch(/animation[^;]*infinite/);
    expect(cssRules).not.toContain('scroll-snap');
    // Keyframes belong to motion.css alone (contract §5 / LINT-03).
    expect(cssRules).not.toContain('@keyframes');
  });
});
