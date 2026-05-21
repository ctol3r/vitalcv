import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Top header for the institutional pilot demonstration. Quiet,
 * dense, no marketing chrome. Renders the cohort label + pilot
 * window + a single-sentence framing line.
 */
export interface DemoSequenceHeaderProps {
  cohortLabel: string;
  pilotWindow: string;
  framing: string;
  className?: string;
}

export function DemoSequenceHeader({
  cohortLabel,
  pilotWindow,
  framing,
  className,
}: DemoSequenceHeaderProps) {
  return (
    <header
      data-slot="demo-sequence-header"
      className={cn(
        'border-b border-slate-900 bg-slate-950 px-5 py-4 text-slate-100',
        className,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Pilot demonstration · institutional view
      </div>
      <h1 className="mt-1 text-lg font-semibold">{cohortLabel}</h1>
      <div className="mt-1 font-mono text-xs text-slate-300">
        {pilotWindow}
      </div>
      <p className="mt-3 max-w-[62ch] text-sm text-slate-200">{framing}</p>
    </header>
  );
}
