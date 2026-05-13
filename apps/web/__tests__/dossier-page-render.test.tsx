import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DossierPage from '../app/dossier/[receiptId]/page';

const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

async function renderPage(receiptId = 'r-002'): Promise<string> {
  const element = await DossierPage({ params: Promise.resolve({ receiptId }) });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('dossier page — render', () => {
  it('renders the demo banner + chain-consistent flag', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="dossier-demo-banner"');
    expect(html).toContain('data-is-demo="true"');
    expect(html).toContain('data-receipt-count="11"');
    expect(html).toContain('data-chain-consistent="true"');
  });

  it('renders the counts strip with all 6 cells including chain check', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="dossier-counts-strip"');
    for (const id of [
      'count-total',
      'count-source-confirmed',
      'count-attested',
      'count-anchored',
      'count-standards',
      'count-chain',
    ]) {
      expect(html).toContain(`data-testid="${id}"`);
    }
    // Demo cohort: 10/10 standards aligned, chain OK.
    expect(html).toContain('10/10');
    expect(html).toContain('OK');
  });

  it('renders the custody-ledger table with 11 rows + all 6 verbs', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="dossier-custody-table"');
    const rows = html.match(/data-row-id="r-\d{3}"/g) ?? [];
    expect(rows.length).toBe(11);
    for (const v of ['source_confirmed', 'no_match', 'no_actions', 'attested', 'committed', 'anchored']) {
      expect(html).toContain(`data-row-verb="${v}"`);
    }
  });

  it('renders the receipt-detail drilldown with envelope + signature stub', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="dossier-receipt-detail"');
    expect(html).toContain('data-receipt-id="r-002"');
    expect(html).toContain('data-testid="kv-envelope"');
    expect(html).toContain('data-testid="kv-subject"');
    expect(html).toContain('data-testid="kv-chain"');
    expect(html).toContain('data-testid="kv-signature"');
    expect(html).toContain('demo-signature');
  });

  it('renders the regulatory mapping with 10 rows and authority badges', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="dossier-reg-table"');
    const rows = html.match(/data-mapping-receipt="r-\d{3}"/g) ?? [];
    expect(rows.length).toBe(10);
    for (const auth of ['NCQA', 'TJC', 'CMS']) {
      expect(html).toContain(`data-mapping-authority="${auth}"`);
    }
    // All demo rows are satisfied.
    expect(html).toContain('data-mapping-satisfied="true"');
  });

  it('renders 3 export options, all disabled in Phase 1', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="dossier-export-section"');
    const opts = html.match(/data-testid="export-option"/g) ?? [];
    expect(opts.length).toBe(3);
    for (const id of ['json', 'pdf', 'auditor']) {
      expect(html).toContain(`data-export-id="${id}"`);
    }
    expect(html).toContain('data-disabled-reason="phase-2-pending"');
  });

  it('does not render bare "Verified" or "VERIFIED" status labels anywhere', async () => {
    const html = await renderPage();
    expect(html).not.toMatch(/>\s*Verified\s*</);
    expect(html).not.toMatch(/>\s*VERIFIED\s*</);
  });

  it('introduces no banned overclaim copy', async () => {
    const html = await renderPage();
    const lower = html.toLowerCase();
    for (const phrase of BANNED) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});
