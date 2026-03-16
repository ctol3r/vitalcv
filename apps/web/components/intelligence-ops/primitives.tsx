import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';

type BadgeTone = 'neutral' | 'critical' | 'warning' | 'success' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral:  'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-badge-neutral-bg)] text-[var(--vt-badge-neutral-text)]',
  critical: 'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]',
  warning:  'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
  success:  'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
  info:     'border-[var(--vt-badge-info-border)] bg-[var(--vt-badge-info-bg)] text-[var(--vt-badge-info-text)]',
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

/** Returns a CSS color style for a 0–100 risk score. */
export function riskScoreColor(score: number): string {
  if (score >= 75) return 'text-[var(--vt-critical)]';
  if (score >= 50) return 'text-[var(--vt-warning)]';
  if (score >= 25) return 'text-[var(--vt-success)]';
  return 'text-[var(--vt-text-2)]';
}

/** Returns a CSS color style for a 0–100 trust score. */
export function trustScoreColor(score: number): string {
  if (score >= 75) return 'text-[var(--vt-success)]';
  if (score >= 50) return 'text-[var(--vt-info)]';
  if (score >= 25) return 'text-[var(--vt-warning)]';
  return 'text-[var(--vt-text-2)]';
}

/** Confidence meter — renders a small labeled bar. */
export function ConfidenceMeter({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const colorClass =
    pct >= 80 ? 'bg-[var(--vt-success)]' :
    pct >= 60 ? 'bg-[var(--vt-info)]' :
    pct >= 40 ? 'bg-[var(--vt-warning)]' :
    'bg-[var(--vt-critical)]';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--vt-border)]">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
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
      'rounded-[24px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-[var(--vt-shadow-md)]',
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
          <div className="h-3 w-24 rounded-full bg-[var(--vt-border)]" />
          <div className="h-5 w-3/4 rounded-full bg-[var(--vt-surface-2)]" />
          <div className="h-3 w-1/2 rounded-full bg-[var(--vt-surface-2)]" />
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
    <span title={formatAbsoluteTime(value)} className="text-xs text-[var(--vt-text-3)]">
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
        <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">{title}</h2>
        <p className="text-sm leading-6 text-[var(--vt-text-2)]">{description}</p>
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
    <OpsCard className="border-[var(--vt-badge-critical-border)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--vt-critical)]" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">{title}</h2>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">{description}</p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-border)]"
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
  critical: <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--vt-critical)]" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--vt-warning)]" />,
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-3 text-sm text-[var(--vt-text-2)]">
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
              ? 'pointer-events-none border-[var(--vt-border-2)] text-[var(--vt-text-3)]'
              : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-border)]',
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
              ? 'pointer-events-none border-[var(--vt-border-2)] text-[var(--vt-text-3)]'
              : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-border)]',
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
      className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-border)] hover:text-[var(--vt-text-1)]"
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
      className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-border)] hover:text-[var(--vt-text-1)]"
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
        className="cursor-pointer"
      />
    </Link>
  );
}
