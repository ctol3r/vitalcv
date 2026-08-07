import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { EmployerWorkflowPreview } from '@/components/employers/EmployerWorkflowPreview';
import { EMPLOYER_STAGES } from '@/components/employers/employerWorkflow';

/** The public truth contract — the same banned set the homepage guards. */
const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bautomatically\s+verified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\binstant\s+credentialing\b/i,
  /\blegally\s+accepted\b/i,
  /\brisk\s+transferred\b/i,
  /\bcertified\s+compliant\b/i,
  /\bHIPAA\s+compliant\b/i,
  /\bSOC2\s+certified\b/i,
];

function render(): string {
  return renderToStaticMarkup(<EmployerWorkflowPreview />);
}

describe('EmployerWorkflowPreview — the honest job-to-start loop (EMP-6.1)', () => {
  it('renders all six workflow stages in order', () => {
    const html = render();
    expect(html).toContain('data-employer-workflow');
    let previous = -1;
    for (const stage of EMPLOYER_STAGES) {
      const at = html.indexOf(stage.title);
      expect(at, `stage "${stage.title}" renders`).toBeGreaterThan(previous);
      previous = at;
    }
    // The full claim→start loop, not the old three generic cards.
    expect(EMPLOYER_STAGES).toHaveLength(6);
  });

  it('states the three non-negotiable boundaries inline, not in a footnote', () => {
    const html = render();
    // identity ≠ authority. The wording moved from "not legal proof of
    // authority over it" to "not authority to act for it" when step 01 became
    // a request rather than a claim. The boundary is unchanged — and the
    // boundary, not one phrasing of it, is what this guard protects.
    expect(html).toContain('not authority to act for it');
    // the clinician owns sharing
    expect(html).toMatch(/only when the clinician shares it/i);
    // acceptance ≠ credentialing
    expect(html).toMatch(/head start, not credentialing/i);
    // every boundary is rendered as a visible stage boundary element
    const boundaryCount = html.split('data-stage-boundary').length - 1;
    expect(boundaryCount).toBe(EMPLOYER_STAGES.filter((s) => s.boundary).length);
    expect(boundaryCount).toBeGreaterThanOrEqual(3);
  });

  it('claims no source-state it cannot back — no banned public claims', () => {
    const html = render();
    for (const pattern of BANNED_PATTERNS) {
      expect(pattern.test(html), `banned phrase /${pattern.source}/ matched`).toBe(false);
    }
  });

  it('uses no buyer-facing infra/crypto jargon (mirrors the /employers page guard)', () => {
    // The same buyer-banned terms buyer-proof-page.test.tsx enforces on the
    // rendered page — asserted here too so a regression fails at the component,
    // not only in CI's merge-build. "ledger" tripped this once (the requirement
    // ledger is internal + unmounted; it must not surface as buyer copy).
    const normalized = render().toLowerCase();
    for (const term of ['blockchain', 'ledger', 'wallet', 'zero-knowledge', 'immutable', 'audit chain', 'hire instantly']) {
      expect(normalized, `buyer-jargon "${term}" present`).not.toContain(term);
    }
  });

  it('names a source-backed record without fabricating people, employers, or metrics', () => {
    const html = render();
    // The value proposition is a real record moving through review — no sample
    // candidate names, no invented counts, no fake trust scores.
    expect(html).toMatch(/source-backed/i);
    expect(html).not.toMatch(/\bDr\.\s+[A-Z]/); // no fabricated clinician names
    expect(html).not.toMatch(/\d+%/); // no invented percentage outcomes
  });
});
