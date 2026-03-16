import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';

type BadgeTone = 'neutral' | 'critical' | 'warning' | 'success' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-white/10 bg-white/5 text-slate-200',
  critical: 'border-red-400/25 bg-red-500/10 text-red-200',
  warning: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
  success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  info: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100',
};

export function severityTone(value: string): BadgeTone {
  switch (value.toLowerCase()) {
    case 'critical':
    case 'outage':
    case 'revoked':
      return 'critical';
    case 'high':
    case 'escalated':
    case 'investigating':
    case 'expired':
      return 'warning';
    case 'low':
    case 'saved':
    case 'verified':
    case 'executed':
    case 'completed':
    case 'resolved':
    case 'healthy':
    case 'cleared':
      return 'success';
    case 'medium':
    case 'degraded':
    case 'pending':
    case 'in_progress':
    case 'quiet':
    case 'new':
    case 'acknowledged':
      return 'info';
    case 'skipped':
    case 'dismissed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Returns a Tailwind text-color class based on a 0–100 risk score.
 *  High risk → red, medium → amber, low → emerald, minimal → slate.
 */
export function riskScoreColor(score: number): string {
  if (score >= 75) return 'text-red-300';
  if (score >= 50) return 'text-amber-200';
  if (score >= 25) return 'text-emerald-300';
  return 'text-slate-300';
}

/** Returns a Tailwind text-color class based on a 0–100 trust score.
 *  High trust → emerald, medium → cyan, low → amber, minimal → slate.
 */
export function trustScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-300';
  if (score >= 50) return 'text-cyan-300';
  if (score >= 25) return 'text-amber-200';
  return 'text-slate-300';
}

/** Confidence meter — renders a small labeled bar in place of a plain badge. */
export function ConfidenceMeter({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const colorClass =
    pct >= 80 ? 'bg-emerald-400' :
    pct >= 60 ? 'bg-cyan-400' :
    pct >= 40 ? 'bg-amber-400' :
    'bg-red-400';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{pct}%</span>
    </div>
  );
}

export function OpsCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(
      'rounded-[24px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_22px_60px_rgba(2,6,23,0.35)] backdrop-blur',
      className,
    )}
    >
      {children}
    </section>
  );
}

/** Skeleton shimmer placeholder — use while data is loading. */
export function OpsCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <OpsCard className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2 animate-pulse">
          <div className="h-3 w-24 rounded-full bg-white/10" />
          <div className="h-5 w-3/4 rounded-full bg-white/8" />
          <div className="h-3 w-1/2 rounded-full bg-white/5" />
        </div>
      ))}
    </OpsCard>
  );
}

export function OpsBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
      BADGE_TONES[tone],
      className,
    )}
    >
      {label}
    </span>
  );
}

export function TimestampPair({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return (
    <span title={formatAbsoluteTime(value)} className="text-xs text-slate-400">
      {label} {formatRelativeTime(value)}
    </span>
  );
}

export function SurfaceEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <OpsCard className="border-dashed text-center">
      <div className="mx-auto max-w-xl space-y-2 py-8">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </OpsCard>
  );
}

export function SurfaceErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <OpsCard className="border-red-400/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-sm leading-6 text-slate-300">{description}</p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        ) : null}
      </div>
    </OpsCard>
  );
}

const BANNER_ICONS: Partial<Record<BadgeTone, React.ReactNode>> = {
  critical: <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />,
};

export function SurfaceBanner({
  tone = 'info',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  const icon = BANNER_ICONS[tone];
  return (
    <div className={cn(
      'flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm',
      BADGE_TONES[tone],
    )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

export function PaginationControls({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={hrefForPage(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            'rounded-full border px-3 py-1.5 transition',
            page <= 1
              ? 'pointer-events-none border-white/5 text-slate-600'
              : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
          )}
        >
          Previous
        </Link>
        <Link
          href={hrefForPage(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            'rounded-full border px-3 py-1.5 transition',
            page >= totalPages
              ? 'pointer-events-none border-white/5 text-slate-600'
              : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
          )}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function EntityLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

export function BadgeLink({
  href,
  label,
  tone = 'neutral',
  title,
}: {
  href: string;
  label: string;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <Link href={href} title={title} className="transition hover:opacity-90">
      <OpsBadge
        label={label}
        tone={tone}
        className="cursor-pointer hover:border-white/20 hover:text-white"
      />
    </Link>
  );
}
