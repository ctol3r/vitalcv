'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  type BoardFilters,
  EMPTY_BOARD_FILTERS,
  normalizeBoardFilters,
  serializeBoardFilters,
} from '@/lib/explore/board-filters';

interface OpportunityLens {
  id: string;
  title: string;
  detail: string;
  patch: Partial<BoardFilters>;
}

const LENSES: OpportunityLens[] = [
  {
    id: 'source',
    title: 'Fresh from source',
    detail: 'Observed in the past week',
    patch: { observedWithin: '7' },
  },
  {
    id: 'pay',
    title: 'Pay in view',
    detail: 'Compensation supplied by source',
    patch: { compensation: 'supplied' },
  },
  {
    id: 'vitalcv',
    title: 'Apply with VitalCV',
    detail: 'Clinician-controlled packet path',
    patch: { applicationMode: 'vitalcv' },
  },
  {
    id: 'locums',
    title: 'Locums rhythm',
    detail: 'Time-bounded clinical work',
    patch: { hiringType: 'locums' },
  },
  {
    id: 'remote',
    title: 'Remote care',
    detail: 'Remote setting stated',
    patch: { remote: true },
  },
  {
    id: 'advanced-practice',
    title: 'Advanced practice',
    detail: 'APP opportunity field',
    patch: { profession: 'advanced_practice' },
  },
];

function lensHref(patch: Partial<BoardFilters>): string {
  const query = serializeBoardFilters(normalizeBoardFilters({
    ...EMPTY_BOARD_FILTERS,
    ...patch,
  })).toString();
  return query ? `/explore?${query}` : '/explore';
}

function lensIsActive(filters: BoardFilters, patch: Partial<BoardFilters>): boolean {
  return Object.entries(patch).every(([key, value]) => filters[key as keyof BoardFilters] === value);
}

export function OpportunityLensRail({ filters }: { filters: BoardFilters }) {
  const rail = useRef<HTMLDivElement>(null);

  const move = (direction: -1 | 1) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.current?.scrollBy({
      left: direction * Math.max(260, rail.current.clientWidth * 0.72),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section className="opf-lenses" aria-labelledby="opf-lenses-title">
      <div className="opf-lenses-heading">
        <div>
          <p className="opf-kicker">Opportunity lenses</p>
          <h2 id="opf-lenses-title">Change the field in one move.</h2>
        </div>
        <div className="opf-lens-controls" aria-label="Move through opportunity lenses">
          <button type="button" onClick={() => move(-1)} aria-label="Previous opportunity lenses">
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Next opportunity lenses">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div ref={rail} className="opf-lens-rail" data-testid="opportunity-lens-rail">
        {LENSES.map((lens, index) => {
          const active = lensIsActive(filters, lens.patch);
          return (
            <Link
              key={lens.id}
              href={lensHref(lens.patch)}
              className="opf-lens-card"
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'page' : undefined}
            >
              <span className="opf-lens-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="opf-lens-title">{lens.title}</span>
              <span className="opf-lens-detail">{lens.detail}</span>
              <span className="opf-lens-action" aria-hidden="true">Open lens →</span>
            </Link>
          );
        })}
      </div>
      <p className="opf-lens-boundary">
        Lenses narrow source records. They are not personalized recommendations or eligibility decisions.
      </p>
    </section>
  );
}

export default OpportunityLensRail;
