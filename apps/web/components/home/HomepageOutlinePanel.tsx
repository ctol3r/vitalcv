'use client';

import * as React from 'react';

/**
 * HomepageOutlinePanel — the floating "Block Outline" (Chris, 2026-07-18, from
 * the reader reference): a translucent panel that lists the page's sections and
 * highlights where the reader is as they scroll. Desktop-only (xl+); the sticky
 * top rail + mobile nav already cover narrow widths, so this is additive
 * orientation, not the primary nav.
 *
 * Scroll-spy is an IntersectionObserver over each section (most-visible wins);
 * the panel itself fades in once the hero has scrolled away, so it appears as a
 * floating overlay rather than hero chrome. position:fixed within the viewport,
 * so it never widens the page (the horizontal-overflow e2e guard holds).
 */

const ITEMS: ReadonlyArray<{ label: string; selector: string }> = [
  { label: 'Start', selector: '[data-home-hero]' },
  { label: 'The problem', selector: '[data-home-problem-band]' },
  { label: 'Form → System', selector: '[data-home-manifesto]' },
  { label: 'How it moves', selector: '[data-home-sticky-product-story]' },
  { label: 'Evidence', selector: '[data-home-evidence-truth]' },
  { label: 'The product', selector: '[data-home-product-carousel]' },
  { label: 'Employers', selector: '#employers' },
];

export function HomepageOutlinePanel() {
  const [active, setActive] = React.useState(0);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const nodes = ITEMS.map((it) => document.querySelector(it.selector)).filter(Boolean) as Element[];
    if (nodes.length === 0) return;

    const ratios = new Map<Element, number>();
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
        let best = -1;
        let bestIdx = 0;
        ITEMS.forEach((it, i) => {
          const node = document.querySelector(it.selector);
          const r = node ? ratios.get(node) ?? 0 : 0;
          if (r > best) { best = r; bestIdx = i; }
        });
        setActive(bestIdx);
      },
      { threshold: [0.15, 0.4, 0.7], rootMargin: '-20% 0px -40% 0px' },
    );
    nodes.forEach((n) => spy.observe(n));

    // The panel appears only after the hero leaves the viewport.
    const hero = document.querySelector('[data-home-hero]');
    let gate: IntersectionObserver | null = null;
    if (hero) {
      gate = new IntersectionObserver(
        (entries) => setShown(!(entries[0]?.isIntersecting ?? true)),
        { threshold: 0.12 },
      );
      gate.observe(hero);
    }
    return () => { spy.disconnect(); gate?.disconnect(); };
  }, []);

  const jump = (selector: string) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      data-home-outline-panel=""
      aria-label="Page outline"
      className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 xl:block"
      style={{
        opacity: shown ? 1 : 0,
        transform: `translateY(-50%) translateX(${shown ? '0' : '-8px'})`,
        transition: 'opacity 280ms ease, transform 280ms ease',
        pointerEvents: shown ? 'auto' : 'none',
      }}
    >
      <div
        className="rounded-[12px] border px-3 py-3"
        style={{
          background: 'color-mix(in oklab, var(--vt-surface) 82%, transparent)',
          borderColor: 'var(--vt-border)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <p className="mb-2 pl-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
          Outline
        </p>
        <ul className="flex flex-col gap-0.5">
          {ITEMS.map((it, i) => {
            const isActive = i === active;
            return (
              <li key={it.selector}>
                <button
                  type="button"
                  onClick={() => jump(it.selector)}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex w-full items-center gap-2 rounded-md py-1 pl-2 pr-3 text-left text-[12px] transition-colors"
                  style={{
                    color: isActive ? 'var(--vt-text-primary)' : 'var(--vt-text-muted)',
                    fontWeight: isActive ? 650 : 500,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-[2px] shrink-0 rounded-full"
                    style={{ background: isActive ? 'var(--accent)' : 'var(--vt-border)' }}
                  />
                  {it.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export default HomepageOutlinePanel;
