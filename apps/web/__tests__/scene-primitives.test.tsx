// @vitest-environment jsdom

/**
 * SHD-1.2 primitive contracts. jsdom has no canvas/rAF pipeline — which is
 * exactly the point: every primitive must degrade to inert, semantic-safe
 * markup when the animated path is unavailable.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GrainOverlay } from '@/components/home/scene/GrainOverlay';
import { MagneticButton } from '@/components/home/scene/MagneticButton';
import { SceneCursor } from '@/components/home/scene/SceneCursor';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function mockMatchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: Object.entries(matches).find(([k]) => query.includes(k))?.[1] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('GrainOverlay', () => {
  it('renders an aria-hidden, pointer-transparent texture layer', () => {
    act(() => root.render(<GrainOverlay opacity={0.05} />));
    const el = host.querySelector('[data-scene-grain]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.className).toContain('pointer-events-none');
  });

  it('renders nothing at zero opacity', () => {
    act(() => root.render(<GrainOverlay opacity={0} />));
    expect(host.querySelector('[data-scene-grain]')).toBeNull();
  });
});

describe('MagneticButton', () => {
  it('preserves the child exactly — semantics live on the child, not the wrapper', () => {
    mockMatchMedia({ 'pointer: fine': true, 'prefers-reduced-motion': false });
    act(() =>
      root.render(
        <MagneticButton>
          <a href="/onboarding">Get your free CV Wallet</a>
        </MagneticButton>,
      ),
    );
    const link = host.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/onboarding');
    const wrap = host.querySelector('[data-scene-magnetic]');
    expect(wrap?.contains(link)).toBe(true);
    // wrapper is a plain span: no role, no tab stop, no aria
    expect(wrap?.tagName).toBe('SPAN');
    expect(wrap?.getAttribute('tabindex')).toBeNull();
  });

  it('applies no transform under reduced motion (pull disabled)', () => {
    mockMatchMedia({ 'pointer: fine': true, 'prefers-reduced-motion': true });
    act(() =>
      root.render(
        <MagneticButton>
          <button type="submit">Check readiness</button>
        </MagneticButton>,
      ),
    );
    const wrap = host.querySelector('[data-scene-magnetic]') as HTMLElement;
    act(() => {
      wrap.dispatchEvent(new Event('pointermove', { bubbles: true }));
    });
    expect(wrap.style.transform).toBe('');
  });
});

describe('SceneCursor', () => {
  it('renders nothing on coarse pointers', () => {
    mockMatchMedia({ 'pointer: fine': false, 'prefers-reduced-motion': false });
    act(() => root.render(<SceneCursor />));
    expect(host.querySelector('[data-scene-cursor]')).toBeNull();
  });

  it('renders nothing under prefers-reduced-motion even on fine pointers', () => {
    mockMatchMedia({ 'pointer: fine': true, 'prefers-reduced-motion': true });
    act(() => root.render(<SceneCursor />));
    expect(host.querySelector('[data-scene-cursor]')).toBeNull();
  });

  it('mounts an aria-hidden halo on fine pointers and never hides the native cursor', () => {
    mockMatchMedia({ 'pointer: fine': true, 'prefers-reduced-motion': false });
    act(() => root.render(<SceneCursor />));
    const el = host.querySelector('[data-scene-cursor]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    // The adapt contract: no global cursor:none anywhere in the runtime path.
    expect(document.documentElement.style.cursor).toBe('');
    expect(document.body.style.cursor).toBe('');
  });
});
