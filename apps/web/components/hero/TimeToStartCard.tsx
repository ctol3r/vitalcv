'use client';

import { CircleHelp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  buildTimeToStartEstimate,
  type TimeToStartSignalInput,
} from '@/lib/trust/time-to-start';

interface TimeToStartCardProps extends TimeToStartSignalInput {
  className?: string;
}

export function TimeToStartCard({
  blockers,
  gaps,
  licensureStatus,
  className = '',
}: TimeToStartCardProps) {
  const estimate = buildTimeToStartEstimate({
    blockers,
    gaps,
    licensureStatus,
  });

  return (
    <div className={`rounded-2xl border border-white/6 bg-black/15 p-4 ${className}`.trim()}>
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
          Time-to-Start
        </p>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground/48"
                role="img"
                aria-label="Time-to-start estimate details"
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-center">
              <p>{estimate.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/40">
            Without VitalCV
          </p>
          <p className="mt-1 text-sm font-semibold text-white/78">
            {estimate.withoutVitalCvLabel}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/12 bg-emerald-500/[0.06] px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-200/55">
            With VitalCV
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-200/90">
            {estimate.withVitalCvLabel}
          </p>
        </div>
        <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/40">
            Time Saved
          </p>
          <p className="mt-1 text-sm font-semibold text-white/78">
            {estimate.timeSavedLabel}
          </p>
        </div>
      </div>

      {estimate.penaltyDays > 0 ? (
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/40">
          Adjusted from the blockers and stale verification signals surfaced in this snapshot.
        </p>
      ) : null}
    </div>
  );
}
