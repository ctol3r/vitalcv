'use client';

import type { TTSEstimate } from '@/lib/tts/estimator';

interface TTSEstimateCardProps {
  estimate: TTSEstimate;
  employerName: string;
}

const CONFIDENCE_STYLE: Record<TTSEstimate['confidence'], { border: string; text: string; label: string }> = {
  high:   { border: 'border-emerald-400/20', text: 'text-emerald-300', label: 'High confidence' },
  medium: { border: 'border-amber-400/20',   text: 'text-amber-300',   label: 'Medium confidence' },
  low:    { border: 'border-red-400/20',      text: 'text-red-300',     label: 'Low confidence' },
};

export function TTSEstimateCard({ estimate, employerName }: TTSEstimateCardProps) {
  const style = CONFIDENCE_STYLE[estimate.confidence];

  return (
    <div className={`rounded-2xl border ${style.border} bg-white/[0.03] p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Estimated time to start
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {estimate.minDays}–{estimate.maxDays} days
          </p>
          <p className="text-xs text-foreground/70">
            at {employerName}
          </p>
        </div>
        <span className={`rounded-full border ${style.border} px-2 py-0.5 text-[10px] font-medium ${style.text}`}>
          {style.label}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Employer&apos;s published baseline: {estimate.baselineDays} days
      </p>

      {estimate.metRequirements.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Met</p>
          <ul className="space-y-0.5">
            {estimate.metRequirements.map((req) => (
              <li key={req} className="text-xs text-emerald-300/70 flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estimate.unmetRequirements.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Unmet</p>
          <ul className="space-y-0.5">
            {estimate.unmetRequirements.map((req) => (
              <li key={req} className="text-xs text-amber-300/70 flex items-center gap-1.5">
                <span className="text-amber-400">–</span> {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50 pt-1 border-t border-white/5">
        Estimate uses {estimate.methodology}. Actual time may vary based on employer review process.
      </p>
    </div>
  );
}
