import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  SourceHealthSnapshot,
  SourceHealthState,
  SourceId,
} from '@/lib/source-health/sourceHealthTypes';

const SOURCE_LABEL: Record<SourceId, string> = {
  NPPES: 'NPPES',
  OIG_LEIE: 'OIG / LEIE',
  PECOS: 'PECOS',
  STATE_BOARD: 'State board',
};

const STATE_LABEL: Record<SourceHealthState, string> = {
  LIVE: 'Live',
  DEGRADED: 'Degraded',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Unknown',
  RATE_LIMITED: 'Rate limited',
};

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

function variantFor(state: SourceHealthState): BadgeVariant {
  switch (state) {
    case 'LIVE':
      return 'trust-green';
    case 'DEGRADED':
    case 'RATE_LIMITED':
      return 'trust-yellow';
    case 'UNAVAILABLE':
      return 'trust-red';
    case 'UNKNOWN':
    default:
      return 'outline';
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
  const sourceLabel = SOURCE_LABEL[snapshot.sourceId];
  const stateLabel = STATE_LABEL[snapshot.state];
  const relative = relativeFromNow(snapshot.lastSuccessAt);
  const variant = variantFor(snapshot.state);

  const title = [
    `Source: ${sourceLabel}`,
    `State: ${stateLabel}`,
    `Reason: ${snapshot.reason}`,
    `Observed: ${snapshot.observedAt}`,
    `Last success: ${snapshot.lastSuccessAt ?? 'none'}`,
  ].join('\n');

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      title={title}
      data-source-id={snapshot.sourceId}
      data-source-state={snapshot.state}
    >
      <Badge variant={variant}>
        <span className="font-medium">{sourceLabel}</span>
        <span aria-hidden="true" className="mx-1 opacity-50">
          ·
        </span>
        <span>{stateLabel}</span>
      </Badge>
      <span className="text-xs text-muted-foreground">{relative}</span>
    </span>
  );
}

export default LaneHealthBadge;
