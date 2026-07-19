'use client';

import * as React from 'react';

import { useActiveChapter } from '@/components/home/scene/ChapterProgress';

const ITEMS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'matcha', label: 'MATCHA' },
  { id: 'apply', label: 'Apply' },
  { id: 'employers', label: 'Employers' },
  { id: 'start', label: 'Start' },
] as const;

/**
 * HomepageSectionRail — a compact scroll-progress rail pinned to the right edge
 * of the viewport (desktop only). Each section is a dot; its label reveals on
 * hover/focus. Replaces the former full-width sticky bar that sat under the
 * header and crowded the top of the page.
 *
 * SHD-1.3: the rail consumes the single ChapterProgress driver — its former
 * private IntersectionObserver is gone (one scroll model, one owner; forward
 * and reverse scrubbing stay symmetric because active state is a pure
 * function of scroll position). Without a provider (isolated render, tests)
 * it falls back to the first section active, which is also the SSR state.
 */
export function HomepageSectionRail() {
  const activeChapter = useActiveChapter();
  const active = activeChapter ?? ITEMS[0].id;

  return (
    <nav className="homepage-section-rail" aria-label="Homepage sections" data-home-section-rail="">
      <ul>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'location' : undefined}
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
