import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  SourceHealthSnapshot,
  SourceHealthState,
  SourceId,
} from '@/lib/source-health/sourceHealthTypes';

// Covers both legacy source IDs (NPPES, PECOS, STATE_BOARD) and
// lane-level IDs (NPPES_API, PECOS_PUBLIC, STATE_LICENSE, etc.) so no raw
// identifier ever reaches a user-visible label.
const SOURCE_LABEL: Record<string, string> = {
  // Legacy operational source IDs
  NPPES: 'NPPES Registry',
  OIG_LEIE: 'OIG LEIE',
  PECOS: 'CMS PECOS',
  STATE_BOARD: 'State Board',
  // Lane-level source IDs
  NPPES_API: 'NPPES Registry',
  PECOS_PUBLIC: 'CMS PECOS',
  STATE_LICENSE: 'State Board',
  EMPLOYMENT_HISTORY: 'Employment',
  BOARD_CERT: 'Board Certification',
};

const STATE_LABEL: Record<SourceHealthState, string> = {
  LIVE: 'Live',
  DEGRADED: 'Degraded',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Unknown',
  RATE_LIMITED: 'Rate limited',
};

function stateTone(state: SourceHealthState): string {
  switch (state) {
    case 'LIVE':
      return 'text-[var(--vt-status-resolved)]';
    case 'DEGRADED':
    case 'RATE_LIMITED':
      return 'text-[var(--vt-risk-medium)]';
    case 'UNAVAILABLE':
      return 'text-[var(--vt-severity-critical)]';
    case 'UNKNOWN':
    default:
      return 'text-muted-foreground';
  }
}

function relativeFromNow(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'no successful read';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'no successful read';
  const deltaMs = Math.max(0, now.getTime() - t);
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export interface LaneHealthBadgeProps {
  snapshot: SourceHealthSnapshot;
  className?: string;
}

/**
 * Compact lane health badge. Provenance-safe: NEVER renders verified-style
 * chrome for non-LIVE states. The badge shows source + state + relative
 * lastSuccessAt, with the `reason` exposed via title (tooltip).
 */
export function LaneHealthBadge({ snapshot, className }: LaneHealthBadgeProps) {
  const sourceLabel = SOURCE_LABEL[snapshot.sourceId] ?? snapshot.sourceId;
  const stateLabel = STATE_LABEL[snapshot.state];
  const relative = relativeFromNow(snapshot.lastSuccessAt);

  const title = [
    `Source: ${sourceLabel}`,
    `State: ${stateLabel}`,
    `Reason: ${snapshot.reason}`,
    `Observed: ${snapshot.observedAt}`,
    `Last success: ${snapshot.lastSuccessAt ?? 'none'}`,
  ].join('\n');

  return (
    <span
      className={cn('flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2', className)}
      title={title}
      data-source-id={snapshot.sourceId}
      data-source-state={snapshot.state}
    >
      <Badge
        variant="outline"
        className={cn(
          'rounded-full border-border bg-card px-2.5 py-1 text-xs font-medium',
          stateTone(snapshot.state),
        )}
      >
        <span className="font-medium">{sourceLabel}</span>
        <span aria-hidden="true" className="mx-1 text-muted-foreground/60">
          /
        </span>
        <span>{stateLabel}</span>
      </Badge>
      <span className="shrink-0 text-xs text-muted-foreground">{relative}</span>
    </span>
  );
}

export default LaneHealthBadge;
