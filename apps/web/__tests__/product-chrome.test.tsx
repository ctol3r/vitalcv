// @vitest-environment jsdom

/**
 * ProductChrome + RouteTrail rendering contracts (UX-03).
 *
 * routeManifest.test coverage in navigation-contract.test.ts proves the trail
 * *logic*. This file renders the actual components, because the failure this
 * wave exists to fix was never a logic bug — it was 39 surfaces where the
 * chrome never mounted at all.
 *
 * Pinned here: mutual exclusivity with the eyebrow (exactly one instrument
 * ever renders), the breadcrumb's accessible shape, real hrefs on dynamic
 * routes, and suppression at depth 1.
 */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathnameRef = { current: '/' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

import { ProductChrome } from '@/components/navigation/ProductChrome';
import { RouteTrail } from '@/components/navigation/RouteTrail';

let root: Root | null = null;
let container: HTMLElement;

async function mountAt(pathname: string, node: React.ReactNode) {
  pathnameRef.current = pathname;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  return container;
}

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
  document.body.innerHTML = '';
});

describe('ProductChrome — where it mounts', () => {
  it('renders one 64px instrument on an employer console surface', async () => {
    const el = await mountAt('/employer/worklist', <ProductChrome />);
    const bars = el.querySelectorAll('header.vcv-pc');
    expect(bars).toHaveLength(1);
    expect(el.querySelector('.vcv-pc__section')?.textContent).toBe('Employer');
    // The way out: the section root is always reachable from the bar.
    const overview = el.querySelector<HTMLAnchorElement>('.vcv-pc__link');
    expect(overview?.getAttribute('href')).toBe('/employer/dashboard');
  });

  it('renders on the issuer tree, which previously had zero in-app links', async () => {
    const el = await mountAt('/issuer/review/req-9', <ProductChrome />);
    expect(el.querySelector('header.vcv-pc')).not.toBeNull();
    expect(el.querySelector('.vcv-pc__section')?.textContent).toBe('Issuer');
    // The issuer root is an unlinked waypoint — the bar must not offer a link
    // to a page that does not exist.
    expect(el.querySelector('.vcv-pc__link')).toBeNull();
  });

  it('stays absent on public surfaces, where the eyebrow owns the bar', async () => {
    for (const publicPath of ['/', '/pricing', '/employers', '/verify/guide']) {
      const el = await mountAt(publicPath, <ProductChrome />);
      expect(el.querySelector('header.vcv-pc'), `rendered on ${publicPath}`).toBeNull();
      await act(async () => root!.unmount());
      root = null;
    }
  });

  it('stays absent on the holder tree, which carries its own frame', async () => {
    const el = await mountAt('/holder/readiness', <ProductChrome />);
    expect(el.querySelector('header.vcv-pc')).toBeNull();
  });

  it('stays absent on ops-shell surfaces', async () => {
    const el = await mountAt('/ops/engine', <ProductChrome />);
    expect(el.querySelector('header.vcv-pc')).toBeNull();
  });

  it('names the console a cross-cutting account surface lives in', async () => {
    const el = await mountAt('/employer/profile', <ProductChrome />);
    expect(el.querySelector('.vcv-pc__section')?.textContent).toBe('Employer');
  });
});

describe('RouteTrail — the breadcrumb', () => {
  it('is an accessible breadcrumb with the current page marked', async () => {
    const el = await mountAt('/employer/review/app-12', <RouteTrail />);
    const nav = el.querySelector('nav[aria-label="Breadcrumb"]');
    expect(nav).not.toBeNull();
    expect(nav!.querySelector('ol')).not.toBeNull();

    const current = el.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Review');
    // The current crumb is never a link.
    expect(current[0].tagName).not.toBe('A');
  });

  it('carries the live id into ancestor links, never a raw pattern', async () => {
    const el = await mountAt('/issuer/psv-receipt/req-77', <RouteTrail />);
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    // The issuer workflow is genuinely five deep: Issuer › Request › Review ›
    // Policy review › Receipt candidate. Every ancestor except the unlinked
    // root carries the live request id.
    expect(hrefs).toEqual([
      '/issuer/request/req-77',
      '/issuer/review/req-77',
      '/issuer/policy-review/req-77',
    ]);
    expect(hrefs.some((h) => h?.includes('['))).toBe(false);
  });

  it('hides separators from assistive tech', async () => {
    const el = await mountAt('/employer/review/app-12', <RouteTrail />);
    const seps = el.querySelectorAll('.vcv-trail__sep');
    expect(seps.length).toBeGreaterThan(0);
    seps.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });

  it('does not render a one-item trail at a section root', async () => {
    const el = await mountAt('/employer/dashboard', <RouteTrail />);
    expect(el.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
  });

  it('does not render on an unmapped path', async () => {
    const el = await mountAt('/nowhere/at/all', <RouteTrail />);
    expect(el.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
  });

  it('gives clinician surfaces a trail back to their home', async () => {
    const el = await mountAt('/holder/opportunities/discover', <RouteTrail />);
    const labels = [...el.querySelectorAll('.vcv-trail__crumb')].map((n) => n.textContent);
    expect(labels).toEqual(['Home', 'Opportunities', 'Discover']);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/holder/home');
  });
});
