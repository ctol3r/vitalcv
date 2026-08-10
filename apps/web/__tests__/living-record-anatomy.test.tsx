/**
 * ILL-03 / ILL-04 — the Living Evidence Record's anatomy and truth contract.
 *
 * Two things are being defended here, and they fail in different directions.
 *
 * The ANATOMY half pins the object's identity. Z0's whole premise is that
 * eleven faces are one object rather than eleven cards, and the parts that
 * carry that — portrait proportion, the 2px-over-1px top-edge asymmetry, the
 * spine, six apertures — are exactly the parts a later "tidy-up" would smooth
 * away without noticing. The anatomy lives in `anatomy.ts` as data precisely so
 * these can be asserted rather than eyeballed in a screenshot.
 *
 * The TRUTH half pins EC-25 applied to artwork. The failure mode is not a
 * developer deciding to lie; it is a plausible-looking illustration acquiring a
 * green tick, a source name, or an outcome word during a polish pass — which is
 * the documented `copy_polish` failure in this repo's history. So the assertions
 * are on the rendered markup, not on intent.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  IllustrationLabel,
  LivingRecord,
  RelationshipScene,
  ReviewDesk,
  SourceKiosk,
} from '@/components/vital/record';
import {
  APERTURE_COUNT,
  IMPLEMENTED_FACES,
  ILLUSTRATION_LABEL,
  ILLUSTRATIVE_STATES,
  RECORD_EDGE,
  RECORD_PROPORTION,
  RECORD_RADIUS,
} from '@/components/vital/record/anatomy';

/** Any hue that would make an illustrative marker look like a real StateChip. */
const STATE_HUE_TOKENS = [
  '--vt-scene-state-source-confirmed',
  '--vt-scene-state-needs-person',
  '--vt-scene-state-waiting',
  '--vt-state-source-confirmed',
  '--vt-state-stale',
  '#4ade97',
  '#2e9e6b',
  '#e4b45c',
  '#047857',
];

/**
 * Sources VitalCV either integrates, gates, or does not connect at all. None
 * may appear in artwork: naming one implies a response that did not occur
 * (EC-25.2), and the gated ones may never carry a confirmed mark at all.
 */
const SOURCE_NAMES = [
  'nppes',
  'nursys',
  'fsmb',
  'oig',
  'leie',
  'pecos',
  'abms',
  'npdb',
  'dea',
  'sam.gov',
  'doximity',
];

/** Outcome words an employer scene may never reach (EC-25.5). */
const OUTCOME_WORDS = [
  'accepted',
  'approved',
  'cleared',
  'credentialed',
  'privileged',
  'hired',
  'offer',
  'start-ready',
  'onboarded',
];

const ALL_FACES = IMPLEMENTED_FACES.map((face) => renderToStaticMarkup(<LivingRecord face={face} />));

describe('Living Evidence Record — anatomy (Z0 / EC-27)', () => {
  it('the top edge is heavier than every other edge — the object signature', () => {
    // Z0 EDGE: "2px ink on the top edge only … it is how a viewer tells the
    // record from any other rectangle on the page."
    expect(RECORD_EDGE.topEdgePx).toBeGreaterThan(RECORD_EDGE.hairlinePx);

    for (const html of ALL_FACES) {
      expect(html).toContain(`border-width:${RECORD_EDGE.hairlinePx}px`);
      expect(html).toContain(`border-top-width:${RECORD_EDGE.topEdgePx}px`);
    }
  });

  it('is portrait in every face and every variant — never landscape', () => {
    // "The object never becomes landscape; a landscape record reads as a
    // dashboard panel, which is the thing it must not be."
    for (const [w, h] of Object.values(RECORD_PROPORTION).map((r) => r.split('/').map(Number))) {
      expect(w).toBeLessThan(h);
    }
    for (const html of ALL_FACES) {
      expect(html).toContain(`aspect-ratio:${RECORD_PROPORTION.desktop.replace(/\s/g, ' ')}`);
    }
    const recipient = renderToStaticMarkup(<LivingRecord face="arrived" variant="recipient" />);
    expect(recipient).toContain('aspect-ratio:');
  });

  it('renders six apertures in every face, and open slots are shown rather than hidden', () => {
    expect(APERTURE_COUNT).toBe(6);
    for (const face of IMPLEMENTED_FACES) {
      const html = renderToStaticMarkup(<LivingRecord face={face} />);
      // Each aperture is a 7px square; count them rather than trusting the loop.
      expect(html.split('h-[7px] w-[7px]').length - 1).toBe(APERTURE_COUNT);
    }
    // Z0 face 1 BLANK: nothing entered, so every aperture reads open.
    const blank = renderToStaticMarkup(<LivingRecord face="blank" />);
    expect(blank.split('background:transparent').length - 1).toBe(APERTURE_COUNT);
  });

  it('carries no shadow on any face — "None on evidence. Ever."', () => {
    for (const html of ALL_FACES) {
      expect(html).toContain('box-shadow:none');
      expect(html).not.toMatch(/box-shadow:\s*(?!none)/);
    }
  });

  it('allows exactly one translucent element, and only where a decision overlays facts', () => {
    // Z0 PERMISSION LAYER is "the only translucency the object is allowed, and
    // only because it represents a decision laid over facts rather than a fact".
    const deciding = renderToStaticMarkup(<LivingRecord face="deciding" />);
    expect(deciding.split('color-mix').length - 1).toBe(1);

    for (const face of IMPLEMENTED_FACES.filter((f) => f !== 'deciding')) {
      expect(renderToStaticMarkup(<LivingRecord face={face} />)).not.toContain('color-mix');
    }
  });

  it('keeps the consent seal the only circular element, and squares anything depicting an action', () => {
    // EC-20 as amended A-2: an action is square, including an illustration that
    // depicts one. The permission layer depicts approval.
    expect(RECORD_RADIUS.actionPx).toBe(0);

    const deciding = renderToStaticMarkup(<LivingRecord face="deciding" />);
    expect(deciding).toContain(`border-radius:${RECORD_RADIUS.actionPx}px`);
    // Exactly one circular element in the whole object.
    expect(deciding.split(`border-radius:${RECORD_RADIUS.seal}`).length - 1).toBe(1);
    expect(deciding).toContain('data-consent-seal');
  });

  it('is inert artwork — no interactive element, and aria-hidden so prose carries the meaning', () => {
    // EC-26: removing every scene must leave the surface fully usable, which is
    // only true if the art never carried the meaning in the first place.
    for (const html of [
      ...ALL_FACES,
      renderToStaticMarkup(<SourceKiosk kind="licensing" />),
      renderToStaticMarkup(<ReviewDesk />),
    ]) {
      expect(html).not.toMatch(/<(a|button|input|select|textarea)\b/);
      expect(html).not.toContain('tabindex');
    }
    for (const html of ALL_FACES) {
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe('Living Evidence Record — truth review (EC-25)', () => {
  it('never spends a state hue, so an illustrative marker cannot pass as a StateChip', () => {
    const surfaces = [
      ...ALL_FACES,
      renderToStaticMarkup(<SourceKiosk kind="training" />),
      renderToStaticMarkup(<SourceKiosk kind="licensing" />),
      renderToStaticMarkup(<SourceKiosk kind="certification" />),
      renderToStaticMarkup(<ReviewDesk />),
    ];
    for (const html of surfaces) {
      for (const hue of STATE_HUE_TOKENS) {
        expect(html.toLowerCase()).not.toContain(hue);
      }
    }
  });

  it('pairs a glyph with a word on every marker — meaning never by shape alone either', () => {
    const returned = renderToStaticMarkup(<LivingRecord face="returned" />);
    for (const state of ['answered', 'open', 'yours'] as const) {
      const { glyph, word } = ILLUSTRATIVE_STATES[state];
      expect(returned).toContain(word);
      expect(returned).toContain(glyph);
    }
  });

  it('keeps every claim label legible rather than truncating it away', () => {
    // The regression this pins: with the marker beside the claim, a portrait
    // record squeezed "Identity" down to "Ide…" and the label the row exists to
    // carry disappeared. Nothing in this object may clip its own text.
    for (const face of IMPLEMENTED_FACES) {
      expect(renderToStaticMarkup(<LivingRecord face={face} />)).not.toContain('truncate');
    }
  });

  it('names no real source in artwork — categories only', () => {
    for (const kind of ['training', 'licensing', 'certification'] as const) {
      const html = renderToStaticMarkup(<SourceKiosk kind={kind} />).toLowerCase();
      for (const source of SOURCE_NAMES) {
        expect(html).not.toContain(source);
      }
    }
  });

  it('makes every issuer state its limitation — an issuer contributes a fact, not a clearance', () => {
    for (const kind of ['training', 'licensing', 'certification'] as const) {
      expect(renderToStaticMarkup(<SourceKiosk kind={kind} />)).toContain('Does not mean:');
    }
  });

  it('stops the employer scene at review — no outcome, and no bare "Verified"', () => {
    const html = renderToStaticMarkup(<ReviewDesk />);
    const text = html.toLowerCase();
    for (const word of OUTCOME_WORDS) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toMatch(/\bverified\b/);
    // The desk has exactly one terminal state, and it is not an outcome.
    expect(html).toContain('data-desk-state="receiving"');
    expect(html).toContain('The employer decides');
  });

  it('holds rows back by absence, never by a greyed-out ghost of what was withheld', () => {
    // Z0 face 9: "Held rows are absent, not greyed." A greyed row still tells
    // the employer that something exists and was withheld.
    const arrived = renderToStaticMarkup(<LivingRecord face="arrived" variant="recipient" />);
    expect(arrived).not.toContain('Licence');
    expect(arrived).not.toContain('Where you want to work');
    expect(arrived).toContain('Identity');
  });

  it('ships no live-looking dead control in the server frame', () => {
    // Measured with JS disabled: all four controls rendered as ordinary live
    // buttons that could never do anything. The server frame must hand the
    // visitor honestly inert controls and explain why, then enable them on
    // mount — which also costs no layout shift, since a disabled button
    // occupies the same box.
    const html = renderToStaticMarkup(<RelationshipScene />);
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toContain('disabled');
    expect(html).toContain('<noscript>');
  });

  it('carries the whole story in the server frame, so no-JS loses nothing', () => {
    // EC-26: removing every scene must leave the surface fully usable. The
    // transcript is the load-bearing half of that promise.
    const html = renderToStaticMarkup(<RelationshipScene />);
    expect(html).toContain('data-scene-transcript');
    expect(html).toContain('The complete relationship');
    expect(html).toContain(ILLUSTRATION_LABEL);
  });

  it('renders no two faces identically', () => {
    // The defect this exists for: `arrived` and `reviewed` shipped pixel-
    // identical. Every other assertion passed, because they all check anatomy
    // — and the anatomy WAS right. What was wrong is that two distinct states
    // were indistinguishable, which means the state was carried by nothing.
    // Compare what the face LOOKS like, not what it calls itself. The first
    // version of this guard compared raw markup and could never fail, because
    // `data-face={face}` makes every face's markup unique whether or not any
    // pixel differs — a test asserting the mechanism instead of the closure.
    // Injecting the original defect is what exposed it: only one of the two
    // new guards fired.
    const appearance = (face: (typeof IMPLEMENTED_FACES)[number]) =>
      renderToStaticMarkup(<LivingRecord face={face} />).replace(/ data-face="[^"]*"/g, '');

    const seen = new Map<string, string>();
    for (const face of IMPLEMENTED_FACES) {
      const html = appearance(face);
      const twin = seen.get(html);
      expect(
        twin,
        `faces "${face}" and "${twin}" render identically — the state is carried by nothing`,
      ).toBeUndefined();
      seen.set(html, face);
    }
    expect(seen.size).toBe(IMPLEMENTED_FACES.length);
  });

  it('uses every state it declares', () => {
    // `reviewing` sat declared and unwired, which is how the twin faces got
    // through. A vocabulary with a dead word is a vocabulary that is lying
    // about its own size.
    const all = IMPLEMENTED_FACES.map((f) => renderToStaticMarkup(<LivingRecord face={f} />)).join('');
    for (const [state, { word }] of Object.entries(ILLUSTRATIVE_STATES)) {
      expect(all, `state "${state}" is declared but no face uses it`).toContain(word);
    }
  });

  it('labels itself as an illustration', () => {
    expect(renderToStaticMarkup(<IllustrationLabel />)).toContain(ILLUSTRATION_LABEL);
    expect(ILLUSTRATION_LABEL.toLowerCase()).toContain('not a live result');
  });
});
