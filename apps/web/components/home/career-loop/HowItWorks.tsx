'use client';

/**
 * HowItWorks — the journey, explained without an NPI (2026-08-07 founder
 * directive, same wave as the header eyebrow).
 *
 * The visitor's problem this solves: understanding NPI → Sources →
 * Permission → Review without typing a digit or loading the illustrative
 * example. Four stage columns, ALL visible at once — the manifest rule
 * forbids rotating panels and carousel controls, so activation moves
 * EMPHASIS across the band, it never hides content.
 *
 * Journey vocabulary is derived, not restated: stage ids, labels and the
 * one-sentence descriptions come from JOURNEY_STAGES (the same single
 * source the header rail and the film's ChapterRail consume), and the
 * Sources vignette derives its rows from SOURCE_LANE_OPS so lane cadence
 * cannot drift from /status (the sourceCadenceSentence rule).
 *
 * Motion: one single-shot walk (your number → review) the first time the
 * band is at least half in view, then the stage heads are lightly
 * interactive. Never loops (CD-11); skipped entirely under reduced motion.
 * Everything is CSS transitions keyed off data-state — no keyframes
 * (LINT-03), no scroll listener (XS-1), no canvas path drawing (R1).
 *
 * SSR honesty: the resting server render shows every vignette in its
 * resolved state. Detail-hiding for the staged walk applies only after
 * hydration (`data-how-hydrated`) and only when motion is allowed — a
 * no-JS or reduced-motion visitor sees the complete explanation.
 */

import { useEffect, useRef, useState } from 'react';

import { JOURNEY_STAGES, type JourneyStageId } from '@/components/layout/journeyStages';
import { getReadinessDimensionLanes } from '@/lib/trust/sourceLanes';

/** One walk step ≈ enough to read a vignette; the walk visits 3 stages. */
const WALK_STEP_MS = 2000;

/** Schematic claim rows for the Permission vignette — generic claim types,
 *  never fixture people. Two travel, one is held back: the point is the
 *  choice, not the claims. */
const PERMISSION_ROWS: ReadonlyArray<{ label: string; travels: boolean }> = [
  { label: 'Identity', travels: true },
  { label: 'Licensure', travels: true },
  { label: 'Work history', travels: false },
];

function Vignette({ stageId }: { stageId: JourneyStageId }) {
  switch (stageId) {
    case 'your-number':
      /* Ten slots taking a value — never ten digits (a rendered 10-digit
         string would read as a real NPI; home-artifact-provenance bans the
         pattern for exactly that reason). */
      return (
        <div className="clh-how-npi" aria-hidden="true">
          {Array.from({ length: 10 }, (_, d) => (
            <span key={d} className="clh-how-slot" style={{ ['--d' as string]: d }} />
          ))}
        </div>
      );
    case 'sources':
      return (
        <ul className="clh-how-lanes">
          {getReadinessDimensionLanes().map((lane, i) => (
            <li key={lane.laneId} style={{ ['--d' as string]: i }}>
              <span className="clh-how-lane-name">{lane.marketingShortName}</span>
              <span className="clh-how-lane-cadence">{lane.cadenceLabel}</span>
            </li>
          ))}
        </ul>
      );
    case 'permission':
      return (
        <ul className="clh-how-claims">
          {PERMISSION_ROWS.map((row, i) => (
            <li key={row.label} data-travels={row.travels ? '' : undefined} style={{ ['--d' as string]: i }}>
              <span>{row.label}</span>
              <span className="clh-how-state">{row.travels ? 'travels' : 'held back'}</span>
            </li>
          ))}
        </ul>
      );
    case 'review':
      return (
        <div className="clh-how-review">
          <span className="clh-how-node">Your packet</span>
          <span className="clh-how-line" aria-hidden="true" />
          <span className="clh-how-node clh-how-node--decides">Institution review</span>
        </div>
      );
  }
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const bandRef = useRef<HTMLOListElement | null>(null);
  const playedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    const band = bandRef.current;
    if (!band || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || playedRef.current) return;
        playedRef.current = true;
        io.disconnect();
        // The single-shot walk. A click clears these timers, so the visitor
        // always wins over the choreography.
        for (let step = 1; step < JOURNEY_STAGES.length; step += 1) {
          timersRef.current.push(window.setTimeout(() => setActive(step), WALK_STEP_MS * step));
        }
      },
      { threshold: 0.5 },
    );
    io.observe(band);
    return () => {
      io.disconnect();
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const choose = (index: number) => {
    playedRef.current = true;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    setActive(index);
  };

  return (
    <section
      className="clh-room clh-room--deep clh-how"
      id="how-it-works"
      data-home-how-it-works=""
      data-header-theme="light"
      data-header-stage="your-number"
      aria-label="How VitalCV works"
    >
      <p className="clh-how-eyebrow">How VitalCV works</p>
      <div data-clh-reveal>
        <h2 className="clh-h">See the whole path before you type a <em>digit</em>.</h2>
        <p className="clh-sub">
          The same four stages the bar above narrates — here they are in the
          order they happen.
        </p>
      </div>

      <ol
        ref={bandRef}
        className="clh-how-band"
        aria-label="The VitalCV journey, stage by stage"
        data-how-hydrated={hydrated ? '' : undefined}
      >
        {JOURNEY_STAGES.map((stage, i) => (
          <li
            key={stage.id}
            className="clh-how-stage"
            data-how-stage={stage.id}
            data-active={i === active ? '' : undefined}
            data-passed={i < active ? '' : undefined}
          >
            <button
              type="button"
              className="clh-how-head"
              aria-current={i === active ? 'step' : undefined}
              onClick={() => choose(i)}
            >
              <span className="clh-how-dot" aria-hidden="true" />
              {stage.label}
            </button>
            <div className="clh-how-plate">
              <Vignette stageId={stage.id} />
            </div>
            <p className="clh-how-copy">{stage.srDescription}</p>
          </li>
        ))}
      </ol>

      <p className="clh-fine">
        Illustrative walkthrough — no lookup runs here, and nothing is recorded.
      </p>
    </section>
  );
}

export default HowItWorks;
