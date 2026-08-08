// @vitest-environment jsdom

/**
 * The header chrome's interactive contracts: public-route gating, the
 * navigation canvas (open / Escape / focus return), and the mobile
 * overlay's modal kit (scroll lock + cleanup, Escape, focus restoration,
 * one primary action). The desktop nav previously had no rendered
 * coverage at all — the one spec that touched it ran only in the
 * film-only e2e project.
 */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameRef = { current: '/' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));
vi.mock('@/hooks/useUxTelemetry', () => ({
  useUxTelemetry: () => ({ track: vi.fn() }),
}));

import Navbar from '@/components/layout/Navbar';
import { LiquidMenu } from '@/components/layout/LiquidMenu';
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

describe('Navbar gating', () => {
  it('renders the journey header on public routes', async () => {
    await mount(<Navbar />);
    const header = container.querySelector('header.vcv-header');
    expect(header).not.toBeNull();
    // UX-V1 made `/` the dark register; the parked Navbar reads the same
    // route context the live Eyebrow does.
    expect(header!.getAttribute('data-header-theme')).toBe('dark');
    expect(header!.getAttribute('data-header-stage')).toBe('your-number');
  });

  it('renders nothing on ops surfaces', async () => {
    pathnameRef.current = '/intelligence';
    await mount(<Navbar />);
    expect(container.querySelector('header')).toBeNull();
  });

  it('stays a sticky <header> — the film rollback measures it', async () => {
    await mount(<Navbar />);
    const header = container.querySelector('header')!;
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
  });
});

describe('navigation canvas', () => {
  const trigger = () =>
    container.querySelector<HTMLButtonElement>('.vcv-header__trigger')!;

  it('opens the canvas with every group, and Escape closes it returning focus', async () => {
    await mount(<Navbar />);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    await click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const canvas = container.querySelector('#vcv-header-menu')!;
    expect(canvas.hasAttribute('hidden')).toBe(false);
    for (const group of NAV_GROUPS) {
      expect(canvas.textContent).toContain(group.label);
    }

    await pressEscape();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a pointer press outside the header', async () => {
    await mount(<Navbar />);
    await click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows at most one primary action beside Sign In', async () => {
    await mount(<Navbar />);
    expect(container.querySelectorAll('.vcv-header__cta').length).toBeLessThanOrEqual(1);
    expect(container.querySelectorAll('a[href="/sign-in"]').length).toBe(1);
  });
});

describe('mobile overlay (LiquidMenu)', () => {
  const CTA = { href: '/onboarding', label: 'Build my profile' };

  function Host({ open, onClose }: { open: boolean; onClose: () => void }) {
    const ref = React.useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={ref} type="button">
          trigger
        </button>
        <LiquidMenu
          open={open}
          onClose={onClose}
          returnFocusRef={ref}
          pathname="/"
          stage="your-number"
          railInteractive
          cta={CTA}
        />
      </>
    );
  }

  it('locks body scroll while open and restores it on close', async () => {
    const onClose = vi.fn();
    await mount(<Host open onClose={onClose} />);
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => {
      root!.render(<Host open={false} onClose={onClose} />);
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('is a modal dialog carrying the journey and the destination groups', async () => {
    await mount(<Host open onClose={() => {}} />);
    const dialog = document.querySelector('[data-liquid-menu]')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('.vcv-rail--overlay')).not.toBeNull();
    expect(dialog.querySelectorAll('.liquid-menu__group').length).toBe(NAV_GROUPS.length);
    expect(dialog.querySelectorAll('.liquid-menu__cta-primary').length).toBe(1);
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const onClose = vi.fn();
    await mount(<Host open onClose={onClose} />);
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
    await act(async () => {
      root!.render(<Host open={false} onClose={onClose} />);
    });
    expect((document.activeElement as HTMLElement)?.textContent).toBe('trigger');
  });

  it('traps Tab within the dialog', async () => {
    await mount(<Host open onClose={() => {}} />);
    // The trap operates on the panel — the scrim sits outside it.
    const panel = document.querySelector('.liquid-menu__panel')!;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const last = focusables[focusables.length - 1];
    last.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    // Wrapped to the first focusable instead of escaping the dialog.
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('omits the primary CTA when the route context supplies none', async () => {
    function Bare() {
      const ref = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={ref} type="button">
            t
          </button>
          <LiquidMenu
            open
            onClose={() => {}}
            returnFocusRef={ref}
            pathname="/onboarding"
            stage="your-number"
            railInteractive={false}
            cta={null}
          />
        </>
      );
    }
    await mount(<Bare />);
    expect(document.querySelectorAll('.liquid-menu__cta-primary').length).toBe(0);
  });
});
