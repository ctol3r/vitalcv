import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { PassportData } from '@/lib/trust/passport-contract';

void React;

const BAND_TONE: Record<string, 'success' | 'default' | 'warning' | 'critical'> = {
  L3: 'success',
  L2: 'success',
  L1: 'default',
  L0: 'warning',
};

export function TrustSummarySection({
  posture,
  lastCheckedAt,
}: {
  posture: PassportData['trustPosture'];
  lastCheckedAt: string;
}) {
  const tone = posture.blockers.length > 0 ? 'critical' : (BAND_TONE[posture.band] ?? 'default');
  const currentCount = posture.dimensions.filter((d) => d.state === 'current').length;
  const totalCount = posture.dimensions.length;
  const showScore = currentCount > 0;

  const toneClass: Record<string, string> = {
    success: 'border-emerald-500/15 bg-emerald-500/[0.05]',
    default: 'border-white/8 bg-white/[0.03]',
    warning: 'border-amber-500/15 bg-amber-500/[0.05]',
    critical: 'border-rose-500/15 bg-rose-500/[0.06]',
  };

  const summaryStatus =
    posture.blockers.length > 0 ? 'blocked' as const
    : posture.reviewRequiredItems.length > 0 ? 'review_required' as const
    : posture.staleItems.length > 0 ? 'stale' as const
    : currentCount > 0 ? 'checked' as const
    : 'pending' as const;

  return (
    <Card
      className={[
        'gap-0 rounded-2xl py-0 shadow-none',
        toneClass[tone] ?? toneClass.default,
      ].join(' ')}
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
              Trust summary
            </p>
            <p className="text-base font-semibold text-foreground/85">{posture.bandLabel}</p>
            <p className="text-xs text-muted-foreground">
              {currentCount}/{totalCount} dimensions verified · {posture.freshness.label}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {showScore ? posture.score : '—'}
            </p>
            <TrustStatusBadge status={summaryStatus} size="sm" />
          </div>
        </div>

        {posture.blockers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/6 pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/60">
              {posture.blockers.length} blocker{posture.blockers.length === 1 ? '' : 's'}
            </span>
            {posture.blockers.slice(0, 2).map((blocker) => (
              <Badge
                key={blocker}
                variant="outline"
                className="rounded-full border-rose-500/20 bg-rose-500/8 px-2 py-0.5 text-[10px] text-rose-200"
              >
                {blocker}
              </Badge>
            ))}
            {posture.blockers.length > 2 && (
              <span className="text-[10px] text-muted-foreground/40">
                +{posture.blockers.length - 2} more
              </span>
            )}
          </div>
        )}

        {posture.safeToRelyOnNow.length > 0 && posture.blockers.length === 0 && (
          <div className="mt-3 border-t border-white/6 pt-3">
            <p className="text-[10px] text-muted-foreground/40">
              {posture.safeToRelyOnNow.length} source-backed update{posture.safeToRelyOnNow.length === 1 ? '' : 's'} attached
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
