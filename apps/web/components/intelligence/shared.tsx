'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntelligenceTone } from '@/lib/intelligence/contracts';

interface SurfaceStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyCopy?: string;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}

export function SurfaceState({
  loading,
  error,
  empty,
  emptyTitle = 'Nothing to show',
  emptyCopy = 'This panel has no data in the current scope.',
  onRetry,
  children,
  className,
}: SurfaceStateProps) {
  if (loading) {
    return (
      <div className={cn('grid gap-3', className)}>
        <div className="h-20 animate-pulse rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)]" />
        <div className="h-20 animate-pulse rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-2xl border border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] p-4', className)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--vt-critical)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--vt-badge-critical-text)]">Unable to load panel</p>
            <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{error}</p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-badge-critical-border)] px-3 py-1.5 text-xs font-semibold text-[var(--vt-badge-critical-text)] transition hover:bg-[var(--vt-surface-2)]"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={cn('rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4', className)}>
        <p className="text-sm font-semibold text-[var(--vt-text-1)]">{emptyTitle}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{emptyCopy}</p>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

export function SectionFrame({
  eyebrow,
  title,
  detail,
  action,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('vital-panel vital-panel--dense', className)}>
      <div className="vital-panel__header">
        <div className="min-w-0">
          <p className="vital-panel__eyebrow">{eyebrow}</p>
          <h2 className="vital-panel__title truncate">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {detail ? <p className="vital-panel__copy line-clamp-2">{detail}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ToneBadge({
  tone,
  label,
  pulse = false,
  className,
}: {
  tone: IntelligenceTone;
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  const classes = tone === 'healthy'
    ? 'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]'
    : tone === 'degraded'
      ? 'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]'
      : tone === 'critical'
        ? 'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]'
        : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)]';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        classes,
        pulse && 'vital-tone-badge--pulse',
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ScoreBar({
  value,
  tone,
}: {
  value: number;
  tone: IntelligenceTone;
}) {
  const width = `${Math.max(4, Math.min(100, Math.round(value)))}%`;
  const color = tone === 'healthy'
    ? 'bg-[var(--vt-success)]'
    : tone === 'degraded'
      ? 'bg-[var(--vt-warning)]'
      : tone === 'critical'
        ? 'bg-[var(--vt-critical)]'
        : 'bg-[var(--vt-info)]';

  return (
    <div className="h-2 rounded-full bg-[var(--vt-border)]">
      <div className={cn('h-full rounded-full', color)} style={{ width }} />
    </div>
  );
}
