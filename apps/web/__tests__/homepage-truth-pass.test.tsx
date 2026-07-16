/**
 * homepage-truth-pass.test.tsx — locks the three homepage truth fixes:
 *  1. WalletPreview carries the explicit illustrative label and no fabricated
 *     readiness percentage.
 *  2. ProductCarousel mockup rows use the typed evidence-state grammar — a
 *     check glyph appears ONLY on source-backed/checked rows, never on
 *     access-required / review-needed rows (the Trust Center's promise).
 *  3. The hero NPI input still renders its count + honest microcopy (checksum
 *     gating behavior is covered by lib/vital/npi unit tests).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));
vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
}));

import HomePageClient from '@/app/HomePageClient';
import { ProductCarousel } from '@/components/home/ProductCarousel';

describe('WalletPreview — no fabricated score', () => {
  it('labels the panel illustrative and contains no percentage score', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Illustrative product preview — not your readiness result');
    expect(html).toContain('source lanes shown');
    expect(html).not.toContain('72%');
  });
});

describe('ProductCarousel — evidence-state glyph grammar', () => {
  it('never puts a check glyph on a gated or review row', () => {
    const html = renderToStaticMarkup(<ProductCarousel />);
    // Split the rendered list items and inspect the rows individually.
    const rows = html.split('<li').slice(1);
    const rowFor = (label: string) => rows.find((r) => r.includes(label));

    for (const gated of ['License · Access required', 'Licensure · Access required', 'License · Review needed']) {
      const row = rowFor(gated);
      expect(row, `row "${gated}" should render`).toBeTruthy();
      expect(row).not.toContain('lucide-circle-check');
    }
    // Affirmative rows DO carry the check.
    const backed = rowFor('NPI identity · Source-backed');
    expect(backed).toContain('lucide-circle-check');
    // Gated rows carry the lock glyph instead.
    expect(rowFor('License · Access required')).toContain('lucide-lock');
  });

  it('workflow-fact rows assert nothing (neutral dot, no state glyph)', () => {
    const html = renderToStaticMarkup(<ProductCarousel />);
    const row = html.split('<li').slice(1).find((r) => r.includes('4 claims selected'));
    expect(row).toBeTruthy();
    expect(row).not.toContain('lucide-circle-check');
    expect(row).not.toContain('lucide-lock');
  });
});

describe('Hero NPI input — honest microcopy intact', () => {
  it('renders the digit count at rest', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('0/10 digits');
  });
});
