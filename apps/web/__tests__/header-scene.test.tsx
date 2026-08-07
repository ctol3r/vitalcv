// @vitest-environment jsdom

/**
 * useHeaderScene — the scene contract (FR-6): sections declare
 * `data-header-theme` / `data-header-stage`; the header reflects the
 * declaration of whichever declared section occupies the observation band,
 * with document order breaking ties. Declaration, not detection. Both
 * observers disconnect on unmount.
 */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHeaderScene } from '@/components/layout/useHeaderScene';
import type { HeaderScene } from '@/components/layout/useHeaderScene';

/** Controllable IntersectionObserver stub. */
class IOStub {
  static instances: IOStub[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed = new Set<Element>();
  disconnected = false;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    IOStub.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  takeRecords() {
    return [];
  }
  emit(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.callback(
      entries as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

function Probe({ defaults }: { defaults: HeaderScene }) {
  const scene = useHeaderScene(defaults);
  return <output data-theme={scene.theme} data-stage={scene.stage} />;
}

const DEFAULTS: HeaderScene = { theme: 'light', stage: 'your-number' };

let root: Root | null = null;
let container: HTMLElement;

async function mountProbe() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Probe defaults={DEFAULTS} />);
  });
}

function section(theme: string | null, stage: string | null): HTMLElement {
  const el = document.createElement('section');
  if (theme) el.setAttribute('data-header-theme', theme);
  if (stage) el.setAttribute('data-header-stage', stage);
  document.body.appendChild(el);
  return el;
}

const readScene = () => {
  const out = container.querySelector('output')!;
  return { theme: out.getAttribute('data-theme'), stage: out.getAttribute('data-stage') };
};

beforeEach(() => {
  IOStub.instances = [];
  vi.stubGlobal('IntersectionObserver', IOStub as unknown as typeof IntersectionObserver);
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('useHeaderScene', () => {
  it('returns the defaults until a declared section intersects the band', async () => {
    section('dark', 'sources');
    await mountProbe();
    expect(readScene()).toEqual({ theme: 'light', stage: 'your-number' });
  });

  it('reflects the declaration of the intersecting section', async () => {
    const ink = section('dark', 'sources');
    await mountProbe();
    const io = IOStub.instances[0];
    expect(io.observed.has(ink)).toBe(true);
    await act(async () => {
      io.emit([{ target: ink, isIntersecting: true }]);
    });
    expect(readScene()).toEqual({ theme: 'dark', stage: 'sources' });
  });

  it('lets the later section in document order win when several intersect', async () => {
    const hero = section('light', 'your-number');
    const ink = section('dark', 'sources');
    await mountProbe();
    const io = IOStub.instances[0];
    await act(async () => {
      io.emit([
        { target: hero, isIntersecting: true },
        { target: ink, isIntersecting: true },
      ]);
    });
    expect(readScene()).toEqual({ theme: 'dark', stage: 'sources' });
  });

  it('falls back to defaults when a section leaves the band', async () => {
    const ink = section('dark', 'permission');
    await mountProbe();
    const io = IOStub.instances[0];
    await act(async () => {
      io.emit([{ target: ink, isIntersecting: true }]);
    });
    expect(readScene().stage).toBe('permission');
    await act(async () => {
      io.emit([{ target: ink, isIntersecting: false }]);
    });
    expect(readScene()).toEqual({ theme: 'light', stage: 'your-number' });
  });

  it('ignores invalid declarations rather than reflecting them', async () => {
    const bad = section('neon', 'packet');
    await mountProbe();
    const io = IOStub.instances[0];
    await act(async () => {
      io.emit([{ target: bad, isIntersecting: true }]);
    });
    expect(readScene()).toEqual({ theme: 'light', stage: 'your-number' });
  });

  it('never observes the header itself — no feedback loop', async () => {
    const header = document.createElement('header');
    header.setAttribute('data-header-theme', 'light');
    document.body.appendChild(header);
    await mountProbe();
    expect(IOStub.instances[0].observed.has(header)).toBe(false);
  });

  it('observes sections that mount after hydration', async () => {
    await mountProbe();
    const late = section('dark', 'review');
    // The MutationObserver's re-collect is debounced by 100ms; real timers,
    // because jsdom delivers MutationObserver callbacks off the microtask
    // queue that fake timers stall.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    const io = IOStub.instances[0];
    expect(io.observed.has(late)).toBe(true);
    await act(async () => {
      io.emit([{ target: late, isIntersecting: true }]);
    });
    expect(readScene()).toEqual({ theme: 'dark', stage: 'review' });
  });

  it('disconnects both observers on unmount — nothing global leaks', async () => {
    const moDisconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    await mountProbe();
    const io = IOStub.instances[0];
    await act(async () => {
      root!.unmount();
    });
    root = null;
    expect(io.disconnected).toBe(true);
    expect(moDisconnect).toHaveBeenCalled();
    moDisconnect.mockRestore();
  });
});
