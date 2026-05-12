/**
 * ReplayStatusChip — compact inline indicator of a replay run's state.
 *
 * Self-contained component: minimal monochrome styling inline so this
 * PR can ship standalone off origin/main without depending on the
 * unmerged design-tokens stack (#323). When #323 lands, a follow-up
 * can re-style this component using shared tokens.
 *
 * Doctrine:
 *   - Monochrome only. State encoded via glyph + ink density, never
 *     hue. Color-blind-safe by construction.
 *   - Five states (mirrors recentNpiHistory.ts ReplayState union):
 *       no_run_recorded     → "?" / faint ink
 *       in_flight           → "◐" / mid ink (animated-feeling but
 *                              static — no actual animation, per
 *                              CLAUDE.md anti-decorative-complexity)
 *       completed_clean     → "■" / strong ink
 *       completed_degraded  → "◐" / mid ink
 *       failed              → "✕" / faint ink
 *   - data-replay-state attribute matches state id for programmatic
 *     inspection.
 *   - Never renders bare-word "Verified".
 *
 * Designed to be drop-in to any results row that already knows its
 * run's replayState. Pairs with the unmerged ReplayTimeline (#323)
 * for the full-detail view.
 */

import * as React from 'react';
import { REPLAY_STATE_LABEL, type ReplayState } from '@/lib/replay/recentNpiHistory';

interface Props {
  readonly state: ReplayState;
  /** Optional run id — rendered as monospace metadata when present. */
  readonly runId?: string | null;
  /** Optional ISO timestamp surfaced as `<time>` element. */
  readonly checkedAt?: string | null;
  /** When true, hides the label and renders glyph-only (for tight rows). */
  readonly compact?: boolean;
}

// Inline grayscale palette. RGB max-diff ≤ 16 across every value, so
// any future scan for vibrant hues stays clean.
const PALETTE = {
  inkStrong: '#0a0a0a',
  inkMid: '#787877',
  inkFaint: '#a4a4a3',
  border: '#dcdcdb',
  surface: '#ffffff',
} as const;

const GLYPH_BY_STATE: Readonly<Record<ReplayState, { glyph: string; color: string }>> = {
  no_run_recorded: { glyph: '?', color: PALETTE.inkFaint },
  in_flight: { glyph: '◐', color: PALETTE.inkMid },
  completed_clean: { glyph: '■', color: PALETTE.inkStrong },
  completed_degraded: { glyph: '◐', color: PALETTE.inkMid },
  failed: { glyph: '✕', color: PALETTE.inkFaint },
};

function truncateRunId(runId: string): string {
  if (runId.length <= 12) return runId;
  return runId.slice(0, 8) + '…';
}

export function ReplayStatusChip({ state, runId, checkedAt, compact }: Props): React.ReactElement {
  const glyph = GLYPH_BY_STATE[state];
  const label = REPLAY_STATE_LABEL[state];
  return (
    <span
      data-testid="replay-status-chip"
      data-replay-state={state}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.4rem',
        padding: compact ? '0.1rem 0.4rem' : '0.2rem 0.6rem',
        border: `1px solid ${PALETTE.border}`,
        borderRadius: '2px',
        background: PALETTE.surface,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        fontSize: compact ? '11px' : '12px',
        lineHeight: 1.4,
        color: glyph.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", monospace' }}
      >
        {glyph.glyph}
      </span>
      {!compact && <span data-testid="replay-status-chip-label">{label}</span>}
      {runId && !compact && (
        <span
          style={{
            fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", monospace',
            fontSize: '10px',
            color: PALETTE.inkMid,
          }}
        >
          run {truncateRunId(runId)}
        </span>
      )}
      {checkedAt && !compact && (
        <time
          dateTime={checkedAt}
          style={{
            fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", monospace',
            fontSize: '10px',
            color: PALETTE.inkFaint,
          }}
        >
          {checkedAt}
        </time>
      )}
    </span>
  );
}
