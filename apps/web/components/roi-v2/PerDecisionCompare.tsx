import * as React from 'react';
import { Clock } from 'lucide-react';
import { LABEL_QUALIFIER_V2 } from '@/lib/roi-v2/label-qualifier';
import type {
  RoiV2CostDrilldown,
  RoiV2Hours,
  RoiV2Pilot,
} from '@/lib/roi-v2/types';

export interface PerDecisionCompareProps {
  pilot: RoiV2Pilot;
  hours: RoiV2Hours;
  cost: RoiV2CostDrilldown;
}

/**
 * Side-by-side compare card: employer's legacy per-decision time vs. observed
 * pilot per-decision time. Right side renders a green wash to draw the eye to
 * the pilot column. Dollar conversions appear only when a wage is set.
 */
export function PerDecisionCompare({
  pilot,
  hours: _hours,
  cost,
}: PerDecisionCompareProps) {
  const wage = pilot.defaultWageUsd;
  const baselineMin = cost.baselineMinutesPerDecision;
  const pilotMin = cost.pilotMinutesPerDecision;
  const ratio = baselineMin / Math.max(pilotMin, 1);
  const baselineDollars =
    wage != null ? Math.round((baselineMin / 60) * wage * 100) / 100 : null;
  const pilotDollars =
    wage != null ? Math.round((pilotMin / 60) * wage * 100) / 100 : null;

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-slate-900">
            Per-decision compare
          </span>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          your legacy process vs. this pilot
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        <div className="px-5 py-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
            Your baseline
          </div>
          <div className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 tabular-nums leading-none">
            {baselineMin}
            <span className="text-[14px] text-slate-500 font-normal ml-1">min</span>
          </div>
          {baselineDollars != null && (
            <div className="mt-1 text-[12px] text-slate-600">
              &asymp; ${baselineDollars.toFixed(2)} / decision
            </div>
          )}
          <div className="mt-2 font-mono text-[10.5px] text-slate-500">
            {LABEL_QUALIFIER_V2.baseline}
          </div>
        </div>
        <div className="px-5 py-4 bg-emerald-50/30">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-800 mb-1">
            This pilot
          </div>
          <div className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 tabular-nums leading-none">
            {pilotMin}
            <span className="text-[14px] text-slate-500 font-normal ml-1">min</span>
          </div>
          {pilotDollars != null && (
            <div className="mt-1 text-[12px] text-slate-600">
              &asymp; ${pilotDollars.toFixed(2)} / decision
            </div>
          )}
          <div className="mt-2 font-mono text-[10.5px] text-emerald-800">
            {ratio.toFixed(1)}× faster · {LABEL_QUALIFIER_V2.vsBaseline}
          </div>
        </div>
      </div>
    </div>
  );
}
