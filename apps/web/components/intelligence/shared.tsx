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
      <div className={cn('rounded-2xl border border-red-400/20 bg-red-400/[0.08] p-4', className)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-100">Unable to load panel</p>
            <p className="mt-1 text-xs leading-5 text-red-200/80">{error}</p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full border border-red-300/20 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-200/10"
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
}: {
  tone: IntelligenceTone;
  label: string;
}) {
  const classes = tone === 'healthy'
    ? 'border-emerald-400/20 bg-emerald-400/[0.12] text-emerald-100'
    : tone === 'degraded'
      ? 'border-amber-300/20 bg-amber-300/[0.12] text-amber-100'
      : tone === 'critical'
        ? 'border-red-300/20 bg-red-300/[0.12] text-red-100'
        : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)]';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', classes)}>
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
    ? 'bg-emerald-300'
    : tone === 'degraded'
      ? 'bg-amber-300'
      : tone === 'critical'
        ? 'bg-red-300'
        : 'bg-cyan-200';

  return (
    <div className="h-2 rounded-full bg-white/[0.08]">
      <div className={cn('h-full rounded-full', color)} style={{ width }} />
    </div>
  );
}
