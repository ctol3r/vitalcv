'use client';

/**
 * SourceCoverageRibbon (VHS-2.3) — the static source strip becomes a living,
 * pausable provenance ribbon.
 *
 * Truth over polish: the old strip painted every lane with the same emerald
 * dot, which read as a universal "all live" signal. In reality the public
 * lanes (NPPES, OIG/LEIE, PECOS) are read live, but **state licensure is
 * access-gated** — VitalCV cannot read it without agreements. This ribbon
 * shows each lane's real availability, and the state is carried by a WORD, not
 * colour alone (WCAG). It never implies a per-clinician result — it names the
 * sources VitalCV reads, nothing more.
 *
 * Marquee is progressive enhancement: it pauses on hover/focus and via an
 * explicit control, and collapses to a static wrapped list under
 * `prefers-reduced-motion` (CSS). The belt is clipped so it can never cause
 * page-level horizontal overflow.
 */

import * as React from 'react';
import { Pause, Play } from 'lucide-react';
import styles from './SourceCoverageRibbon.module.css';
import { cn } from '@/lib/utils';

type LaneAvailability = 'live' | 'gated';

interface SourceLane {
  name: string;
  availability: LaneAvailability;
}

/** Real lane names only — mirrors the launch source spine. */
const LANES: ReadonlyArray<SourceLane> = [
  { name: 'NPPES NPI Registry', availability: 'live' },
  { name: 'OIG LEIE Exclusions', availability: 'live' },
  { name: 'CMS PECOS Enrollment', availability: 'live' },
  { name: 'State license boards', availability: 'gated' },
];

const AVAILABILITY_META: Record<
  LaneAvailability,
  { label: string; sr: string; color: string }
> = {
  live: {
    label: 'read live',
    sr: 'public source, read live',
    color: 'var(--vt-accent-emerald)',
  },
  gated: {
    label: 'access-gated',
    sr: 'access-gated source, not read without an agreement',
    color: 'var(--vt-state-stale, #a2670b)',
  },
};

function Lane({ lane, dupe }: { lane: SourceLane; dupe?: boolean }) {
  const meta = AVAILABILITY_META[lane.availability];
  return (
    <li
      data-source-lane={dupe ? undefined : lane.availability}
      aria-hidden={dupe ? true : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--vt-text-secondary)]',
        dupe && styles.dupe,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: meta.color }}
      />
      <span>{lane.name}</span>
      <span
        className="font-mono text-[10px] uppercase tracking-[0.1em]"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
      {!dupe && <span className="sr-only">— {meta.sr}</span>}
    </li>
  );
}

export function SourceCoverageRibbon() {
  const [paused, setPaused] = React.useState(false);

  return (
    <section
      aria-label="Primary sources VitalCV reads"
      data-home-source-strip=""
      data-source-ribbon=""
      className="border-y border-[var(--vt-border-subtle)] py-3.5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex shrink-0 items-center gap-2">
          <p className="mz-eyebrow">Reads primary sources</p>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            data-source-ribbon-pause={paused ? 'off' : 'on'}
            aria-label={paused ? 'Resume the source ribbon' : 'Pause the source ribbon'}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-muted)] transition-colors hover:text-[var(--vt-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vt-focus-ring)]"
          >
            {paused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
          </button>
        </div>

        <div className={cn('min-w-0 flex-1', styles.viewport)}>
          <ul
            className={styles.belt}
            data-source-ribbon-belt=""
            data-paused={paused ? 'true' : 'false'}
          >
            {LANES.map((lane) => (
              <Lane key={lane.name} lane={lane} />
            ))}
            {/* Seamless-loop duplicate — decorative, hidden under reduced motion. */}
            {LANES.map((lane) => (
              <Lane key={`dupe-${lane.name}`} lane={lane} dupe />
            ))}
          </ul>
        </div>

        <p className="shrink-0 text-[11px] text-[var(--vt-text-muted)]">
          Public lanes read live; licensure is access-gated.
        </p>
      </div>
    </section>
  );
}

export default SourceCoverageRibbon;
