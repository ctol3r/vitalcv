'use client';

import * as React from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoiV2MethodologyRow } from '@/lib/roi-v2/types';

export interface MethodologyPanelProps {
  rows: RoiV2MethodologyRow[];
}

/**
 * Collapsible "How this math works" panel. Surfaces the methodology footnotes
 * verbatim so a reader can audit how the math is computed on the surface.
 *
 * Required by the truth contract: ROI numbers must be transparently derived,
 * not opaque marketing claims.
 */
export function MethodologyPanel({ rows }: MethodologyPanelProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-slate-900">
            How this math works
          </span>
        </div>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-slate-400 transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.k} className="px-5 py-3 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 pt-0.5">
                {r.k}
              </div>
              <div className="col-span-12 md:col-span-9">
                <div className="font-mono text-[12px] text-slate-900">{r.v}</div>
                <p className="mt-0.5 text-[12px] text-slate-600 leading-[1.55]">
                  {r.note}
                </p>
              </div>
            </div>
          ))}
          <div className="px-5 py-3 font-mono text-[10.5px] text-slate-500 leading-[1.55]">
            We do not extrapolate beyond the pilot window. We do not benchmark
            against industry averages &mdash; only against the baseline you
            entered at activation.
          </div>
        </div>
      )}
    </div>
  );
}
