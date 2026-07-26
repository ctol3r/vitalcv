/**
 * status-attribution-receipts.test.tsx — Wave K coverage.
 *
 * Asserts the ConnectorMatrix and TrustAttributionRegister components
 * render operator-honest receipt-document tables and that the new
 * /trust/attribution page surfaces the canonical disclaimer.
 *
 * Truth-contract enforcement: no claim of source-backed connectivity
 * for OIG / LEIE / PECOS / STATE_BOARD / FSMB / NURSYS. No bare
 * "Verified". No unsupported compliance claims. Institution-review
 * boundary visible per row.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ConnectorMatrix,
  CONNECTOR_MATRIX_ROWS,
} from '@/components/status/ConnectorMatrix';
import {
  TrustAttributionRegister,
  TRUST_ATTRIBUTION_ROWS,
  TRUST_ATTRIBUTION_DISCLAIMER,
} from '@/components/trust/TrustAttributionRegister';

const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\binstant\s+credentialing\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\bautomatically\s+verified\b/i,
  /\blegally\s+accepted\b/i,
  /\bcertified\s+compliant\b/i,
];

function assertNoBannedPhrases(html: string, context: string): void {
  for (const pattern of BANNED_PATTERNS) {
    expect(
      pattern.test(html),
      `Banned phrase /${pattern.source}/${pattern.flags} matched in ${context}`,
    ).toBe(false);
  }
}

describe('ConnectorMatrix — receipt-document table', () => {
  it('renders a row per connector with TruthStateChip', () => {
    const html = renderToStaticMarkup(<ConnectorMatrix />);
    expect(html).toContain('data-status-connector-matrix');
    expect(html).toContain('data-status-connector-row="nppes-federal-npi-registry"');
    expect(html).toContain('data-status-connector-row="oig-leie-federal-exclusion-lane"');
    expect(html).toContain(
      'data-status-connector-row="cms-pecos-medicare-enrollment-lane"',
    );
    expect(html).toContain('data-status-connector-row="state-medical-boards"');
    expect(html).toContain('data-status-connector-row="fsmb-practitioner-lookup"');
    expect(html).toContain(
      'data-status-connector-row="nursys-nurse-license-database"',
    );
  });

  // Corrected 2026-07-25. These pinned `connector-not-live`, which was FALSE
  // and was itself half of a public contradiction: /api/status published both
  // lanes as operational while this matrix said no connector existed.
  // OigLeieAdapter reads the real HHS LEIE CSV unless OIG_LEIE_ENABLED ===
  // 'false' (unset on Railway, founder-confirmed) and fetchPecos calls CMS
  // data.gov with no env gate. The real boundary is the session — the web
  // proxy 401s unauthenticated — so the honest state is `auth-required`.
  it('OIG / LEIE row is auth-required, not connector-not-live', () => {
    const oig = CONNECTOR_MATRIX_ROWS.find((r) =>
      r.connector.toLowerCase().includes('oig'),
    );
    expect(oig?.state).toBe('auth-required');
    expect(oig?.observation).not.toMatch(/no live upstream/i);
  });

  it('CMS PECOS row is auth-required, not connector-not-live', () => {
    const pecos = CONNECTOR_MATRIX_ROWS.find((r) =>
      r.connector.toLowerCase().includes('pecos'),
    );
    expect(pecos?.state).toBe('auth-required');
    expect(pecos?.observation).not.toMatch(/no live upstream/i);
  });

  it('FSMB and Nursys rows use the connector-not-live state', () => {
    const fsmb = CONNECTOR_MATRIX_ROWS.find((r) =>
      r.connector.toLowerCase().includes('fsmb'),
    );
    const nursys = CONNECTOR_MATRIX_ROWS.find((r) =>
      r.connector.toLowerCase().includes('nursys'),
    );
    expect(fsmb?.state).toBe('connector-not-live');
    expect(nursys?.state).toBe('connector-not-live');
  });

  it('does not claim any non-NPPES connector is source-backed', () => {
    for (const row of CONNECTOR_MATRIX_ROWS) {
      if (!row.connector.toLowerCase().includes('nppes')) {
        expect(row.state).not.toBe('source-backed');
      }
    }
  });

  it('NPPES row never claims source-backed at the matrix level (per-request only)', () => {
    const nppes = CONNECTOR_MATRIX_ROWS.find((r) =>
      r.connector.toLowerCase().includes('nppes'),
    );
    expect(nppes?.state).not.toBe('source-backed');
  });

  it('contains no banned phrases in any row', () => {
    const html = renderToStaticMarkup(<ConnectorMatrix />);
    assertNoBannedPhrases(html, 'ConnectorMatrix');
  });
});

describe('TrustAttributionRegister — per-field register', () => {
  it('renders one row per attribution field', () => {
    const html = renderToStaticMarkup(<TrustAttributionRegister />);
    expect(html).toContain('data-trust-attribution-register');
    expect(html).toContain('data-trust-attribution-row="display-name"');
    expect(html).toContain('data-trust-attribution-row="npi"');
    expect(html).toContain('data-trust-attribution-row="identity-status"');
    expect(html).toContain('data-trust-attribution-row="oig-leie-exclusion-result"');
    expect(html).toContain('data-trust-attribution-row="cms-pecos-enrollment"');
  });

  it('Review boundary cells are either "institution review" or "n/a"', () => {
    for (const row of TRUST_ATTRIBUTION_ROWS) {
      expect(['institution review', 'n/a']).toContain(row.reviewBoundary);
    }
  });

  // Same 2026-07-25 correction as the matrix rows above. The load-bearing
  // half of these assertions was always "not source-backed" — that still
  // holds, and is covered exhaustively by the non-NPPES test below.
  it('OIG / LEIE field is auth-required, and never source-backed', () => {
    const oig = TRUST_ATTRIBUTION_ROWS.find((r) =>
      r.field.toLowerCase().includes('oig'),
    );
    expect(oig?.state).toBe('auth-required');
    expect(oig?.retrievalTime).not.toMatch(/connector not live/i);
  });

  it('CMS PECOS field is auth-required, and never source-backed', () => {
    const pecos = TRUST_ATTRIBUTION_ROWS.find((r) =>
      r.field.toLowerCase().includes('pecos'),
    );
    expect(pecos?.state).toBe('auth-required');
    expect(pecos?.retrievalTime).not.toMatch(/connector not live/i);
  });

  it('FSMB and Nursys fields are connector-not-live, not source-backed', () => {
    const fsmb = TRUST_ATTRIBUTION_ROWS.find((r) =>
      r.field.toLowerCase().includes('fsmb'),
    );
    const nursys = TRUST_ATTRIBUTION_ROWS.find((r) =>
      r.field.toLowerCase().includes('nursys'),
    );
    expect(fsmb?.state).toBe('connector-not-live');
    expect(nursys?.state).toBe('connector-not-live');
  });

  it('contains no banned phrases in any row', () => {
    const html = renderToStaticMarkup(<TrustAttributionRegister />);
    assertNoBannedPhrases(html, 'TrustAttributionRegister');
  });

  it('every row state is one of the allowed truth states (no false positives)', () => {
    const allowed = new Set([
      'source-backed',
      'snapshot-only',
      'institution-review-required',
      'access-required',
      'auth-required',
      'temporarily-unavailable',
      'connector-not-live',
      'demo-only',
    ]);
    for (const row of TRUST_ATTRIBUTION_ROWS) {
      expect(allowed.has(row.state)).toBe(true);
    }
  });
});

describe('/trust/attribution page — disclaimer', () => {
  it('TRUST_ATTRIBUTION_DISCLAIMER contains the contracted phrase', () => {
    expect(TRUST_ATTRIBUTION_DISCLAIMER).toBe(
      'We publish the source of every field. We do not claim HIPAA, SOC 2, or NCQA certification.',
    );
  });

  it('disclaimer never claims certification', () => {
    expect(TRUST_ATTRIBUTION_DISCLAIMER.toLowerCase()).toContain(
      'do not claim',
    );
    expect(TRUST_ATTRIBUTION_DISCLAIMER.toLowerCase()).toContain(
      'hipaa, soc 2, or ncqa',
    );
  });
});
