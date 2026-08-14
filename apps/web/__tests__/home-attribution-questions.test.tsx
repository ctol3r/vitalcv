import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import Attribution from '../components/home/easy/Attribution';
import Questions from '../components/home/easy/Questions';

/**
 * Truth guard for the two homepage sections ported from the Claude Design file
 * `VitalCV Homepage v2.html`.
 *
 * Both are pure presentation with no hooks, so they render server-side with no
 * mocking — which is the point: a section that cannot be rendered under the
 * test runner is where over-claims survive.
 *
 * The v2 originals shipped bare `Verified` chips, cryptographic receipt hashes,
 * sub-60-second revocation propagation and free-forever pricing. This asserts
 * against the MARKUP, not the source text, so a runtime-assembled label cannot
 * slip past the way `check-public-claims.ts` (a source scan) can be slipped.
 */

const attribution = renderToStaticMarkup(<Attribution />);
const questions = renderToStaticMarkup(<Questions />);
const both = `${attribution}\n${questions}`;

/** Visible text only — class names and data attributes are not customer copy. */
function visible(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');
}

const attrText = visible(attribution);
const qText = visible(questions);
const text = visible(both);

describe('homepage attribution', () => {
  it('never labels a state with a bare past-participle', () => {
    // CLAUDE.md: no status label may be the bare word. v2 shipped two.
    expect(attribution).not.toMatch(/>\s*Verified\s*</);
    expect(attrText).not.toMatch(/\bVerified\b/);
  });

  it('spells all four states as distinct words', () => {
    for (const state of ['Source-confirmed', 'You reported it', 'Access required', 'Not checked']) {
      expect(attrText).toContain(state);
    }
  });

  it('teaches no state word the product cannot produce', () => {
    // The real lane vocabulary is Checked / Pending / Access required /
    // Blocked / Contradicted / Not checked. v2's `Revoked` chip is not one of
    // them, and neither is `Withdrawn`.
    for (const invented of ['Revoked', 'Withdrawn', 'Expired', 'Certified']) {
      expect(attrText).not.toMatch(new RegExp(`\\b${invented}\\b`));
    }
  });

  it('assigns no invented state hue', () => {
    // EC-20's full state-hue family is DEFERRED to UX-02; EC-22 forbids
    // resolving a deferred row by inventing a value. Only the three scene
    // hues, plus plain ink, may appear.
    const tones = [...attribution.matchAll(/data-tone="([a-z]+)"/g)].map((m) => m[1]);
    expect(tones.length).toBeGreaterThan(0);
    expect([...new Set(tones)].sort()).toEqual(['hold', 'ink', 'wait', 'work']);
  });

  it('keeps the unchecked lane visible in the ledger', () => {
    // A ledger showing only the confirmed rows is the dishonest version.
    expect(attrText).toMatch(/Board certification/);
    const rows = attribution.match(/class="ezh-attr-row"/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(5);
    // At least one row must be in a non-confirmed state.
    expect(attribution).toMatch(/ezh-attr-chip" data-tone="(hold|wait)"/);
  });

  it('labels the ledger as illustrative in text, not by styling alone', () => {
    // EC-25: a scene must be impossible to mistake for live results.
    expect(attrText).toContain('Illustrative');
    expect(attrText).toContain('not a real person');
  });

  it('states that VitalCV does not make the credentialing decision', () => {
    expect(attrText).toContain('None of this is a credentialing decision');
  });

  it('carries no cryptographic-receipt claim', () => {
    // Issuer receipts ship dark and carry decisionGrade: false.
    for (const claim of ['Merkle', 'anchor batch', 'receipt 0x', 'blockchain', 'recompute']) {
      expect(attrText.toLowerCase()).not.toContain(claim.toLowerCase());
    }
    expect(attrText).not.toMatch(/0x[0-9a-f]{4}/i);
  });

  it('paints every state colour through an --ezh-* token, never a literal', () => {
    // The island's rule: no hex literals at a call site.
    expect(attribution).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('marks its own light header theme for the paper-surface composition', () => {
    expect(attribution).toContain('data-header-theme="light"');
  });
});

describe('homepage questions', () => {
  it('answers the credentialing boundary question first', () => {
    expect(qText).toContain('Is this credentialing?');
    // "No." must be the answer, not a hedge.
    expect(qText).toMatch(/Is this credentialing\?\s*No\./);
    expect(qText).toContain('VitalCV never makes it');
  });

  it('names the real source set and the real gaps', () => {
    expect(qText).toContain('federal exclusion list');
    expect(qText).toContain('Medicare enrollment');
    // The two honest limits must both survive a copy pass.
    expect(qText).toContain('not a live status');
    expect(qText).toContain('Board certification is not checked');
  });

  it('makes no promise v2 made that we cannot keep', () => {
    for (const claim of [
      'primary source verification',
      'free, forever',
      'free forever',
      '60 seconds',
      'continuously current',
      'guaranteed',
    ]) {
      expect(qText.toLowerCase()).not.toContain(claim.toLowerCase());
    }
    // No unmeasured metric anywhere.
    expect(qText).not.toMatch(/\b\d+\s*%/);
  });

  it('does not claim a pricing model beyond the free lookup', () => {
    expect(qText).toContain('no account is needed');
    expect(qText).toContain('pricing page');
  });

  it('uses native details so it survives no-JS and reduced motion', () => {
    expect(questions).toMatch(/<details[^>]*class="ezh-faq-item"/);
    expect(questions).toMatch(/<summary/);
    // First item open so the boundary answer is visible without interaction.
    expect(questions).toMatch(/<details class="ezh-faq-item" open/);
  });

  it('marks its own light header theme for the paper-surface composition', () => {
    expect(questions).toContain('data-header-theme="light"');
  });
});

describe('both sections', () => {
  it('introduces no EC-9 banned customer-facing noun', () => {
    // The nouns the EC-9 ratchet counts. New surfaces must start clean.
    const banned = [
      'packet', 'artifact', 'lane', 'evidence network', 'provenance', 'holder',
      'readiness score', 'passport', 'wallet', 'graph', 'trust tier', 'dossier',
      'credential object',
    ];
    const found = banned.filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(text));
    expect(found).toEqual([]);
  });

  it('contains no banned public claim', () => {
    for (const phrase of [
      'automatically verified', 'guaranteed verification', 'complete credentialing',
      'instant credentialing', 'legally accepted', 'risk transferred', 'HIPAA compliant',
      'SOC2 certified', 'certified compliant', 'zero knowledge proof', 'all 50 states',
    ]) {
      const needle = phrase.toLowerCase().replace(/-/g, ' ');
      expect(text.toLowerCase().replace(/-/g, ' ')).not.toContain(needle);
    }
  });
});
