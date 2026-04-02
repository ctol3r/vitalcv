import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import type {
  PassportData,
  PassportTrustPostureState,
} from '@/lib/trust/passport-contract';
import { formatProofDate } from '@/lib/trust/proof-language';

void React;

const BAND_CONFIG: Record<string, { labelClass: string; scoreClass: string }> = {
  L3: { labelClass: 'text-foreground', scoreClass: 'text-white' },
  L2: { labelClass: 'text-white/78', scoreClass: 'text-white/88' },
  L1: { labelClass: 'text-foreground', scoreClass: 'text-foreground/70' },
  L0: { labelClass: 'text-muted-foreground', scoreClass: 'text-foreground' },
};

const POSTURE_STATE_BADGE: Record<PassportTrustPostureState, { status: TrustBadgeStatus; label?: string }> = {
  current: { status: 'checked', label: 'Current' },
  stale: { status: 'stale', label: 'Stale' },
  gated: { status: 'access required', label: 'Access required' },
  review_required: { status: 'review required', label: 'Review required' },
  blocked: { status: 'blocked', label: 'Blocked' },
  missing: { status: 'unavailable', label: 'Missing' },
};

function ListSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'default' | 'warning';
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item}
            variant="outline"
            className={
              tone === 'warning'
                ? 'rounded-full border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-white/58'
                : 'rounded-full border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-white/64'
            }
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function PassportTrustPosture({
  posture,
}: {
  posture: PassportData['trustPosture'];
}) {
  const band = BAND_CONFIG[posture.band] ?? BAND_CONFIG.L1;
  const safeItems = posture.safeToRelyOnNow;
  const attentionCount =
    posture.blockers.length
    + posture.reviewRequiredItems.length
    + posture.gatedItems.length
    + posture.staleItems.length
    + posture.missingItems.length;
  const summaryStatus =
    posture.blockers.length > 0 ? 'blocked'
    : posture.reviewRequiredItems.length > 0 ? 'review required'
    : posture.gatedItems.length > 0 ? 'access required'
    : posture.staleItems.length > 0 ? 'stale'
    : safeItems.length > 0 ? 'checked'
    : 'pending';
  const summaryLabel =
    posture.blockers.length > 0 ? 'Blockers attached'
    : posture.reviewRequiredItems.length > 0 ? 'Manual review still needed'
    : posture.gatedItems.length > 0 ? 'Source access still needed'
    : posture.staleItems.length > 0 ? 'Refresh recommended'
    : safeItems.length > 0 ? 'Source-backed now'
    : 'Coverage still building';

  return (
    <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none">
      <CardHeader className="border-b border-white/6 px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Trust posture</p>
            <CardTitle className={`text-base font-semibold ${band.labelClass}`}>{posture.bandLabel}</CardTitle>
            <CardDescription className="text-xs leading-relaxed text-muted-foreground">
              Trust posture reflects source-backed readiness only. It does not represent a hiring, privileging, or employment decision.
            </CardDescription>
          </div>
          <div className="flex items-start justify-between gap-4 sm:block sm:text-right">
            <div>
              <p className={`text-4xl font-semibold tabular-nums tracking-tight ${band.scoreClass}`}>
                {posture.score}
              </p>
              <p className="text-[10px] text-muted-foreground/30">{posture.band} / 100</p>
            </div>
            <div className="sm:mt-3">
              <TrustStatusBadge status={summaryStatus} label={summaryLabel} size="sm" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-5 py-4">
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">Major dimensions</p>
          <div className="space-y-2">
            {posture.dimensions.map((dimension) => {
              const state = POSTURE_STATE_BADGE[dimension.state];
              const checkedAt = formatProofDate(dimension.checkedAt);

              return (
                <div
                  key={dimension.id}
                  className="rounded-xl border border-white/6 bg-muted px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/74">{dimension.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/46">{dimension.detail}</p>
                      {checkedAt ? (
                        <p className="mt-2 text-[11px] text-muted-foreground/30">Checked {checkedAt}</p>
                      ) : null}
                    </div>
                    <TrustStatusBadge status={state.status} label={state.label} size="sm" className="shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 border-t border-white/6 pt-4">
          <ListSection title="Safe to rely on now" items={safeItems} tone="default" />
          {safeItems.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">Safe to rely on now</p>
              <p className="text-xs leading-relaxed text-muted-foreground/70">
                No current source-backed claims are available yet.
              </p>
            </div>
          ) : null}

          {attentionCount > 0 ? (
            <div className="space-y-4">
              <ListSection title="Blockers impacting readiness" items={posture.blockers} tone="warning" />
              <ListSection title="Review required" items={posture.reviewRequiredItems} tone="warning" />
              <ListSection title="Access required" items={posture.gatedItems} tone="warning" />
              <ListSection title="Stale" items={posture.staleItems} tone="warning" />
              <ListSection title="Missing or unresolved" items={posture.missingItems} tone="warning" />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">Needs attention</p>
              <p className="text-xs leading-relaxed text-muted-foreground/70">
                No missing, stale, gated, or review-required items are currently limiting this passport.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
