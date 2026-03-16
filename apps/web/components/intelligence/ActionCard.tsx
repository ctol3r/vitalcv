'use client';

import Link from 'next/link';
import { ArrowRightCircle, ShieldAlert, Target } from 'lucide-react';
import type { IntelligenceAction } from '@/lib/intelligence/contracts';
import { SurfaceState, ToneBadge } from './shared';

interface ActionCardProps {
  action?: IntelligenceAction | null;
  loading?: boolean;
  error?: string | null;
  onFocusProvider?: (providerNpi: string) => void;
  onRetry?: () => void;
}

export function ActionCard({
  action,
  loading,
  error,
  onFocusProvider,
  onRetry,
}: ActionCardProps) {
  const tone = action?.priority === 'CRITICAL'
    ? 'critical'
    : action?.priority === 'HIGH'
      ? 'degraded'
      : 'neutral';

  return (
    <SurfaceState
      loading={loading}
      error={error}
      empty={!action}
      emptyTitle="No action selected"
      emptyCopy="Recommended actions will appear when findings and storylines generate operator work."
      onRetry={onRetry}
    >
      {action ? (
        <article className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                Action Card
              </p>
              <h3 className="mt-2 text-base font-semibold text-[var(--vt-text-1)]">{action.title}</h3>
            </div>
            <ToneBadge tone={tone} label={action.priority} />
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--vt-text-2)]">{action.explanation}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {action.providerNpi ? (
              <Link
                href={`/providers/${action.providerNpi}`}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                {action.targetLabel ?? `Provider ${action.providerNpi}`}
              </Link>
            ) : null}
            {action.sourceFindingIds[0] ? (
              <Link
                href={`/findings/${action.sourceFindingIds[0]}`}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                Finding {action.sourceFindingIds[0]}
              </Link>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <Target className="h-3.5 w-3.5" />
                <span>Target</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{action.targetLabel ?? action.providerNpi ?? 'System scope'}</p>
            </div>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Status</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{action.status}</p>
            </div>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <ArrowRightCircle className="h-3.5 w-3.5" />
                <span>Evidence</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{action.evidence.length} linked items</p>
            </div>
          </div>

          {action.providerNpi && onFocusProvider ? (
            <button
              type="button"
              onClick={() => onFocusProvider(action.providerNpi!)}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--vt-border)] px-3 py-1.5 text-xs font-semibold text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)]"
            >
              Focus provider {action.providerNpi}
            </button>
          ) : null}
        </article>
      ) : null}
    </SurfaceState>
  );
}
