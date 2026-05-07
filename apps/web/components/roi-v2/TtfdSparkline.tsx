import * as React from 'react';
import { LABEL_QUALIFIER_V2 } from '@/lib/roi-v2/label-qualifier';
import type { RoiV2Ttfd } from '@/lib/roi-v2/types';

export interface TtfdSparklineProps {
  ttfd: RoiV2Ttfd;
}

/**
 * Time-to-first-decision sparkline. Pure SVG. Compact secondary visual that
 * sits in the right rail under the per-decision compare card.
 */
export function TtfdSparkline({ ttfd }: TtfdSparklineProps) {
  const samples = ttfd.hourSamplesByDay;
  const W = 320;
  const H = 64;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = Math.max(max - min, 1);
  const xStep = W / Math.max(samples.length - 1, 1);

  const path = samples
    .map((v, i) => {
      const x = i * xStep;
      const y = H - 6 - ((v - min) / range) * (H - 12);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          Time to first decision · daily median
        </div>
        <div className="font-mono text-[10.5px] tabular-nums text-slate-700">
          p10 {ttfd.pilotP10Hours}h · p50 {ttfd.pilotMedianHours}h · p90{' '}
          {ttfd.pilotP90Hours}h
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`Daily median time-to-first-decision sparkline. Median ${ttfd.pilotMedianHours} hours, p10 ${ttfd.pilotP10Hours}, p90 ${ttfd.pilotP90Hours}.`}
      >
        <path d={path} fill="none" stroke="#0f172a" strokeWidth="1.5" />
        {samples.map((v, i) => {
          const x = i * xStep;
          const y = H - 6 - ((v - min) / range) * (H - 12);
          return (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#0f172a" />
          );
        })}
      </svg>
      <div className="mt-1 font-mono text-[10.5px] text-slate-500">
        Hours per decision · {ttfd.speedupVsBaselineX}× faster than your{' '}
        {ttfd.baselineDays}d baseline · {LABEL_QUALIFIER_V2.vsBaseline}
      </div>
    </div>
  );
}
