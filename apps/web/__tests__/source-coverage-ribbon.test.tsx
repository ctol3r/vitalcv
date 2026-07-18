/**
 * source-coverage-ribbon.test.tsx — VHS-2.3.
 *
 * The living source ribbon must tell the truth the old static strip blurred:
 * public lanes (NPPES/OIG/PECOS) are read live, but state licensure is
 * ACCESS-GATED — and that state is carried by a word, not colour alone. Also
 * guards real-names-only, the pause control, and no over-claiming copy.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SourceCoverageRibbon } from '@/components/home/SourceCoverageRibbon';

const BANNED = /\bverified\b|\bguaranteed verification\b|\baccepted everywhere\b|\bHIPAA compliant\b/i;
const html = () => renderToStaticMarkup(<SourceCoverageRibbon />);

describe('SourceCoverageRibbon — honest lane availability', () => {
  it('names only real source lanes', () => {
    const out = html();
    for (const name of ['NPPES NPI Registry', 'OIG LEIE Exclusions', 'CMS PECOS Enrollment', 'State license boards']) {
      expect(out).toContain(name);
    }
  });

  it('marks state licensure as access-gated, never live', () => {
    const out = html();
    // The gated lane exists and is tagged gated (not live).
    expect(out).toContain('data-source-lane="gated"');
    expect(out).toContain('access-gated');
    // The gated lane's accessible text says so.
    expect(out).toMatch(/access-gated source/i);
  });

  it('marks the public lanes as read live', () => {
    const out = html();
    expect(out).toContain('data-source-lane="live"');
    expect(out).toContain('read live');
  });

  it('carries state as a WORD, not colour alone (no colour-only lanes)', () => {
    const out = html();
    // Every accessible lane renders a textual state label.
    const liveLabels = (out.match(/read live/g) ?? []).length;
    const gatedLabels = (out.match(/access-gated/g) ?? []).length;
    expect(liveLabels).toBeGreaterThan(0);
    expect(gatedLabels).toBeGreaterThan(0);
  });

  it('ships a keyboard-operable pause control and the honest framing note', () => {
    const out = html();
    expect(out).toMatch(/aria-label="Pause the source ribbon"/);
    expect(out).toContain('Public lanes read live; licensure is access-gated');
  });

  it('never over-claims', () => {
    expect(BANNED.test(html())).toBe(false);
  });
});
