/**
 * Page artifacts — the same honesty contract as the homepage diagrams,
 * applied to the artifacts on /employers, /trust, and /pilot.
 *
 * The rules, identical everywhere (see ask-home-diagrams.test.tsx):
 * - every artifact svg has an accessible name;
 * - <text> carries PART names, never a source name or state word;
 * - no numbers in the pilot's measurement drawing — the pilot exists to
 *   measure; the drawing may not pre-announce a result.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DecisionArtifact,
  MeasureArtifact,
  ReceiptArtifact,
} from '@/components/artifacts/PageArtifacts';

const ARTIFACTS = [
  { name: 'DecisionArtifact (/employers)', el: <DecisionArtifact /> },
  { name: 'ReceiptArtifact (/trust)', el: <ReceiptArtifact /> },
  { name: 'MeasureArtifact (/pilot)', el: <MeasureArtifact /> },
];

describe('page artifacts honor the artifact grammar', () => {
  for (const { name, el } of ARTIFACTS) {
    const html = renderToStaticMarkup(el);

    it(`${name}: has an accessible name and the wide sizing`, () => {
      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label=');
      expect(html).toContain('ask-art--wide');
    });

    it(`${name}: labels caption the drawing, never the state of data`, () => {
      const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) =>
        m[1].toLowerCase(),
      );
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) {
        for (const banned of ['verified', 'checked', 'live', 'nppes', 'oig', 'pecos', 'fresh', 'clear', 'complete']) {
          expect(t, `"${t}" may not contain "${banned}"`).not.toContain(banned);
        }
      }
    });

    it(`${name}: animates through numbered steps and starts at step 1`, () => {
      expect(html).toContain('ask-art-step-1');
      // Every artifact must have at least a three-beat sequence — a single
      // fade is not an explanation.
      expect(html).toContain('ask-art-step-3');
    });
  }

  it('MeasureArtifact carries no digits — nothing has been measured', () => {
    const html = renderToStaticMarkup(<MeasureArtifact />);
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    for (const t of texts) {
      expect(t, `"${t}" must not contain a number`).not.toMatch(/\d/);
    }
  });

  it('DecisionArtifact leaves all three reviewer actions open — none pre-selected', () => {
    const html = renderToStaticMarkup(<DecisionArtifact />);
    for (const action of ['recognize', 'request', 'advance']) {
      expect(html.toLowerCase()).toContain(`>${action}<`);
    }
    // All three action slots use the neutral slot class, not the accent chip:
    // a pre-highlighted action would depict a decision the product never makes.
    const slots = html.match(/ask-art-slot/g) ?? [];
    expect(slots.length).toBe(3);
    expect(html).not.toMatch(/ask-art-chip/);
  });
});
