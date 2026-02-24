'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { TrustStateCardData, TrustBand, WindowStatus } from './types';
import { PANEL_TRANSITION } from './motion';

// ── Visual Config ──────────────────────────────────────────

const BAND_CONFIG: Record<
  TrustBand,
  { dot: string; label: string; badgeBg: string; badgeText: string; badgeBorder: string }
> = {
  GREEN: {
    dot: 'bg-green-600',
    label: 'Compliant',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-800',
    badgeBorder: 'border-green-200',
  },
  YELLOW: {
    dot: 'bg-amber-500',
    label: 'Expiring Soon',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  RED: {
    dot: 'bg-red-600',
    label: 'Non-Compliant',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200',
  },
};

const WINDOW_LABEL: Record<WindowStatus, string> = {
  WITHIN_WINDOW: 'Within NCQA 120-Day Window',
  EXPIRING_SOON: 'NCQA Window Expiring Soon',
  EXPIRED: 'NCQA 120-Day Window Expired',
  NOT_YET_VALID: 'Verification Not Yet Valid',
};

// ── Helpers ────────────────────────────────────────────────

function daysAgo(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

// ── Component ──────────────────────────────────────────────

export function TrustStateCard({ data }: { data: TrustStateCardData }) {
  const config = BAND_CONFIG[data.band];
  const verifiedDaysAgo = daysAgo(data.verifiedAt);
  const windowLabel = WINDOW_LABEL[data.windowStatus];

  return (
    <section aria-labelledby="trust-state-heading" className={PANEL_TRANSITION}>
      <Card interactive>
        <CardHeader>
          <CardTitle id="trust-state-heading" className="text-lg text-slate-800">
            Trust State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Compliance status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${config.dot} shrink-0`}
                      role="img"
                      aria-label={`Compliance status: ${config.label}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{config.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge
                className={`text-xs border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} hover:bg-transparent`}
              >
                {config.label}
              </Badge>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Band: {data.band}
            </span>
          </div>

          {/* Verification age */}
          <div className="rounded-md border border-slate-200 p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-700">
                Primary License Verified {verifiedDaysAgo} Day{verifiedDaysAgo !== 1 ? 's' : ''} Ago
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {formatDate(data.verifiedAt)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">{windowLabel}</span>
              <span className="text-xs text-slate-400 font-mono">
                {data.daysRemaining} day{data.daysRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          </div>

          {/* Valid until */}
          <dl className="flex items-baseline justify-between text-xs text-slate-500">
            <dt>Valid Until</dt>
            <dd className="font-mono text-slate-700">{formatDate(data.validUntil)}</dd>
          </dl>

          {/* Blocking reasons */}
          {data.blockingReasons.length > 0 && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1.5">
                Blocking Reasons
              </p>
              <ul className="space-y-1" role="list">
                {data.blockingReasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-xs text-red-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 shrink-0 mt-1.5" />
                    {reason.replace(/_/g, ' ').toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
