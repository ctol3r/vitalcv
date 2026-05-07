import * as React from 'react';
import { Activity } from 'lucide-react';
import { LABEL_QUALIFIER_V2 } from '@/lib/roi-v2/label-qualifier';
import type {
  RoiV2Decisions,
  RoiV2TimelineEntry,
} from '@/lib/roi-v2/types';

export interface RoiTimelineChartProps {
  timeline: RoiV2TimelineEntry[];
  decisions: RoiV2Decisions;
}

/**
 * Decisions-per-day timeline. Pure SVG — no chart library. Observed series
 * is solid; projected series is dashed. The "today" position is marked with
 * a subtle vertical guide line.
 */
export function RoiTimelineChart({
  timeline,
  decisions,
}: RoiTimelineChartProps) {
  const W = 720;
  const H = 200;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(
    ...timeline.map((d) => Math.max(d.observed ?? 0, d.projected ?? 0)),
    12,
  );
  const xStep = innerW / Math.max(timeline.length - 1, 1);
  const xy = (i: number, v: number): [number, number] => [
    padL + i * xStep,
    padT + innerH - (v / max) * innerH,
  ];

  const obsPts: Array<[number, number] | null> = timeline.map((d, i) =>
    d.observed != null ? xy(i, d.observed) : null,
  );
  const projPts: Array<[number, number] | null> = timeline.map((d, i) =>
    d.projected != null ? xy(i, d.projected) : null,
  );

  const obsPath = obsPts
    .filter((p): p is [number, number] => p != null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
    .join(' ');
  const projPath = projPts
    .filter((p): p is [number, number] => p != null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
    .join(' ');

  const todayIdx = timeline.findIndex((d) => d.isToday);

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-slate-900">
            Decisions per day
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em]">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="h-0.5 w-4 bg-slate-900" /> observed
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="h-0.5 w-4 border-t border-dashed border-slate-500" />{' '}
            projected
          </span>
        </div>
      </div>
      <div className="px-2 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          role="img"
          aria-label={`Decisions per day. Running daily rate ${decisions.dailyDecisionRate.toFixed(1)} per day, last 3 days ${decisions.dailyRateLast3.toFixed(1)} per day.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + innerH - t * innerH;
            const v = Math.round(max * t);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  fontSize="9"
                  textAnchor="end"
                  fill="#94a3b8"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {timeline
            .filter((_, i) => i % 5 === 0 || i === timeline.length - 1)
            .map((d) => {
              const i = timeline.indexOf(d);
              const [x] = xy(i, 0);
              return (
                <text
                  key={d.day}
                  x={x}
                  y={H - 8}
                  fontSize="9"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontFamily="JetBrains Mono, monospace"
                >
                  d{d.day}
                </text>
              );
            })}

          {todayIdx >= 0 && (
            <line
              x1={padL + todayIdx * xStep}
              y1={padT}
              x2={padL + todayIdx * xStep}
              y2={padT + innerH}
              stroke="#cbd5e1"
              strokeDasharray="3 2"
              strokeWidth="1"
            />
          )}

          {projPath && (
            <path
              d={projPath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}
          {obsPath && (
            <path
              d={obsPath}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.75"
            />
          )}

          {obsPts.map((p, i) =>
            p ? <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#0f172a" /> : null,
          )}
        </svg>
      </div>
      <div className="px-5 py-2 border-t border-slate-100 font-mono text-[10.5px] text-slate-500 leading-[1.55]">
        Running daily rate: {decisions.dailyDecisionRate.toFixed(1)} decisions/day
        · last 3 days: {decisions.dailyRateLast3.toFixed(1)}/day. {LABEL_QUALIFIER_V2.rate}.
      </div>
    </div>
  );
}
