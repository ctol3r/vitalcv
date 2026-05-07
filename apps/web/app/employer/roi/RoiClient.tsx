'use client';

import * as React from 'react';
import {
  DecisionFlowFunnel,
  HoursOnlyBanner,
  LaneBreakdownTable,
  MethodologyPanel,
  PerDecisionCompare,
  RoiConsoleHeader,
  RoiHeadlineStrip,
  RoiTimelineChart,
  TtfdSparkline,
} from '@/components/roi-v2';
import type {
  RoiV2ExportKind,
  RoiV2Snapshot,
} from '@/lib/roi-v2/types';

export interface RoiClientProps {
  /** Snapshot from the server component. Treat as immutable. */
  snapshot: RoiV2Snapshot;
}

/**
 * Client-side ROI Console v2. Owns:
 *   - The hours-only demo toggle (showcase aid; not a runtime feature flag).
 *   - The export click handler (logs `recordedBy: 'demo'` until the real
 *     export pipeline lands in a follow-up wave).
 *
 * Does NOT mutate the snapshot itself. The toggle constructs a derived view
 * by clearing `pilot.defaultWageUsd`; it does not alter the server's data.
 */
export function RoiClient({ snapshot }: RoiClientProps) {
  const [hoursOnlyDemo, setHoursOnlyDemo] = React.useState(false);

  const view = React.useMemo<RoiV2Snapshot>(() => {
    if (!hoursOnlyDemo) return snapshot;
    return {
      ...snapshot,
      pilot: { ...snapshot.pilot, defaultWageUsd: null },
    };
  }, [hoursOnlyDemo, snapshot]);

  const handleExport = React.useCallback(
    (kind: RoiV2ExportKind) => {
      // No real export pipeline yet. Log with the demo marker so a
      // production audit trail (post-TRUST-PERSIST-1 Phase 2) can claim
      // these were never real exports.
      // eslint-disable-next-line no-console
      console.log('roi-v2-export', {
        kind,
        recordedBy: 'demo',
        pilotId: view.pilot.pilotId,
      });
    },
    [view.pilot.pilotId],
  );

  const handleAddWage = React.useCallback(() => {
    // Hard navigation; the activation surface is not yet rendered as a
    // route (Wave 43 ships it). Safe placeholder.
    if (typeof window !== 'undefined') {
      window.location.href = '/employer/activation';
    }
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-5">
      <RoiConsoleHeader
        pilot={view.pilot}
        status={view.status}
        onExport={handleExport}
      />

      <HoursOnlyBanner pilot={view.pilot} onAddWage={handleAddWage} />

      <RoiHeadlineStrip
        pilot={view.pilot}
        decisions={view.decisions}
        hours={view.hours}
        ttfd={view.ttfd}
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <RoiTimelineChart
            timeline={view.timeline}
            decisions={view.decisions}
          />
          <LaneBreakdownTable
            lanes={view.laneBreakdown}
            pilot={view.pilot}
          />
          <MethodologyPanel rows={view.methodology} />
        </div>
        <aside className="col-span-12 lg:col-span-4 space-y-5">
          <DecisionFlowFunnel decisions={view.decisions} />
          <PerDecisionCompare
            pilot={view.pilot}
            hours={view.hours}
            cost={view.costDrilldown}
          />
          <TtfdSparkline ttfd={view.ttfd} />

          <div className="border border-dashed border-slate-300 rounded-[3px] bg-slate-50/30 px-4 py-3 text-[11.5px] text-slate-600 leading-[1.55]">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
              Demo control · hours-only
            </div>
            <p className="mb-2">
              Toggle to preview how the console renders for orgs that
              haven&rsquo;t entered a default wage. Both paths are first-class
              &mdash; neither is degraded.
            </p>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hoursOnlyDemo}
                onChange={(e) => setHoursOnlyDemo(e.target.checked)}
                className="accent-slate-900"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-700">
                {hoursOnlyDemo ? 'hours-only · on' : 'wage-set · on'}
              </span>
            </label>
          </div>
        </aside>
      </div>

      <div className="border-t border-slate-200 pt-4 font-mono text-[10.5px] text-slate-500 leading-[1.55]">
        Pilot {view.pilot.pilotId} · Owner {view.pilot.ownerContact} · Marketing
        tier: {view.pilot.tier}. ROI on this surface is reviewer-hours and
        decision throughput &mdash; not a comprehensive financial model.
        Comparisons are vs. your entered baseline of {view.pilot.baselineDays}d,
        not an industry average.
      </div>
    </div>
  );
}
