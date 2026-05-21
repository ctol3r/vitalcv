import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Top header for the /demo/waste route. Reads as institutional
 * observation, not as marketing copy. The page demonstrates where
 * credentialing waste shows up; the header frames the demonstration
 * as a receiver-side audit, not as a vendor pitch.
 */
export interface WasteEntryHeaderProps {
  cohortLabel: string;
  pilotWindow: string;
  className?: string;
}

export function WasteEntryHeader({
  cohortLabel,
  pilotWindow,
  className,
}: WasteEntryHeaderProps) {
  return (
    <header
      data-slot="waste-entry-header"
      className={cn(
        'border-b border-slate-900 bg-slate-950 px-5 py-5 text-slate-100',
        className,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Operational waste · receiver-side observation
      </div>
      <h1 className="mt-1 text-xl font-semibold">
        Where credentialing operations leak time, evidence, and review.
      </h1>
      <p className="mt-3 max-w-[62ch] text-sm text-slate-200">
        This page names six places credentialing operations leak today.
        Each section pairs the leak with the institution-owned step that
        still has to happen. The page does not claim savings, ROI, or
        regulatory substitution. It demonstrates visibility, not
        elimination.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Cohort observed
          </div>
          <div className="mt-1 text-sm font-semibold">{cohortLabel}</div>
        </div>
        <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Observation window
          </div>
          <div className="mt-1 font-mono text-sm">{pilotWindow}</div>
        </div>
      </div>
    </header>
  );
}
