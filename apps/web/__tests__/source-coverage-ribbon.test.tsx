/**
 * source-coverage-ribbon.test.tsx — VHS-2.3, freshness-truth revision.
 *
 * The ribbon must tell the truth the old strip blurred AND the truth a later
 * cut overclaimed: per app/api/status/route.ts, only NPPES is a live read;
 * OIG/LEIE is a MONTHLY snapshot and CMS PECOS a QUARTERLY snapshot, and state
 * licensure is ACCESS-GATED. Exactly one lane may say "read live". Each state
 * is carried by a word, not colour alone. Also guards real-names-only, the
 * pause control, and no over-claiming copy.
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

  it('marks exactly one lane — NPPES — as read live, never the snapshot lanes', () => {
    const out = html();
    // Only real lanes carry data-source-lane (dupes are aria-hidden with no
    // attribute), so exactly one "live" tag means exactly one live lane.
    expect((out.match(/data-source-lane="live"/g) ?? []).length).toBe(1);
    expect((out.match(/data-source-lane="snapshot"/g) ?? []).length).toBe(2);
    expect(out).toMatch(/monthly snapshot/i);
    expect(out).toMatch(/quarterly snapshot/i);
  });

  it('does not call a dated snapshot a live read (the freshness overclaim)', () => {
    const out = html();
    // Neither snapshot lane's visible/accessible text may claim it is read live.
    expect(out).toMatch(/monthly LEIE snapshot/i);
    expect(out).toMatch(/quarterly PECOS snapshot/i);
    expect(out).not.toMatch(/PECOS[^<]*read live/i);
  });

  it('carries state as a WORD, not colour alone (no colour-only lanes)', () => {
    const out = html();
    // Every state renders a textual label, not just a coloured dot.
    expect((out.match(/read live/g) ?? []).length).toBeGreaterThan(0);
    expect((out.match(/snapshot/g) ?? []).length).toBeGreaterThan(0);
    expect((out.match(/access-gated/g) ?? []).length).toBeGreaterThan(0);
  });

  it('ships a keyboard-operable pause control and the honest framing note', () => {
    const out = html();
    expect(out).toMatch(/aria-label="Pause the source ribbon"/);
    expect(out).toContain('NPPES reads live; OIG/LEIE and PECOS are dated snapshots; licensure is access-gated');
  });

  it('never over-claims', () => {
    expect(BANNED.test(html())).toBe(false);
  });
});
