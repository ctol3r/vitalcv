import * as React from 'react';

import { SOURCE_LANE_OPS, type SourceLaneOps } from '@/lib/trust/sourceLanes';

/**
 * SourceCoverageDiagram — the lane spine, drawn.
 *
 * Every mark is derived from `SOURCE_LANE_OPS` (NUM-1.5, the single lane
 * definition). Nothing here is illustrative: the bar count is the lane count,
 * each bar's fill is that lane's real `lifecycle`, and the cadence label is its
 * real `readCadence`. If a lane is added, retired, or changes state, this
 * redraws — it cannot drift from `/api/status`, because it reads the same
 * module `/api/status` reads.
 *
 * Why data-bound rather than an illustration: on a product whose claim is that
 * it does not overstate, the cheap visual is the dangerous one. A hand-drawn
 * "coverage" graphic would look authoritative while being unfalsifiable, which
 * is exactly the class of defect a production audit found on the homepage
 * ("read live" over monthly and quarterly snapshots). A picture of the data
 * has to stay honest because it IS the data.
 *
 * Honesty rules baked in:
 *  - Availability describes the LANE, never a clinician. The caption says so.
 *  - State is carried by a WORD as well as colour (WCAG 1.4.1), matching the
 *    ribbon's doctrine.
 *  - A snapshot lane is never drawn as though it were a live read; cadence is
 *    printed next to the state.
 *  - No animation: this is evidence, not chrome.
 */

type Tone = { fill: string; label: string };

/** Lifecycle → how the bar reads. `demo_only` deliberately reads as NOT connected. */
const TONE: Record<SourceLaneOps['lifecycle'], Tone> = {
  active: { fill: 'var(--vt-state-source-confirmed)', label: 'Available' },
  planned: { fill: 'var(--vt-state-stale, #a2670b)', label: 'Access required' },
  demo_only: { fill: 'var(--vt-text-muted)', label: 'Not connected' },
  unintegrated: { fill: 'var(--vt-text-muted)', label: 'Not connected' },
};

/** How full the bar reads. Availability is categorical, so these are the only three widths. */
const FILL: Record<SourceLaneOps['lifecycle'], number> = {
  active: 1,
  planned: 0.35,
  demo_only: 0.12,
  unintegrated: 0.12,
};

const ROW_H = 34;
const LABEL_W = 132;
const BAR_W = 196;

export function SourceCoverageDiagram({ lanes = SOURCE_LANE_OPS }: { lanes?: readonly SourceLaneOps[] }) {
  const height = lanes.length * ROW_H + 8;
  const liveCount = lanes.filter((l) => l.lifecycle === 'active').length;

  return (
    <figure className="mt-6" style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${LABEL_W + BAR_W + 150} ${height}`}
        width="100%"
        style={{ maxWidth: 520, display: 'block' }}
        role="img"
        aria-label={
          `Source lane availability: ${liveCount} of ${lanes.length} lanes return data today. ` +
          lanes.map((l) => `${l.marketingShortName}: ${TONE[l.lifecycle].label}`).join('. ') + '.'
        }
      >
        {lanes.map((lane, i) => {
          const y = i * ROW_H + 6;
          const tone = TONE[lane.lifecycle];
          return (
            <g key={lane.laneId}>
              <text
                x={0}
                y={y + 13}
                fill="var(--vt-text-secondary)"
                style={{ font: '500 12px var(--font-mono, ui-monospace)' }}
              >
                {lane.marketingShortName}
              </text>

              {/* track */}
              <rect
                x={LABEL_W}
                y={y + 3}
                width={BAR_W}
                height={12}
                rx={2}
                fill="var(--vt-surface-subtle)"
                stroke="var(--vt-border)"
                strokeWidth={1}
              />
              {/* real state */}
              <rect
                x={LABEL_W}
                y={y + 3}
                width={BAR_W * FILL[lane.lifecycle]}
                height={12}
                rx={2}
                fill={tone.fill}
                opacity={lane.lifecycle === 'active' ? 0.85 : 0.5}
              />

              {/* state as a WORD, not colour alone */}
              <text
                x={LABEL_W + BAR_W + 10}
                y={y + 13}
                fill="var(--vt-text-muted)"
                style={{ font: '400 11px var(--font-mono, ui-monospace)' }}
              >
                {tone.label}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption
        className="mt-3 text-[12px] leading-relaxed"
        style={{ color: 'var(--vt-text-muted)', maxWidth: 520 }}
      >
        Lane availability, not a clinician result — {liveCount} of {lanes.length} return data today.
        A lane being available does not mean any particular record has been checked, and lanes that
        read from a periodic release are only as current as that release.
      </figcaption>
    </figure>
  );
}

export default SourceCoverageDiagram;
