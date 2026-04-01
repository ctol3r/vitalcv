import { cn } from '@/lib/utils';
import type { PilotTimeToStartEstimate } from '@/lib/trust/time-to-start-estimate';

interface TimeToStartEstimateSummaryProps {
  estimate: PilotTimeToStartEstimate;
  className?: string;
}

export function TimeToStartEstimateSummary({
  estimate,
  className,
}: TimeToStartEstimateSummaryProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Time-to-start</p>
        <p className="mt-1 text-sm leading-relaxed text-white/56">
          Conservative pilot range based on current readiness, incomplete source lanes, and active blockers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Estimated start</p>
          <p className="mt-1 text-lg font-semibold text-white">{estimate.estimatedStartLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Without VitalCV</p>
          <p className="mt-1 text-sm font-medium text-white">{estimate.baselineLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Time saved</p>
          <p className="mt-1 text-sm font-medium text-white">{estimate.timeSavedLabel}</p>
        </div>
      </div>

      <p className="text-[11px] text-white/34">{estimate.disclosureLabel}</p>
    </div>
  );
}
