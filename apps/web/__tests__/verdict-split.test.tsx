/**
 * verdict-split.test.tsx — W4 two-half verify verdict.
 *
 * Guards the honest verdict logic: integrity vs issuer legitimacy are never
 * collapsed; a signature-valid-but-unrecognized-issuer is its own MIXED state;
 * revocation is a visible step that fails closed; and the overall label never
 * uses the bare word "Verified".
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  VerdictSplit,
  deriveOverallVerdict,
  type VerdictItem,
} from '@/design-system/components';

const PASS: VerdictItem[] = [{ label: 'Signature valid · ES256', status: 'pass' }];
const ISSUER_OK: VerdictItem[] = [{ label: 'Issued by vitalcv.com', status: 'pass' }];

describe('deriveOverallVerdict — honest verdicts', () => {
  it('all pass → verifiable (not the bare word "Verified")', () => {
    const v = deriveOverallVerdict(PASS, ISSUER_OK, { state: 'none-found' });
    expect(v.status).toBe('pass');
    expect(v.label).toBe('Verifiable');
    expect(/\bVerified\b/.test(v.label)).toBe(false);
  });

  it('signature valid + issuer unrecognized → a distinct MIXED state', () => {
    const v = deriveOverallVerdict(PASS, [{ label: 'Issuer not in registry', status: 'mixed' }]);
    expect(v.status).toBe('mixed');
    expect(v.label.toLowerCase()).toContain('issuer unrecognized');
  });

  it('any failed check → fails closed', () => {
    const v = deriveOverallVerdict(
      [{ label: 'Digest mismatch', status: 'fail' }],
      ISSUER_OK,
    );
    expect(v.status).toBe('fail');
    expect(v.label).toBe('Fails closed');
  });

  it('revoked → full-stop, distinct from unavailable', () => {
    const v = deriveOverallVerdict(PASS, ISSUER_OK, { state: 'revoked' });
    expect(v.status).toBe('revoked');
    expect(v.label.toLowerCase()).toContain('revoked');
    expect(v.meaning.toLowerCase()).toContain('withdrawn');
  });

  it('revocation outranks an otherwise-clean credential', () => {
    // integrity + issuer both pass, but revoked still wins.
    const v = deriveOverallVerdict(PASS, ISSUER_OK, { state: 'revoked' });
    expect(v.status).not.toBe('pass');
  });
});

describe('VerdictSplit — render', () => {
  it('renders both halves with their headings', () => {
    const html = renderToStaticMarkup(
      <VerdictSplit integrity={PASS} issuer={ISSUER_OK} revocation={{ state: 'none-found', source: 'status list', checkedAt: '2026-07-17T14:32:00Z' }} />,
    );
    expect(html).toContain('Integrity');
    expect(html).toContain('Issuer legitimacy');
    expect(html).toContain('data-verdict="pass"');
  });

  it('renders revocation as the canonical ProvenanceChip (revoked → revoked register)', () => {
    const html = renderToStaticMarkup(
      <VerdictSplit integrity={PASS} issuer={ISSUER_OK} revocation={{ state: 'revoked', source: 'issuer status list', checkedAt: '2026-06-30T00:00:00Z' }} />,
    );
    expect(html).toContain('data-verdict="revoked"');
    expect(html).toContain('data-provenance-state="revoked"');
    expect(html).toContain('data-fail-closed="true"');
  });

  it('none-found revocation renders as checked, not a bare success banner', () => {
    const html = renderToStaticMarkup(
      <VerdictSplit integrity={PASS} issuer={ISSUER_OK} revocation={{ state: 'none-found', source: 'status list', checkedAt: '2026-07-17T14:32:00Z' }} />,
    );
    expect(html).toContain('data-provenance-state="checked"');
  });

  it('never renders the bare status word "Verified"', () => {
    const html = renderToStaticMarkup(<VerdictSplit integrity={PASS} issuer={ISSUER_OK} />);
    expect(/>\s*Verified\s*</.test(html)).toBe(false);
  });
});
