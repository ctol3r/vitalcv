'use client';

import { Badge } from '@/components/ui/badge';
import type { TTSEstimate } from '@/lib/tts/estimator';

const CONFIDENCE_STYLE: Record<TTSEstimate['confidence'], { border: string; bg: string; text: string }> = {
  high:   { border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.06]', text: 'text-emerald-300' },
  medium: { border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.06]',   text: 'text-amber-300' },
  low:    { border: 'border-rose-500/20',     bg: 'bg-rose-500/[0.06]',    text: 'text-rose-300' },
};

interface TTSEstimateCardProps {
  estimate: TTSEstimate;
  employerName: string;
}

export function TTSEstimateCard({ estimate, employerName }: TTSEstimateCardProps) {
  const style = CONFIDENCE_STYLE[estimate.confidence];

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-5`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        Estimated time to start
      </p>
      <p className={`mt-2 text-2xl font-semibold ${style.text}`}>
        {estimate.minDays}–{estimate.maxDays} days
      </p>
      <p className="mt-1 text-xs text-white/45">
        at {employerName}
      </p>

      <div className="mt-4 space-y-3">
        {estimate.metRequirements.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
              Met ({estimate.metRequirements.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {estimate.metRequirements.map(req => (
                <Badge
                  key={req}
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60"
                >
                  {req}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {estimate.unmetRequirements.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
              Unmet ({estimate.unmetRequirements.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {estimate.unmetRequirements.map(req => (
                <Badge
                  key={req}
                  variant="outline"
                  className="rounded-full border-amber-500/15 bg-amber-500/[0.06] px-2.5 py-1 text-[11px] font-medium text-amber-200/70"
                >
                  {req}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-white/6 pt-3">
        <p className="text-[10px] leading-relaxed text-white/25">
          Estimate based on employer-published requirements and current readiness snapshot.
          Employer base time to start: {estimate.baselineDays} days. Confidence: {estimate.confidence}.
          Methodology: {estimate.methodology}.
        </p>
      </div>
    </div>
  );
}
