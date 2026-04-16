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
    <div className={`rounded-[24px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] p-4 shadow-[var(--vt-shadow-card)] ${className}`.trim()}>
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
          Time-to-Start
        </p>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center justify-center text-[var(--vt-text-muted)] transition-colors hover:text-[var(--vt-text-primary)]"
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
        <div className="rounded-2xl border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
            Without VitalCV
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--vt-text-primary)]">
            {estimate.withoutVitalCvLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--vt-badge-checked-bg)] bg-[var(--vt-badge-checked-bg)] px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-status-resolved)]">
            With VitalCV
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--vt-status-resolved)]">
            {estimate.withVitalCvLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
            Time Saved
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--vt-text-primary)]">
            {estimate.timeSavedLabel}
          </p>
        </div>
      </div>

      {estimate.penaltyDays > 0 ? (
        <p className="mt-3 text-[10px] leading-relaxed text-[var(--vt-text-muted)]">
          Adjusted from the blockers and stale source checks surfaced in this snapshot.
        </p>
      ) : null}
    </div>
  );
}
