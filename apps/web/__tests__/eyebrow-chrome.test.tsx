// @vitest-environment jsdom

/**
 * The UX-V1 eyebrow's contracts: public-route gating, the dark/light
 * register defaults, the single dominant action and its per-route
 * suppression, exactly one quiet sign-in, the full-takeover index menu
 * (open / Escape / focus return / scroll lock / complete nav registry), the
 * homepage beat ticker, and a plain route cue instead of a link row.
 *
 * Geometry (constant 64px height across scroll and inversion) is a browser
 * measurement — pinned in tests/e2e/eyebrow.spec.ts, not here.
 */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameRef = { current: '/' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

import Eyebrow, { HOME_BEAT_EVENT } from '@/components/layout/Eyebrow';
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

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
  document.body.innerHTML = '';
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
  it('renders the eyebrow on the homepage in the dark register', async () => {
    await mount(<Eyebrow />);
    const header = container.querySelector('header.vcv-eb');
    expect(header).not.toBeNull();
    expect(header!.getAttribute('data-eb-theme')).toBe('dark');
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
});

describe('the right cluster: one quiet sign-in, at most one dominant action', () => {
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
      await act(async () => root!.unmount());
      root = null;
      document.body.innerHTML = '';
    }
  });

  it("suppresses the action on the action's own destination", async () => {
    for (const path of ['/employers', '/onboarding']) {
      pathnameRef.current = path;
      await mount(<Eyebrow />);
      expect(container.querySelector('.vcv-eb__cta')).toBeNull();
      await act(async () => root!.unmount());
      root = null;
      document.body.innerHTML = '';
    }
  });
});

describe('the center: product state on /, route context elsewhere', () => {
  it('shows the static ticker before any beat arrives', async () => {
    await mount(<Eyebrow />);
    expect(container.querySelector('.vcv-eb__ticker')?.textContent).toBe('How VitalCV works');
  });

  it('follows the work surface beats through the custom event', async () => {
    await mount(<Eyebrow />);
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(HOME_BEAT_EVENT, { detail: { label: 'Finding sources' } }),
      );
    });
    expect(container.querySelector('.vcv-eb__ticker')?.textContent).toBe('Finding sources');
  });

  it('shows a non-interactive route cue off the homepage, never a link row', async () => {
    pathnameRef.current = '/pricing';
    await mount(<Eyebrow />);
    const cue = container.querySelector('.vcv-eb__context');
    expect(cue?.textContent).toBe('Your profile, ready for every move');
    expect(container.querySelector('.vcv-eb__center-nav')).toBeNull();
    expect(container.querySelectorAll('.vcv-eb__navlink')).toHaveLength(0);
    expect(container.querySelector('nav[aria-label="Primary"]')).toBeNull();
    expect(container.querySelector('.vcv-eb__ticker')).toBeNull();
  });

  it('uses the employer route cue without reviving the old employer link', async () => {
    pathnameRef.current = '/employers/team';
    await mount(<Eyebrow />);
    const cue = container.querySelector('.vcv-eb__context');
    expect(cue?.textContent).toBe('Hiring teams');
    expect(cue?.getAttribute('data-header-context')).toBe('employer');
  });
});

describe('the full-takeover index menu', () => {
  const trigger = () => container.querySelector<HTMLButtonElement>('.vcv-eb__menu-btn')!;

  it('opens as a modal dialog listing the complete nav registry', async () => {
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

  it('the close control closes it too', async () => {
    await mount(<Eyebrow />);
    await click(trigger());
    await click(container.querySelector('.vcv-eb-menu__close')!);
    expect(container.querySelector('#vcv-eb-menu')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
