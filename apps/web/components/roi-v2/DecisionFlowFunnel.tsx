import * as React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoiV2Decisions } from '@/lib/roi-v2/types';

export interface DecisionFlowFunnelProps {
  decisions: RoiV2Decisions;
}

/**
 * Decision-flow funnel rendered from observed (receipt-derived) counters.
 * Five rows in pipeline order: Staged → Decided → Accepted → Refreshed →
 * Disputed. Bar widths are normalized to the largest row.
 */
export function DecisionFlowFunnel({ decisions }: DecisionFlowFunnelProps) {
  const rows = [
    { id: 'staged', label: 'Staged in Inbox', count: decisions.staged, cls: 'bg-slate-300' },
    { id: 'decided', label: 'Decisions logged', count: decisions.decided, cls: 'bg-slate-700' },
    { id: 'accepted', label: 'Accepted first-pass', count: decisions.acceptedFirstPass, cls: 'bg-emerald-600' },
    { id: 'refreshed', label: 'Refreshed then accepted', count: decisions.refreshedAndAccepted, cls: 'bg-amber-500' },
    { id: 'disputed', label: 'Disputed', count: decisions.disputed, cls: 'bg-rose-500' },
  ];
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-slate-900">
            Decision flow this pilot
          </span>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          observed · receipt-derived
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li
            key={r.id}
            className="px-5 py-2.5 grid grid-cols-12 gap-3 items-center"
          >
            <div className="col-span-4 text-[12.5px] text-slate-700">
              {r.label}
            </div>
            <div className="col-span-6">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full', r.cls)}
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="col-span-2 text-right font-mono text-[12px] tabular-nums text-slate-900">
              {r.count}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
