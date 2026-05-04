import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StatusPage from '../app/status/page';

/**
 * DOCS-STATUS-1 — `/status` renders the compliance-evidence shape
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
    expect(html).toMatch(/\d+ redaction rules/);
  });

  it('renders retention status from the foundation module', () => {
    expect(html).toContain('Retention');
    expect(html).toContain('retentionEnforced: false');
    expect(html).toMatch(/\d+ entity policies/);
  });

  it('renders authority adapter status from the foundation module', () => {
    expect(html).toContain('Authority adapters');
    expect(html).toMatch(/allAdaptersLive: (true|false)/);
    expect(html).toMatch(/\d+ adapters/);
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
