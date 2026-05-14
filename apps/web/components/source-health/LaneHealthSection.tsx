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
      className="rounded-2xl border border-border bg-card p-5"
    >
      <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground/85">{heading}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Operational source state for this snapshot.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {allHealthy ? 'All lanes responding' : 'Some lanes are not live'}
        </span>
      </header>

      <ul className="mb-4 grid gap-2 sm:grid-cols-2" role="list">
        {snapshots.map((snap) => (
          <li key={snap.sourceId}>
            <LaneHealthBadge snapshot={snap} />
          </li>
        ))}
      </ul>

      {unavailableLanes.length > 0 && (
        <ul
          role="list"
          className="space-y-3 border-t border-border pt-4"
          aria-label="Lanes that are not currently live"
        >
          {unavailableLanes.map((lane) => (
            <li
              key={lane.sourceId}
              className="rounded-xl border border-border bg-background px-3 py-3 text-xs leading-relaxed text-muted-foreground"
              data-unavailable-source={lane.sourceId}
              data-unavailable-state={lane.state}
            >
              <span className="font-medium text-foreground">
                {lane.sourceId}
              </span>
              <span aria-hidden="true"> - </span>
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
