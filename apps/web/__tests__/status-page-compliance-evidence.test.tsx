import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StatusPage from '../app/status/technical/page';

/**
 * DOCS-STATUS-1 — the technical status console (moved /status →
 * /status/technical in the customer/technical split) renders the
 * compliance-evidence shape
 * (data classification, retention, authority adapters) directly
 * from the same sources used by `/api/compliance/evidence`.
 *
 * Truth contract:
 *   - The compliance section is foundation-tier; copy explicitly
 *     disclaims it as "foundation shape ... not enforced production
 *     policies."
 *   - Numeric counts (rules, policies, adapters) come from the
 *     foundation modules; this test asserts both are non-zero so a
 *     missing/empty foundation is caught.
 */
describe('status page — compliance evidence (DOCS-STATUS-1)', () => {
  const html = renderToStaticMarkup(<StatusPage />);

  it('renders the foundation-status header and disclaimer', () => {
    expect(html).toContain('Foundation status preview');
    expect(html).toContain('No uptime guarantee is implied');
  });

  it('renders the compliance evidence section header', () => {
    expect(html).toContain('Compliance evidence (foundation shape)');
  });

  it('renders the compliance disclaimer (foundation shape, planned controls)', () => {
    expect(html).toContain('foundation shape for vendor risk assessments');
    expect(html).toContain('planned controls, not enforced production policies');
  });

  it('renders data classification status from the foundation module', () => {
    expect(html).toContain('Data classification');
    expect(html).toContain('redactionLive: false');
    // Per Codex P2 review on PR #230: `\d+` matches `0`, so an empty
    // foundation list would silently pass. Require at least one rule.
    const m = html.match(/(\d+) redaction rules/);
    expect(m).not.toBeNull();
    expect(Number(m?.[1] ?? '0')).toBeGreaterThan(0);
  });

  it('renders retention status from the foundation module', () => {
    expect(html).toContain('Retention');
    expect(html).toContain('retentionEnforced: false');
    const m = html.match(/(\d+) entity policies/);
    expect(m).not.toBeNull();
    expect(Number(m?.[1] ?? '0')).toBeGreaterThan(0);
  });

  it('renders authority adapter status from the foundation module', () => {
    expect(html).toContain('Authority adapters');
    expect(html).toMatch(/allAdaptersLive: (true|false)/);
    const m = html.match(/(\d+) adapters/);
    expect(m).not.toBeNull();
    expect(Number(m?.[1] ?? '0')).toBeGreaterThan(0);
  });

  it('points users at the machine-readable shape', () => {
    expect(html).toContain('/api/compliance/evidence');
  });

  it('does not render the bare word "Verified" as a status label', () => {
    expect(html).not.toMatch(/>Verified</);
  });

  it('does not include banned overclaim phrases', () => {
    const bannedPhrases = [
      'automatically verified',
      'guaranteed verification',
      'HIPAA compliant',
      'SOC2 certified',
    ];
    for (const phrase of bannedPhrases) {
      expect(html.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
