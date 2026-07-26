'use client';

/**
 * SourceCoverageRibbon (VHS-2.3) — the static source strip becomes a living,
 * pausable provenance ribbon.
 *
 * Truth over polish: the old strip painted every lane with the same emerald
 * dot, which read as a universal "all live" signal. Then a later cut called
 * all three public lanes "read live" — but that was ALSO an overclaim, and a
 * worse one, because it asserted freshness the system does not have. Per
 * /api/status, only NPPES is a live registry lookup; OIG/LEIE is a **monthly
 * snapshot** (swept nightly, fails closed when stale) and CMS PECOS is a
 * **quarterly snapshot**. A quarterly snapshot can be ~90 days old, so "read
 * live" on it is exactly the kind of claim this product exists to refuse.
 *
 * So the ribbon carries three honest states — live · snapshot · access-gated —
 * each named by a WORD, not colour alone (WCAG). Cadence badges derive from
 * `lib/trust/sourceLanes.ts` (NUM-1.5), the registry that also feeds /status
 * and /api/status; the accessible descriptions mirror the registry's details.
 * It never implies a per-clinician result — it names the sources VitalCV reads
 * and how fresh each one is, nothing more.
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
import { SOURCE_LANE_OPS, type SourceLaneOps } from '@/lib/trust/sourceLanes';

type LaneAvailability = 'live' | 'snapshot' | 'gated';

interface SourceLane {
  name: string;
  availability: LaneAvailability;
  /** Short state word shown in the chip. Per-lane, because two snapshot lanes
      refresh on different cadences and that difference is real. */
  label: string;
  /** Full accessible description — mirrors app/api/status/route.ts details. */
  sr: string;
}

/**
 * Ribbon copy per lane: the full product name and the accessible description
 * stay ribbon-local wording. Lane STATE — cadence badge and availability — is
 * derived from lib/trust/sourceLanes.ts (NUM-1.5), the same registry that
 * feeds /status and /api/status, so a lane's badge cannot drift from its truth.
 */
const RIBBON_COPY: ReadonlyArray<{ laneId: string; name: string; sr: string }> = [
  {
    laneId: 'nppes_identity',
    name: 'NPPES NPI Registry',
    sr: 'public source, read live per request',
  },
  {
    laneId: 'oig_exclusions',
    name: 'OIG LEIE Exclusions',
    sr: 'monthly LEIE snapshot, swept nightly; fails closed when the cache is stale',
  },
  {
    laneId: 'pecos_enrollment',
    name: 'CMS PECOS Enrollment',
    sr: 'quarterly PECOS snapshot; snapshot age is shown as staleness',
  },
  {
    laneId: 'state_license',
    name: 'State license boards',
    sr: 'access-gated source, not read without an agreement',
  },
];

function availabilityOf(cadence: SourceLaneOps['readCadence']): LaneAvailability {
  if (cadence === 'per_request') return 'live';
  if (cadence === 'not_read') return 'gated';
  return 'snapshot';
}

const LANES: ReadonlyArray<SourceLane> = RIBBON_COPY.map(({ laneId, name, sr }) => {
  const lane = SOURCE_LANE_OPS.find((l) => l.laneId === laneId);
  if (!lane) throw new Error(`SourceCoverageRibbon: unknown lane ${laneId}`);
  return { name, availability: availabilityOf(lane.readCadence), label: lane.cadenceLabel, sr };
});

/** Colour reinforces the word; it never carries the state alone (WCAG). */
const AVAILABILITY_COLOR: Record<LaneAvailability, string> = {
  live: 'var(--vt-accent-emerald)',
  // A calm slate — plainly not the live emerald and not the gated amber: real
  // data, periodically refreshed, not a real-time read.
  snapshot: 'var(--vt-field-opportunity, #4c6b8a)',
  gated: 'var(--vt-state-stale, #a2670b)',
};

function Lane({ lane, dupe }: { lane: SourceLane; dupe?: boolean }) {
  const color = AVAILABILITY_COLOR[lane.availability];
  const live = lane.availability === 'live';
  return (
    <li
      data-source-lane={dupe ? undefined : lane.availability}
      aria-hidden={dupe ? true : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--vt-text-secondary)]',
        dupe && styles.dupe,
      )}
    >
      {/* Filled dot = live read; hollow ring = a dated snapshot or a gated
          lane. A second, non-colour signal for the "not a live read" states. */}
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={live ? { background: color } : { border: `1.5px solid ${color}` }}
      />
      <span>{lane.name}</span>
      <span
        className="font-mono text-[10px] uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {lane.label}
      </span>
      {!dupe && <span className="sr-only">— {lane.sr}</span>}
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
          NPPES reads live; OIG/LEIE and PECOS are dated snapshots; licensure is access-gated.
        </p>
      </div>
    </section>
  );
}

export default SourceCoverageRibbon;
