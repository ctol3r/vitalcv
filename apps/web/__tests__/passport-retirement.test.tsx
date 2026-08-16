// @vitest-environment jsdom

/**
 * /passport retirement contract (founder decision, 2026-08-07).
 *
 * The audit called for collapsing the three clinician entry points; #1090
 * made /onboarding the record-first canonical entry, and /verify/[npi]
 * already rendered the passport endpoint better. This suite pins what the
 * retirement must never lose:
 *
 *   1. /passport redirects to the canonical entry — never renders a surface.
 *   2. /passport/{10-digit} redirects to /verify/{npi} FOREVER: shipped
 *      mobile binaries hardcode that URL as their handoff fallback and
 *      cannot be redeployed. Legacy UUID ids land on /onboarding.
 *   3. Both routes are declared PUBLIC (ROUTE-01: served routes are never
 *      unclassified).
 *   4. The nav offers one clinician entry, not two.
 *   5. The Share → /apply/{bundleId} capability lives on in /holder's
 *      ShareBundleCard with the KPI-continuous request body.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Non-throwing mock: execution continues past redirect(), so a page with a
// fall-through second redirect records both — assert the FIRST call, which is
// the one production Next.js would honor (the real redirect throws).
const redirectMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import RetiredPassportPage from '@/app/passport/page';
import RetiredPassportEntityPage from '@/app/passport/[id]/page';
import { ShareBundleCard } from '@/components/holder/ShareBundleCard';
import { isPublicRoute } from '@/lib/auth/roles';
import { NAV_GROUPS } from '@/components/layout/navDestinations';

describe('retired routes redirect, never render', () => {
  it('/passport → /onboarding', async () => {
    redirectMock.mockClear();
    await RetiredPassportPage({ searchParams: Promise.resolve({}) });
    expect(redirectMock.mock.calls[0]).toEqual(['/onboarding']);
  });

  it('/passport?npi={10-digit} carries the NPI to /onboarding — historical lookup links', async () => {
    redirectMock.mockClear();
    await RetiredPassportPage({ searchParams: Promise.resolve({ npi: '1558395518' }) });
    expect(redirectMock.mock.calls[0]).toEqual(['/onboarding?npi=1558395518']);
  });

  it('/passport?npi={malformed} drops the param', async () => {
    redirectMock.mockClear();
    await RetiredPassportPage({ searchParams: Promise.resolve({ npi: '123' }) });
    expect(redirectMock.mock.calls[0]).toEqual(['/onboarding']);

    redirectMock.mockClear();
    await RetiredPassportPage({
      searchParams: Promise.resolve({ npi: '1558395518; DROP' }),
    });
    expect(redirectMock.mock.calls[0]).toEqual(['/onboarding']);
  });

  it('/passport with no searchParams promise still redirects', async () => {
    redirectMock.mockClear();
    await RetiredPassportPage({});
    expect(redirectMock.mock.calls[0]).toEqual(['/onboarding']);
  });

  it('/passport/{npi} → /verify/{npi} — the shipped-mobile deep link', async () => {
    redirectMock.mockClear();
    await RetiredPassportEntityPage({ params: Promise.resolve({ id: '1558395518' }) });
    expect(redirectMock.mock.calls[0]).toEqual(['/verify/1558395518']);
  });

  it('/passport/{uuid} → /onboarding — legacy share ids land on the entry', async () => {
    redirectMock.mockClear();
    await RetiredPassportEntityPage({
      params: Promise.resolve({ id: 'e5b1c2d3-0000-4000-8000-000000000000' }),
    });
    expect(redirectMock.mock.calls[0]).toEqual(['/onboarding']);
  });
});

describe('route declaration and nav posture', () => {
  it('both routes are declared public — never unclassified', () => {
    expect(isPublicRoute('/passport')).toBe(true);
    expect(isPublicRoute('/passport/1558395518')).toBe(true);
  });

  it('the nav offers exactly one clinician build entry, and it is /onboarding', () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs).not.toContain('/passport');
    expect(hrefs).toContain('/onboarding');
  });
});

describe('ShareBundleCard — the ported bundle share', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('posts the KPI-continuous share body and surfaces the bundle link', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return Response.json({ bundleId: 'bundle-42' });
      }),
    );

    root = createRoot(container);
    await act(async () => {
      root.render(<ShareBundleCard npi="1558395518" />);
    });

    const button = container.querySelector('button')!;
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/apply/share');
    // Verbatim from the retired PassportWallet so BundleShareEvent KPI rows
    // stay continuous across the retirement.
    expect(calls[0].body).toMatchObject({
      npi: '1558395518',
      organization_context: { organization_id: 'pilot-manual-share' },
    });
    expect(container.textContent).toContain('/apply/bundle-42');
  });
});
