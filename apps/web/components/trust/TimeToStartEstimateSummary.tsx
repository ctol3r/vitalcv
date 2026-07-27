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
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Time-to-start</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          Conservative pilot range based on current readiness, incomplete source lanes, and active blockers.
          The comparison below runs against an assumed baseline, not an observed one — we have not measured
          this start.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Estimated start</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{estimate.estimatedStartLabel}</p>
        </div>
        {/* "Without VitalCV" asserted an observed counterfactual we never ran,
            and "Time saved" asserted an outcome we never measured. Both numbers
            are arithmetic on the assumed 90-day baseline in
            lib/trust/time-to-start-estimate.ts, so the labels now say what they
            are. The measured span lives in qualified-start-measurement.ts, which
            refuses to emit a saving at all. */}
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Assumed baseline</p>
          <p className="mt-1 text-sm font-medium text-foreground">{estimate.baselineLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Projected difference</p>
          <p className="mt-1 text-sm font-medium text-foreground">{estimate.timeSavedLabel}</p>
        </div>
      </div>

      <p className="text-[11px] text-white/34">{estimate.disclosureLabel}</p>
    </div>
  );
}
