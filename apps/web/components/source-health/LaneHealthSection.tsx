import * as React from 'react';

import { aggregateLaneHealth } from '@/lib/source-health/aggregateLaneHealth';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';
import { LaneHealthBadge } from './LaneHealthBadge';

export interface LaneHealthSectionProps {
  snapshots: SourceHealthSnapshot[];
  /** Optional heading override; defaults to a neutral, non-claim-y label. */
  heading?: string;
}

/**
 * Lists per-lane health badges and renders an UnavailableLane notice block
 * when any lane is non-LIVE. Pure presentation; no claims of verification.
 */
export function LaneHealthSection({
  snapshots,
  heading = 'Source operational state',
}: LaneHealthSectionProps) {
  const { unavailableLanes, allHealthy } = aggregateLaneHealth(snapshots);

  return (
    <section
      aria-label="Source operational state"
      className="rounded-lg border border-border/40 bg-card/40 p-4"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
        <span className="text-xs text-muted-foreground">
          {allHealthy ? 'All lanes responding' : 'Some lanes are not live'}
        </span>
      </header>

      <ul className="flex flex-wrap gap-2 mb-3" role="list">
        {snapshots.map((snap) => (
          <li key={snap.sourceId}>
            <LaneHealthBadge snapshot={snap} />
          </li>
        ))}
      </ul>

      {unavailableLanes.length > 0 && (
        <ul
          role="list"
          className="space-y-2 border-t border-border/40 pt-3"
          aria-label="Lanes that are not currently live"
        >
          {unavailableLanes.map((lane) => (
            <li
              key={lane.sourceId}
              className="text-xs text-muted-foreground leading-relaxed"
              data-unavailable-source={lane.sourceId}
              data-unavailable-state={lane.state}
            >
              <span className="font-medium text-foreground">
                {lane.sourceId}
              </span>
              <span aria-hidden="true"> — </span>
              <span>{lane.userFacingMessage}</span>
              {lane.retryPolicy.canRetryNow ? (
                <span className="ml-1 italic">
                  Retry suggested in ~
                  {Math.round(lane.retryPolicy.suggestedRetryAfterMs / 1000)}s.
                </span>
              ) : (
                <span className="ml-1 italic">
                  Backing off for ~
                  {Math.round(lane.retryPolicy.suggestedRetryAfterMs / 1000)}s
                  before retry.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LaneHealthSection;
