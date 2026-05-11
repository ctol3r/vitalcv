/**
 * TruthBoundary surface + docs/trust-boundaries.md lockdown.
 *
 * Pins the institutional truth surface against drift. Compliance
 * officers reading this surface evaluate a contract; ambiguity here
 * is a deal-breaker. Specifically pins:
 *   - 5 mandatory sections render (verified / not-verified /
 *     operational-state / limitations / state-matrix).
 *   - The 7-state verification matrix is exposed in the canonical
 *     order: verified, source-linked, self-attested, unavailable,
 *     revoked, expired, degraded-state.
 *   - Empty `verified` list renders a fail-closed warning, never
 *     "everything is fine".
 *   - Empty `limitations` list renders "missing-data" framing,
 *     never "no limitations exist".
 *   - The companion doc at docs/trust-boundaries.md stays in lockstep
 *     with the rendered surface (banned strings, state legend).
 */

import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { TruthBoundary, VERIFICATION_STATES } from '../components/TruthBoundary';

const NEUTRAL_PROPS = {
  verified: [
    { claim: 'NPI identity exists and is active', source: 'NPPES' },
    { claim: 'OIG / LEIE exclusion status', source: 'HHS OIG' },
  ],
  notVerified: [
    {
      claim: 'Clinical competence',
      reason: 'Out of scope.',
      state: 'unavailable' as const,
    },
    {
      claim: 'Board certification without receipt',
      reason: 'Self-asserted unless a receipt is attached.',
      state: 'self-attested' as const,
    },
  ],
  operationalState: {
    replayLineage: { state: 'ambiguous' as const, detail: 'Primitive shipped; not yet wired.' },
    revocation:    { state: 'ambiguous' as const, detail: 'In-memory until persistence migration runs.' },
    jwks:          { state: 'ambiguous' as const, detail: 'Sandbox JWKS returns empty until env set.' },
    auditExport:   { state: 'ambiguous' as const, detail: 'Envelope shipped; not yet wired into route.' },
  },
  limitations: [
    'Source coverage varies by jurisdiction.',
    'No off-US clinician verification.',
  ],
};

const DOC = readFileSync(
  resolve(__dirname, '../../../../docs/trust-boundaries.md'),
  'utf8',
);

describe('TruthBoundary — 5 mandatory sections render', () => {
  const html = renderToStaticMarkup(<TruthBoundary {...NEUTRAL_PROPS} />);

  it('renders the page-level test id', () => {
    expect(html).toContain('data-testid="truth-boundary"');
  });

  it('renders the verified section', () => {
    expect(html).toContain('data-testid="section-verified"');
  });

  it('renders the not-verified section', () => {
    expect(html).toContain('data-testid="section-not-verified"');
  });

  it('renders the operational-state section', () => {
    expect(html).toContain('data-testid="section-operational-state"');
  });

  it('renders the limitations section', () => {
    expect(html).toContain('data-testid="section-limitations"');
  });

  it('renders the state-matrix legend section', () => {
    expect(html).toContain('data-testid="section-state-matrix"');
  });

  it('renders the explicit-pin footer', () => {
    expect(html).toContain('data-testid="truth-boundary-footer"');
  });
});

describe('TruthBoundary — the 10-second target', () => {
  const html = renderToStaticMarkup(<TruthBoundary {...NEUTRAL_PROPS} />);

  it('lede states the boundary in one sentence', () => {
    expect(html).toContain('What VitalCV verifies — and what it does not.');
  });

  it('lede is followed by the "this is the operational contract" framing', () => {
    expect(html).toContain('operational contract');
    expect(html).toContain('not what it intends to do');
  });
});

describe('TruthBoundary — 7-state verification matrix is complete', () => {
  it('exports exactly 7 verification states in canonical order', () => {
    expect(VERIFICATION_STATES).toHaveLength(7);
    const ids = VERIFICATION_STATES.map((s) => s.id);
    expect(ids).toEqual([
      'verified',
      'source-linked',
      'self-attested',
      'unavailable',
      'revoked',
      'expired',
      'degraded-state',
    ]);
  });

  it('source-verified is labeled "Source-verified", never bare "Verified"', () => {
    const v = VERIFICATION_STATES.find((s) => s.id === 'verified');
    expect(v?.label).toBe('Source-verified');
  });

  it('all 7 labels appear in the rendered surface', () => {
    const html = renderToStaticMarkup(<TruthBoundary {...NEUTRAL_PROPS} />);
    for (const s of VERIFICATION_STATES) {
      expect(html).toContain(s.label);
    }
  });

  it('every state has a glyph mapped from the trust palette', () => {
    for (const s of VERIFICATION_STATES) {
      expect(['ok', 'ambiguous', 'failed', 'unknown']).toContain(s.glyph);
    }
  });
});

describe('TruthBoundary — empty-state truth contract', () => {
  it('empty verified list renders fail-closed warning, NOT "no claims = all clear"', () => {
    const html = renderToStaticMarkup(
      <TruthBoundary {...NEUTRAL_PROPS} verified={[]} />,
    );
    expect(html).toContain('No source-verified claims to report');
    expect(html).toContain('do not rely on this surface');
  });

  it('empty limitations list renders "missing data" framing, NOT "no limitations exist"', () => {
    const html = renderToStaticMarkup(
      <TruthBoundary {...NEUTRAL_PROPS} limitations={[]} />,
    );
    expect(html).toContain('No limitations recorded');
    expect(html).toContain('does NOT mean the system is complete');
  });
});

describe('TruthBoundary — no fake certainty in the rendered HTML', () => {
  const html = renderToStaticMarkup(<TruthBoundary {...NEUTRAL_PROPS} />);

  it('never renders bare-word "Verified" as a state badge or heading', () => {
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('does not contain marketing hedge language', () => {
    expect(html).not.toMatch(/\b(typically|usually|generally|broadly|in most cases)\b/i);
  });

  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['instant', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(html).not.toContain(phrase);
    }
  });

  it('does not contain crypto jargon in user-facing copy', () => {
    expect(html).not.toMatch(/\bblockchain\b/i);
    expect(html).not.toMatch(/\bimmutable\b/i);
  });

  it('does not contain AI-hype language', () => {
    // "automatic" alone is OK in context; "intelligent" / "smart" / "AI-powered" is hype.
    expect(html).not.toMatch(/\bintelligent\b/i);
    expect(html).not.toMatch(/\bAI-powered\b/i);
  });
});

describe('docs/trust-boundaries.md — companion doc lockstep', () => {
  it('lists the 7 canonical state labels', () => {
    expect(DOC).toContain('Source-verified');
    expect(DOC).toContain('Source-linked');
    expect(DOC).toContain('Self-attested');
    expect(DOC).toContain('Unavailable');
    expect(DOC).toContain('Revoked');
    expect(DOC).toContain('Expired');
    expect(DOC).toContain('Degraded — source unreachable');
  });

  it('references the live consumer surface path', () => {
    expect(DOC).toContain('apps/web-v2/src/app/truth-boundary/page.tsx');
    expect(DOC).toContain('apps/web-v2/src/components/TruthBoundary.tsx');
  });

  it('references the fail-closed verifier endpoint', () => {
    expect(DOC).toContain('/api/receipts/verify');
    expect(DOC).toContain('/.well-known/jwks.json');
  });

  it('documents the language doctrine (no bare-Verified, no crypto jargon)', () => {
    expect(DOC).toContain('Never use the bare word');
    expect(DOC).toContain('Never use crypto jargon');
  });

  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['instant', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(DOC).not.toContain(phrase);
    }
  });
});
