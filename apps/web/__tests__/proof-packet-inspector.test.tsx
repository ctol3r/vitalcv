/**
 * proof-packet-inspector.test.tsx — SHD-4.2.
 *
 * The one interactive proof moment must stay honest: every claim shows its
 * source, and the chain (claim → source → retrieval → receipt → state →
 * limitation) is present; it is explicitly illustrative; the access-gated lane
 * is shown gated (never inferred present); the employer-final boundary is
 * stated; and no bare "Verified" leaks. (Selection is interactive/browser-
 * verified; here the SSR first render + the item grammar are locked.)
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ProofPacketInspector, PROOF_ITEMS } from '@/components/proof/ProofPacketInspector';

const html = renderToStaticMarkup(<ProofPacketInspector />);

describe('PROOF_ITEMS — honest evidence grammar', () => {
  it('every item carries the full chain: source, retrieval, receipt, limitation', () => {
    expect(PROOF_ITEMS.length).toBeGreaterThanOrEqual(4);
    for (const item of PROOF_ITEMS) {
      expect(item.source, `${item.id} source`).toBeTruthy();
      expect(item.retrieval, `${item.id} retrieval`).toBeTruthy();
      expect(item.receiptId, `${item.id} receipt`).toBeTruthy();
      expect(item.limitation, `${item.id} limitation`).toBeTruthy();
    }
  });

  it('names only real sources', () => {
    const sources = PROOF_ITEMS.map((i) => i.source);
    expect(sources).toContain('NPPES NPI Registry');
    expect(sources).toContain('OIG / LEIE exclusions');
    expect(sources).toContain('State Medical Board');
  });

  it('shows state licensure as gated — never present or clear', () => {
    const lic = PROOF_ITEMS.find((i) => i.id === 'licensure')!;
    expect(lic.state).toBe('gated');
    expect(lic.checkedAt).toBeUndefined(); // not retrieved → no check time
    expect(lic.limitation.toLowerCase()).toContain('gated');
  });

  it('no item claims a completed credentialing decision', () => {
    for (const item of PROOF_ITEMS) {
      expect(/\bcredentialed\b|\bcleared\b|\bguaranteed\b/i.test(item.limitation)).toBe(false);
    }
  });
});

describe('ProofPacketInspector — render', () => {
  it('lists every claim and selects the first by default (tablist)', () => {
    for (const item of PROOF_ITEMS) {
      expect(html).toContain(`data-proof-claim="${item.id}"`);
    }
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    // first item is the selected tab
    expect(html).toMatch(new RegExp(`id="proof-tab-${PROOF_ITEMS[0].id}"[^>]*aria-selected="true"`));
  });

  it('renders the selected claim chain with a canonical ProvenanceChip', () => {
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Source');
    expect(html).toContain('Retrieval');
    expect(html).toContain('Receipt');
    expect(html).toContain('Limitation');
    expect(html).toContain('data-provenance-state="checked"'); // identity default
  });

  it('is explicitly illustrative and states the employer-final boundary', () => {
    expect(html).toContain('data-proof-illustrative');
    expect(html).toMatch(/Illustrative/);
    expect(html).toMatch(/final credentialing.*remain with the institution|remain with the institution/i);
    expect(html).toMatch(/Employers begin review from this attributed evidence/);
  });

  it('never renders the bare status word "Verified"', () => {
    expect(/>\s*Verified\s*</.test(html)).toBe(false);
  });
});
