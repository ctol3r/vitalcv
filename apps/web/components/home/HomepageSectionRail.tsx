'use client';

import * as React from 'react';

const ITEMS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'matcha', label: 'MATCHA' },
  { id: 'apply', label: 'Apply' },
  { id: 'employers', label: 'Employers' },
] as const;

/**
 * HomepageSectionRail — a compact scroll-progress rail pinned to the right edge
 * of the viewport (desktop only). Each section is a dot; its label reveals on
 * hover/focus. Replaces the former full-width sticky bar that sat under the
 * header and crowded the top of the page.
 */
export function HomepageSectionRail() {
  const [active, setActive] = React.useState<(typeof ITEMS)[number]['id']>('wallet');

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const nodes = ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id as (typeof ITEMS)[number]['id']);
      },
      { rootMargin: '-108px 0px -62% 0px', threshold: [0, 0.15, 0.4] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="homepage-section-rail" aria-label="Homepage sections" data-home-section-rail="">
      <ul>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'location' : undefined}
              onClick={() => setActive(item.id)}
            >
              <span className="homepage-section-rail__dot" aria-hidden="true" />
              <span className="homepage-section-rail__label">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default HomepageSectionRail;
