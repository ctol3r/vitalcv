// @vitest-environment jsdom

/**
 * The floating-chrome eyebrow's contracts: public-route gating, the
 * dark/light register defaults, the single dominant action and its per-route
 * suppression, exactly one quiet sign-in, the fused instrument cluster (real
 * NPI lookup + menu toggle), the full-takeover index menu (toggle / Escape /
 * focus return / scroll lock / complete nav registry / forced dark register
 * while open), the off-home spacer, and the absence of any center content —
 * the reference chrome carries none.
 *
 * Geometry (zero-height sticky group, floating instrument positions constant
 * across scroll, mobile bottom cluster) is a browser measurement — pinned in
 * tests/e2e/eyebrow.spec.ts, not here.
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
import { NAV_GROUPS } from '@/components/layout/navDestinations';

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

describe('eyebrow gating and registers', () => {
  it('renders the chrome on the homepage in the light register before section observation', async () => {
    await mount(<Eyebrow />);
    const header = container.querySelector('header.vcv-eb');
    expect(header).not.toBeNull();
    expect(header!.getAttribute('data-eb-theme')).toBe('light');
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

  it('renders the wide rectangle as inert decoration, on every public route', async () => {
    for (const path of ['/', '/trust']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      const shape = container.querySelector('.vcv-eb__shape');
      expect(shape).not.toBeNull();
      expect(shape!.getAttribute('aria-hidden')).toBe('true');
      expect(shape!.textContent).toBe('');
      expect(shape!.querySelector('a, button')).toBeNull();
      await unmount();
    }
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

describe('the right cluster: one quiet sign-in, one action, fused instruments', () => {
  it('carries exactly one sign-in link', async () => {
    await mount(<Eyebrow />);
    expect(container.querySelectorAll('a[href="/sign-in"]').length).toBe(1);
  });

  it('the homepage action is Start with your NPI, pointing at the real entry', async () => {
    await mount(<Eyebrow />);
    const cta = container.querySelector('.vcv-eb__cta');
    expect(cta).not.toBeNull();
    expect(cta!.getAttribute('href')).toBe('/#npi');
    expect(cta!.textContent).toContain('Start with your NPI');
  });

  it('never renders two dominant actions', async () => {
    for (const path of ['/', '/trust', '/pricing', '/verify/1234567893']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelectorAll('.vcv-eb__cta').length).toBeLessThanOrEqual(1);
      await unmount();
    }
  });

  it("suppresses the action on the action's own destination", async () => {
    for (const path of ['/employers', '/onboarding']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelector('.vcv-eb__cta')).toBeNull();
      await unmount();
    }
  });

  it('the verify instrument points at /verify and is labelled for what it does', async () => {
    await mount(<Eyebrow />);
    const lookup = container.querySelector('.vcv-eb__lookup');
    expect(lookup).not.toBeNull();
    expect(lookup!.getAttribute('href')).toBe('/verify');
    // The glyph and label describe /verify (check a shared record), not an NPI
    // search — a magnifier that opened the JWT verifier was a broken affordance.
    expect(lookup!.getAttribute('aria-label')).toBe('Verify a shared record');
    expect(lookup!.getAttribute('aria-label')).not.toMatch(/search|look up/i);
  });

  it('carries no center content: no ticker, no route cue, no link row', async () => {
    for (const path of ['/', '/pricing']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelector('.vcv-eb__ticker')).toBeNull();
      expect(container.querySelector('.vcv-eb__context')).toBeNull();
      expect(container.querySelector('.vcv-eb__center')).toBeNull();
      expect(container.querySelectorAll('.vcv-eb__navlink')).toHaveLength(0);
      expect(container.querySelector('nav[aria-label="Primary"]')).toBeNull();
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

  it('paints shape → takeover → instruments in DOM order — no z-index war', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    const header = container.querySelector('header.vcv-eb')!;
    const children = Array.from(header.children).map((el) => el.className || el.id);
    const shapeIndex = children.findIndex((c) => String(c).includes('vcv-eb__shape'));
    const menuIndex = children.findIndex((c) => String(c).includes('vcv-eb-menu'));
    const brandIndex = children.findIndex((c) => String(c).includes('vcv-eb__brand'));
    expect(shapeIndex).toBe(0);
    expect(menuIndex).toBeGreaterThan(shapeIndex);
    expect(brandIndex).toBeGreaterThan(menuIndex);
  });
});
