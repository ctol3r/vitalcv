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
  const showScore = currentCount > 0;
  const canMoveForward =
    posture.blockers.length === 0
    && posture.reviewRequiredItems.length === 0
    && posture.gatedItems.length === 0
    && posture.staleItems.length === 0
    && currentCount > 0;

  const toneClass: Record<string, string> = {
    success: 'border-border bg-card',
    default: 'border-border bg-card',
    warning: 'border-border bg-card',
    critical: 'border-border bg-card',
  };

  const summaryStatus =
    posture.blockers.length > 0 ? 'blocked' as const
    : posture.reviewRequiredItems.length > 0 ? 'review_required' as const
    : posture.staleItems.length > 0 ? 'stale' as const
    : currentCount > 0 ? 'checked' as const
    : 'pending' as const;
  const summaryLabel =
    posture.blockers.length > 0 ? 'Review recommended'
    : posture.reviewRequiredItems.length > 0 ? 'Review recommended'
    : posture.gatedItems.length > 0 ? 'Proceed carefully'
    : posture.staleItems.length > 0 ? 'Proceed carefully'
    : currentCount > 0 ? 'Ready to proceed'
    : 'Waiting on sources';

  return (
    <Card
      className={[
        'gap-0 rounded-2xl py-0 shadow-none',
        toneClass[tone] ?? toneClass.default,
      ].join(' ')}
    >
      <div className="px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Passport summary</p>
            <p className="text-base font-semibold text-foreground/85">{summaryLabel}</p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 sm:block sm:text-right">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {showScore ? posture.score : '—'}
            </p>
            <div className="sm:mt-2">
              <TrustStatusBadge status={summaryStatus} label={summaryLabel} size="sm" />
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[11px] font-medium text-muted-foreground">Next step</p>
          <p className="mt-1 text-sm font-semibold text-foreground/85">
            {canMoveForward ? 'Ready to proceed' : summaryLabel}
          </p>
        </div>

        {posture.blockers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs font-medium text-[var(--vt-severity-critical)]">
              {posture.blockers.length} blocker{posture.blockers.length === 1 ? '' : 's'}
            </span>
            {posture.blockers.slice(0, 2).map((blocker) => (
              <Badge
                key={blocker}
                variant="outline"
                className="rounded-full border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground/70"
              >
                {blocker}
              </Badge>
            ))}
            {posture.blockers.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{posture.blockers.length - 2} more
              </span>
            )}
          </div>
        )}

      </div>
    </Card>
  );
}
