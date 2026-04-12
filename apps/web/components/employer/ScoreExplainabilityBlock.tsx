'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { PassportData } from '@/lib/trust/passport-contract';
import {
  buildScoreExplainability,
  type ScoreFactor,
  type TrustCap,
} from '@/lib/trust/score-explainability';

function FactorRow({ factor, accent }: { factor: ScoreFactor; accent: 'positive' | 'negative' }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-foreground/70">{factor.label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{factor.detail}</p>
        {factor.source && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/40">{factor.source}</p>
        )}
      </div>
      {factor.impact !== 0 && (
        <Badge
          variant="outline"
          className={[
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
            accent === 'positive'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200',
          ].join(' ')}
        >
          {factor.impact > 0 ? '+' : ''}{factor.impact}
        </Badge>
      )}
    </div>
  );
}

function CapRow({ cap }: { cap: TrustCap }) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
      <p className="text-sm text-foreground/70">{cap.label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{cap.reason}</p>
      <Badge
        variant="outline"
        className="mt-1 rounded-full border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground"
      >
        Capped at {cap.cappedAt}
      </Badge>
    </div>
  );
}

export function ScoreExplainabilityBlock({ passport }: { passport: PassportData }) {
  const explainability = buildScoreExplainability(passport);
  const { positiveContributors, penalties, trustCaps } = explainability;

  const summaryStatus =
    penalties.length > 0 || trustCaps.length > 0
      ? 'review_required' as const
      : positiveContributors.length > 0
        ? 'checked' as const
        : 'pending' as const;

  return (
    <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none">
      {/* Score hero */}
      <div className="border-b border-white/6 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
              Why this score?
            </p>
            <p className="text-base font-semibold text-foreground/85">
              CRS breakdown — {explainability.bandLabel}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {explainability.score}
            </p>
            <TrustStatusBadge status={summaryStatus} size="sm" />
          </div>
        </div>
      </div>

      {/* Three-column breakdown */}
      <div className="grid grid-cols-1 gap-0 divide-y divide-white/6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {/* Helping */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/60">
            Helping
          </p>
          <div className="mt-3 space-y-2">
            {positiveContributors.length > 0 ? (
              positiveContributors.map((factor) => (
                <FactorRow key={factor.id} factor={factor} accent="positive" />
              ))
            ) : (
              <p className="text-xs text-muted-foreground/50">No positive contributors yet</p>
            )}
          </div>
        </div>

        {/* Hurting */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400/60">
            Hurting
          </p>
          <div className="mt-3 space-y-2">
            {penalties.length > 0 ? (
              penalties.map((factor) => (
                <FactorRow key={factor.id} factor={factor} accent="negative" />
              ))
            ) : (
              <p className="text-xs text-muted-foreground/50">No active penalties</p>
            )}
          </div>
        </div>

        {/* Ceiling effects */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
            Ceiling effects
          </p>
          <div className="mt-3 space-y-2">
            {trustCaps.length > 0 ? (
              trustCaps.map((cap) => <CapRow key={cap.id} cap={cap} />)
            ) : (
              <p className="text-xs text-muted-foreground/50">No trust caps active</p>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-white/6 px-5 py-3">
        <p className="text-[10px] text-muted-foreground/40">
          Score reflects source-backed readiness only. It does not represent a hiring, privileging, or employment decision.
        </p>
      </div>
    </Card>
  );
}
