import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Top header for the institutional intake route. Renders the
 * "first 30 seconds" framing: who VitalCV is, what it offers an
 * incoming institution, and what is NOT in scope.
 *
 * Tone: quiet, dense, no marketing flourish. Reads as institutional
 * onboarding copy, not as a sales page.
 */
export interface IntakeEntryHeaderProps {
  cohortLabel: string;
  pilotWindow: string;
  className?: string;
}

export function IntakeEntryHeader({
  cohortLabel,
  pilotWindow,
  className,
}: IntakeEntryHeaderProps) {
  return (
    <header
      data-slot="intake-entry-header"
      className={cn(
        'border-b border-slate-900 bg-slate-950 px-5 py-5 text-slate-100',
        className,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Institutional intake · receiver-side view
      </div>
      <h1 className="mt-1 text-xl font-semibold">
        Federal-source resolution, evidence reuse, institution review preserved.
      </h1>
      <p className="mt-3 max-w-[62ch] text-sm text-slate-200">
        VitalCV resolves the federal primary sources your CVO already
        consults and hands you a portable replay envelope per clinician.
        State medical board review, credentialing committee review, and
        privileging decisions remain on your existing cadence.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Cohort
          </div>
          <div className="mt-1 text-sm font-semibold">{cohortLabel}</div>
        </div>
        <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Pilot window
          </div>
          <div className="mt-1 font-mono text-sm">{pilotWindow}</div>
        </div>
      </div>
    </header>
  );
}
