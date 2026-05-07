import * as React from 'react';
import { LABEL_QUALIFIER_V2 } from '@/lib/roi-v2/label-qualifier';
import type {
  RoiV2Decisions,
  RoiV2Hours,
  RoiV2Pilot,
  RoiV2Ttfd,
} from '@/lib/roi-v2/types';
import { HeadlineMetric } from './HeadlineMetric';

export interface RoiHeadlineStripProps {
  pilot: RoiV2Pilot;
  decisions: RoiV2Decisions;
  hours: RoiV2Hours;
  ttfd: RoiV2Ttfd;
}

/**
 * Four-card headline strip for the ROI Console v2.
 *
 * Card 3 (`At your default wage`) is the wage-gated render path: when
 * `pilot.defaultWageUsd` is null, it replaces the dollar metric with a CTA
 * card pointing back to Activation Step 1. Hours-only is a first-class
 * state, never a degraded one.
 */
export function RoiHeadlineStrip({
  pilot,
  decisions,
  hours,
  ttfd,
}: RoiHeadlineStripProps) {
  const wage = pilot.defaultWageUsd;
  const dollarsK =
    wage != null
      ? Math.round((hours.observedSavedHours * wage) / 100) / 10
      : null;
  const projDollarsK =
    wage != null
      ? Math.round((hours.projectedTotalHoursAt30d * wage) / 100) / 10
      : null;

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 md:col-span-3">
        <HeadlineMetric
          label="Decisions logged"
          value={decisions.decided.toLocaleString()}
          unit={`of ${decisions.staged} staged`}
          sub={`${decisions.acceptedFirstPass} accepted first-pass · ${decisions.disputed} disputed`}
          qualifier={LABEL_QUALIFIER_V2.decisions}
          accent
        />
      </div>
      <div className="col-span-12 md:col-span-3">
        <HeadlineMetric
          label="Reviewer-hours saved"
          value={`${hours.observedSavedHours}h`}
          sub={`Projecting ~${hours.projectedTotalHoursAt30d}h at 30d`}
          qualifier={LABEL_QUALIFIER_V2.hours}
        />
      </div>
      <div className="col-span-12 md:col-span-3">
        {wage != null && dollarsK != null && projDollarsK != null ? (
          <HeadlineMetric
            label="At your default wage"
            value={`$${dollarsK}K`}
            sub={`Projecting ~$${projDollarsK}K at 30d · $${wage}/hr`}
            qualifier={LABEL_QUALIFIER_V2.dollars}
          />
        ) : (
          <div className="border border-dashed border-slate-300 rounded-[3px] bg-slate-50/40 px-5 py-4 h-full">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
              Dollar equivalents
            </div>
            <p className="text-[12px] text-slate-600 leading-[1.55]">
              Add a default wage in Activation Step&nbsp;1 to see dollar
              equivalents. Hours-only is fine &mdash; the math doesn&rsquo;t
              change.
            </p>
          </div>
        )}
      </div>
      <div className="col-span-12 md:col-span-3">
        <HeadlineMetric
          label="Time to first decision"
          value={`${ttfd.pilotMedianHours}h`}
          unit="median"
          sub={`${ttfd.speedupVsBaselineX}× faster vs. your baseline of ${ttfd.baselineDays}d`}
          qualifier={LABEL_QUALIFIER_V2.vsBaseline}
        />
      </div>
    </div>
  );
}
