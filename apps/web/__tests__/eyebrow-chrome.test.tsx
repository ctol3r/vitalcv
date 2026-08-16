// @vitest-environment jsdom

/**
 * The floating GLASS RAIL's contracts (shared public chrome, v4 rebuild —
 * EC-10 amendment A-4): public-route gating, the dark/light register defaults,
 * the durable primary link row, the single dominant action and its per-route
 * suppression, exactly one quiet sign-in, the shield-check verify affordance,
 * and the full-takeover index menu (toggle / Escape / re-click / route change /
 * focus return / scroll lock / visible ✕ close / complete nav registry / forced
 * dark register while open).
 *
 * Geometry (the fixed centred glass bar, its 44px targets, its constant
 * position across scroll, the mobile recomposition) is a browser measurement —
 * pinned in tests/e2e/eyebrow.spec.ts, not here.
 */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameRef = { current: '/' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

import Eyebrow from '@/components/layout/Eyebrow';
import { NAV_GROUPS, PRIMARY_NAV } from '@/components/layout/navDestinations';

let root: Root | null = null;
let container: HTMLElement;

async function mount(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
}

async function rerender(node: React.ReactNode) {
  await act(async () => {
    root!.render(node);
  });
}

async function unmount() {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
  document.body.innerHTML = '';
}

afterEach(async () => {
  await unmount();
  document.body.style.overflow = '';
});

beforeEach(() => {
  pathnameRef.current = '/';
});

const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

const pressEscape = () =>
  act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

describe('glass rail — gating and registers', () => {
  it('renders the rail on the homepage in the light register before section observation', async () => {
    await mount(<Eyebrow />);
    const header = container.querySelector('header.vcv-eb');
    expect(header).not.toBeNull();
    expect(header!.getAttribute('data-eb-theme')).toBe('light');
    const rail = container.querySelector('nav.vcv-eb__rail');
    expect(rail).not.toBeNull();
    expect(rail!.getAttribute('aria-label')).toBe('Primary');
  });

  it('renders nothing on ops surfaces', async () => {
    pathnameRef.current = '/intelligence';
    await mount(<Eyebrow />);
    expect(container.querySelector('header')).toBeNull();
  });

  it('defaults to the light register off the homepage', async () => {
    pathnameRef.current = '/trust';
    await mount(<Eyebrow />);
    const header = container.querySelector('header.vcv-eb');
    expect(header!.getAttribute('data-eb-theme')).toBe('light');
  });

  it('the homepage is full-bleed; every other public route gets the spacer', async () => {
    await mount(<Eyebrow />);
    expect(container.querySelector('.vcv-eb__space')).toBeNull();
    await unmount();

    pathnameRef.current = '/trust';
    await mount(<Eyebrow />);
    expect(container.querySelector('.vcv-eb__space')).not.toBeNull();
  });
});

describe('the rail: wordmark, the durable link row, the right cluster', () => {
  it('carries the primary link row — every PRIMARY_NAV destination, honestly reachable', async () => {
    await mount(<Eyebrow />);
    const links = container.querySelector('.vcv-eb__links');
    expect(links).not.toBeNull();
    for (const link of PRIMARY_NAV) {
      expect(links!.querySelector(`a[href="${link.href}"]`)).not.toBeNull();
    }
  });

  it('carries exactly one sign-in link', async () => {
    await mount(<Eyebrow />);
    // One in the resting rail; the takeover foot adds another only while open.
    expect(container.querySelectorAll('.vcv-eb__rail a[href="/sign-in"]').length).toBe(1);
  });

  it('the homepage action is Start with your NPI, pointing at the real entry', async () => {
    await mount(<Eyebrow />);
    const cta = container.querySelector('.vcv-eb__cta');
    expect(cta).not.toBeNull();
    expect(cta!.getAttribute('href')).toBe('/#npi');
    expect(cta!.textContent).toContain('Start with your NPI');
  });

  it('swaps the action label by route and never renders two dominant actions', async () => {
    for (const path of ['/', '/trust', '/pricing', '/verify/1234567893']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelectorAll('.vcv-eb__cta').length).toBeLessThanOrEqual(1);
      await unmount();
    }

    pathnameRef.current = '/pricing';
    await mount(<Eyebrow />);
    expect(container.querySelector('.vcv-eb__cta')!.textContent).toContain('Build my profile');
  });

  it("suppresses the action on the action's own destination", async () => {
    for (const path of ['/employers', '/onboarding']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelector('.vcv-eb__cta')).toBeNull();
      await unmount();
    }
  });

  it('the verify affordance is the shield-check, not a magnifier (#1430)', async () => {
    await mount(<Eyebrow />);
    const verify = container.querySelector('.vcv-eb__verify');
    expect(verify).not.toBeNull();
    expect(verify!.getAttribute('href')).toBe('/verify');
    expect(verify!.getAttribute('aria-label')).toBe('Verify a shared record');
    // A magnifier that opened the JWT verifier was a broken affordance (#1430).
    expect(verify!.getAttribute('aria-label')).not.toMatch(/search|look up/i);
  });

  it('carries no legacy center content — no ticker, no route cue', async () => {
    for (const path of ['/', '/pricing']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelector('.vcv-eb__ticker')).toBeNull();
      expect(container.querySelector('.vcv-eb__context')).toBeNull();
      await unmount();
    }
  });
});

describe('the full-takeover index menu', () => {
  const trigger = () => container.querySelector<HTMLButtonElement>('.vcv-eb__menu-btn')!;

  it('toggles open as a modal dialog listing the complete nav registry', async () => {
    await mount(<Eyebrow />);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    await click(trigger());
    const menu = container.querySelector('#vcv-eb-menu');
    expect(menu).not.toBeNull();
    expect(menu!.getAttribute('role')).toBe('dialog');
    expect(menu!.getAttribute('aria-modal')).toBe('true');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    for (const group of NAV_GROUPS) {
      expect(menu!.textContent).toContain(group.label);
      for (const link of group.links) {
        expect(menu!.querySelector(`a[href="${link.href}"]`)).not.toBeNull();
      }
    }
  });

  it('carries a visible close control (audit #56)', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    const close = container.querySelector('.vcv-eb-menu__close');
    expect(close).not.toBeNull();
    expect(close!.tagName).toBe('BUTTON');
    expect(close!.textContent).toContain('Close');
    await click(close!);
    expect(container.querySelector('#vcv-eb-menu')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('forces the dark register while open — the chrome sits on ink', async () => {
    pathnameRef.current = '/trust';
    await mount(<Eyebrow />);
    const header = container.querySelector('header.vcv-eb')!;
    expect(header.getAttribute('data-eb-theme')).toBe('light');
    await click(trigger());
    expect(header.getAttribute('data-eb-theme')).toBe('dark');
    await pressEscape();
    expect(header.getAttribute('data-eb-theme')).toBe('light');
  });

  it('Escape closes it, restores scroll, and returns focus to the trigger', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    expect(container.querySelector('#vcv-eb-menu')).not.toBeNull();
    await pressEscape();
    expect(container.querySelector('#vcv-eb-menu')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('the same instrument closes it — the menu toggle is the close control', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    expect(container.querySelector('#vcv-eb-menu')).not.toBeNull();
    await click(trigger());
    expect(container.querySelector('#vcv-eb-menu')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('a route change closes the takeover and restores scroll', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    expect(container.querySelector('#vcv-eb-menu')).not.toBeNull();
    pathnameRef.current = '/trust';
    await rerender(<Eyebrow />);
    expect(container.querySelector('#vcv-eb-menu')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('paints takeover → rail in DOM order — no z-index war', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    const header = container.querySelector('header.vcv-eb')!;
    const children = Array.from(header.children).map((el) => el.className || el.id);
    const menuIndex = children.findIndex((c) => String(c).includes('vcv-eb-menu'));
    const railIndex = children.findIndex((c) => String(c).includes('vcv-eb__rail'));
    expect(menuIndex).toBeGreaterThanOrEqual(0);
    expect(railIndex).toBeGreaterThan(menuIndex);
  });
});
