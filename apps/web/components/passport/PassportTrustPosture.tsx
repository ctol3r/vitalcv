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
  L3: { labelClass: 'text-foreground', scoreClass: 'text-foreground' },
  L2: { labelClass: 'text-foreground/85', scoreClass: 'text-foreground/90' },
  L1: { labelClass: 'text-foreground', scoreClass: 'text-foreground/70' },
  L0: { labelClass: 'text-muted-foreground', scoreClass: 'text-foreground' },
};

const POSTURE_STATE_BADGE: Record<PassportTrustPostureState, { status: TrustBadgeStatus; label?: string }> = {
  current: { status: 'checked', label: 'Current' },
  stale: { status: 'stale', label: 'Stale' },
  pending: { status: 'pending', label: 'Pending' },
  gated: { status: 'access_required', label: 'Access required' },
  unavailable: { status: 'unavailable', label: 'Unavailable' },
  unverifiable: { status: 'unavailable', label: 'Cannot verify' },
  review_required: { status: 'review_required', label: 'Review required' },
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
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item}
            variant="outline"
            className={
              tone === 'warning'
                ? 'rounded-full border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/70'
                : 'rounded-full border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/75'
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
    : posture.reviewRequiredItems.length > 0 ? 'review_required'
    : posture.gatedItems.length > 0 ? 'access_required'
    : posture.staleItems.length > 0 ? 'stale'
    : safeItems.length > 0 ? 'checked'
    : 'pending';
  const summaryLabel =
    posture.blockers.length > 0 ? 'Review recommended'
    : posture.reviewRequiredItems.length > 0 ? 'Review recommended'
    : posture.gatedItems.length > 0 ? 'Proceed carefully'
    : posture.staleItems.length > 0 ? 'Proceed carefully'
    : safeItems.length > 0 ? 'Ready to proceed'
    : 'Waiting on sources';
  const showScore = posture.dimensions.some((dimension) => dimension.state === 'current');

  return (
    <Card className="gap-0 rounded-2xl border-border bg-card py-0 shadow-none">
      <CardHeader className="border-b border-border px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Trust posture</p>
            <CardTitle className={`text-base font-semibold ${band.labelClass}`}>{posture.bandLabel}</CardTitle>
            <CardDescription className="text-xs leading-relaxed text-muted-foreground">
              Source-backed, portable, readable.
            </CardDescription>
          </div>
          <div className="flex items-start justify-between gap-4 sm:block sm:text-right">
            <div>
              <p className={`text-2xl font-semibold tabular-nums ${band.scoreClass}`}>
                {showScore ? posture.score : 'Withheld'}
              </p>
              <p className="text-xs text-muted-foreground">
                {showScore ? `${posture.band} / 100` : 'Appears once source-backed claims attach'}
              </p>
            </div>
            <div className="sm:mt-3">
              <TrustStatusBadge status={summaryStatus} label={summaryLabel} size="sm" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-5 py-5">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Major dimensions</p>
          <div className="space-y-2">
            {posture.dimensions.map((dimension) => {
              const state = POSTURE_STATE_BADGE[dimension.state];
              const checkedAt = formatProofDate(dimension.checkedAt);

              return (
                <div
                  key={dimension.id}
                  className="rounded-xl border border-border bg-background px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/80">{dimension.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{dimension.detail}</p>
                      {checkedAt ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">Checked {checkedAt}</p>
                      ) : null}
                    </div>
                    <TrustStatusBadge status={state.status} label={state.label} size="sm" className="shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-5">
          <ListSection title="Safe to rely on now" items={safeItems} tone="default" />
          {safeItems.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Safe to rely on now</p>
              <p className="text-xs leading-relaxed text-muted-foreground/70">
                No source-backed claims yet.
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
              <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
              <p className="text-xs leading-relaxed text-muted-foreground/70">
                No missing, stale, gated, or review-required items are limiting this passport.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
