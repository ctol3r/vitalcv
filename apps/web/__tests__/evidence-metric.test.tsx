// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnimatedMetricValue,
  formatCountFrame,
  isZeroMetric,
  METRIC_SOURCE_LABEL,
  MetricSourceTag,
  tokenizeMetric,
} from '@/components/motion/EvidenceMetric';

// NUM-1.1 design contract: count once on first entry; SSR/no-JS/reduced-motion
// render the final number immediately; ranges animate both bounds inside the
// final grammar; leading zeros keep their width; zero is a reveal, not a
// counter; the animated layer is aria-hidden beside a stable accessible value.

describe('tokenizeMetric — final grammar is preserved', () => {
  it('splits a range into two digit runs around the literal dash', () => {
    expect(tokenizeMetric('90–120')).toEqual([
      { text: '90', isDigits: true },
      { text: '–', isDigits: false },
      { text: '120', isDigits: true },
    ]);
  });

  it('keeps affixes literal', () => {
    expect(tokenizeMetric('5+')).toEqual([
      { text: '5', isDigits: true },
      { text: '+', isDigits: false },
    ]);
  });

  it('treats a leading-zero value as one run', () => {
    expect(tokenizeMetric('03')).toEqual([{ text: '03', isDigits: true }]);
  });
});

describe('isZeroMetric — zero is a statement, not a progression', () => {
  it('flags 0 and 00; never 03 or ranges', () => {
    expect(isZeroMetric('0')).toBe(true);
    expect(isZeroMetric('00')).toBe(true);
    expect(isZeroMetric('03')).toBe(false);
    expect(isZeroMetric('90–120')).toBe(false);
  });
});

describe('formatCountFrame — leading zeros and exact landings', () => {
  it('pads every frame to the leading-zero width', () => {
    expect(formatCountFrame('03', 0)).toBe('00');
    expect(formatCountFrame('03', 1)).toBe('03');
    // no spurious padding for plain numbers
    expect(formatCountFrame('120', 0)).toBe('0');
    expect(formatCountFrame('120', 1)).toBe('120');
  });

  it('is monotonic and lands exactly on the final value', () => {
    let prev = -1;
    for (let p = 0; p <= 1.001; p += 0.1) {
      const v = Number(formatCountFrame('120', Math.min(1, p)));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(prev).toBe(120);
  });
});

describe('AnimatedMetricValue — SSR floor', () => {
  it('server-renders the FINAL text in both layers with the a11y contract', () => {
    const html = renderToStaticMarkup(<AnimatedMetricValue value="90–120" />);
    // animated layer is decoration; the stable final string sits beside it
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-metric-animated');
    expect(html).toContain('data-metric-final');
    expect(html.split('90–120').length - 1).toBe(2); // both layers final
    expect(html).toContain('tabular-nums');
  });

  it('zero mode server-renders at full ink (no primed dim in SSR)', () => {
    const html = renderToStaticMarkup(<AnimatedMetricValue value="00" />);
    expect(html).toContain('metric-zero');
    expect(html).not.toContain('is-primed');
    expect(html.split('00').length - 1).toBeGreaterThanOrEqual(2);
  });
});

describe('AnimatedMetricValue — client behavior', () => {
  let container: HTMLDivElement;
  let ioCallbacks: IntersectionObserverCallback[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    ioCallbacks = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          ioCallbacks.push(cb);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    // rAF completes an animation in one frame (now far past any duration)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now() + 60_000);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    container.remove();
  });

  function setReducedMotion(matches: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }

  it('reduced motion: final text immediately, no observer play needed', async () => {
    setReducedMotion(true);
    const root = createRoot(container);
    await act(async () => {
      root.render(<AnimatedMetricValue value="03" />);
    });
    const animated = container.querySelector('[data-metric-animated]');
    expect(animated?.textContent).toBe('03');
    expect(container.querySelector('[data-evidence-metric]')?.getAttribute('data-metric-played')).toBe('true');
    await act(async () => root.unmount());
  });

  it('counts to the exact final value on first entry and never replays', async () => {
    setReducedMotion(false);
    const root = createRoot(container);
    await act(async () => {
      root.render(<AnimatedMetricValue value="90–120" duration={100} />);
    });
    // primed: rewound to origin frame after mount
    expect(container.querySelector('[data-metric-animated]')?.textContent).toBe('0–0');

    const entry = [{ isIntersecting: true }] as IntersectionObserverEntry[];
    await act(async () => {
      ioCallbacks.forEach((cb) => cb(entry, {} as IntersectionObserver));
    });
    const animated = container.querySelector('[data-metric-animated]');
    expect(animated?.textContent).toBe('90–120'); // exact landing, both bounds

    // a second entry (re-scroll) changes nothing — plays once per page view
    await act(async () => {
      ioCallbacks.forEach((cb) => cb(entry, {} as IntersectionObserver));
    });
    expect(animated?.textContent).toBe('90–120');
    await act(async () => root.unmount());
  });

  it('zero mode primes a dim then reveals — never a 0→0 counter', async () => {
    setReducedMotion(false);
    const root = createRoot(container);
    await act(async () => {
      root.render(<AnimatedMetricValue value="0" />);
    });
    const animated = container.querySelector('[data-metric-animated]');
    expect(animated?.classList.contains('is-primed')).toBe(true);
    expect(animated?.textContent).toBe('0'); // text never changes in zero mode

    await act(async () => {
      ioCallbacks.forEach((cb) =>
        cb([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver),
      );
    });
    expect(animated?.classList.contains('is-primed')).toBe(false);
    expect(animated?.textContent).toBe('0');
    await act(async () => root.unmount());
  });
});

describe('MetricSourceTag', () => {
  it('renders every source class with its visible label', () => {
    for (const [cls, label] of Object.entries(METRIC_SOURCE_LABEL)) {
      const html = renderToStaticMarkup(
        <MetricSourceTag sourceClass={cls as keyof typeof METRIC_SOURCE_LABEL} />,
      );
      expect(html).toContain(`data-metric-source="${cls}"`);
      expect(html).toContain(label);
    }
  });
});
