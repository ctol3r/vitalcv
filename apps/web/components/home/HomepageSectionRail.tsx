'use client';

import * as React from 'react';

const ITEMS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'matcha', label: 'MATCHA' },
  { id: 'apply', label: 'Apply' },
  { id: 'employers', label: 'Employers' },
] as const;

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
      <div>
        {ITEMS.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'location' : undefined}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </a>
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}

export default HomepageSectionRail;
