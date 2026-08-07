'use client';

/**
 * JourneyRail — the journey narrative in the shared chrome.
 *
 * Four stages: Your Number → Sources → Permission → Review. The active stage
 * is unmistakable (weight + indicator, never color alone); completed and
 * upcoming stages are distinct but quiet; a screen reader hears which stage
 * is current and what it means. Stage changes animate by CSS transition and
 * fall back to immediate state change under reduced motion.
 *
 * Interactive only where interaction is honest: on `/` each stage is a
 * native anchor into the homepage narrative (XS-4 — the browser scrolls, we
 * observe). Everywhere else the rail is a position indicator, not fake
 * navigation.
 *
 * Ordinals are deliberately absent — CD-13 retired rendered `01–06`
 * numbering; position is carried by order, the dot column, and SR text.
 */

import Link from 'next/link';
import { JOURNEY_STAGES, journeyStageIndex, type JourneyStageId } from './journeyStages';

export function JourneyRail({
  stage,
  interactive,
  variant,
  onNavigate,
}: {
  stage: JourneyStageId;
  interactive: boolean;
  variant: 'bar' | 'overlay';
  /** Overlay use: close the menu before the browser follows the anchor. */
  onNavigate?: (label: string) => void;
}) {
  const activeIndex = journeyStageIndex(stage);

  return (
    <ol
      className={`vcv-rail vcv-rail--${variant}`}
      aria-label="The VitalCV journey"
      data-rail-stage={stage}
    >
      {JOURNEY_STAGES.map((s, i) => {
        const state = i === activeIndex ? 'active' : i < activeIndex ? 'passed' : 'ahead';
        const inner = (
          <>
            <span className="vcv-rail__dot" aria-hidden="true" />
            <span className="vcv-rail__label">{s.label}</span>
            {state === 'active' ? (
              <span className="sr-only">
                {` — current stage, ${i + 1} of ${JOURNEY_STAGES.length}. ${s.srDescription}`}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={s.id} className="vcv-rail__item" data-rail-state={state}>
            {interactive ? (
              <Link
                href={s.homeAnchor}
                className="vcv-rail__stage"
                aria-current={state === 'active' ? 'step' : undefined}
                onClick={() => onNavigate?.(s.label)}
              >
                {inner}
              </Link>
            ) : (
              <span
                className="vcv-rail__stage"
                aria-current={state === 'active' ? 'step' : undefined}
              >
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default JourneyRail;
