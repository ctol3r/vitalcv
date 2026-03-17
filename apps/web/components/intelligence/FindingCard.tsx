'use client';

import Link from 'next/link';
import { AlertTriangle, Bot, GitBranch, Activity, Clock } from 'lucide-react';
import type { IntelligenceFinding } from '@/lib/intelligence/contracts';
import { formatRelativeTime } from '@/lib/intelligence/time';
import { SurfaceState, ToneBadge } from './shared';

interface FindingCardProps {
  finding?: IntelligenceFinding | null;
  loading?: boolean;
  error?: string | null;
  onFocusProvider?: (providerNpi: string) => void;
  onRetry?: () => void;
}

export function FindingCard({
  finding,
  loading,
  error,
  onFocusProvider,
  onRetry,
}: FindingCardProps) {
  return (
    <SurfaceState
      loading={loading}
      error={error}
      empty={!finding}
      emptyTitle="No finding selected"
      emptyCopy="Investigator results will appear here when the current scope has active findings."
      onRetry={onRetry}
    >
      {finding ? (
        <article className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)] flex items-center justify-between">
                <div>Finding Card</div>
              </p>
              <h3 className="mt-2 text-base font-semibold text-[var(--vt-text-1)]">{finding.title}</h3>
            </div>
            <div className="shrink-0 flex translate-y-2">
              <ToneBadge tone={finding.severity === 'critical' ? 'critical' : finding.severity === 'high' || finding.severity === 'medium' ? 'degraded' : 'neutral'} label={finding.severity} />
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
          <p className="mt-3 text-xs leading-5 text-[var(--vt-text-3)]">{finding.explanation}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {finding.providerNpi ? (
              <Link
                href={`/providers/${finding.providerNpi}`}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                {finding.providerLabel ?? `Provider ${finding.providerNpi}`}
              </Link>
            ) : null}
            {finding.storylineId ? (
              <Link
                href={`/storylines/${finding.storylineId}`}
                title={finding.storylineTitle ?? 'Open storyline'}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                Storyline
              </Link>
            ) : null}
            {/* Phase 2: Trust Signals */}
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${Math.round(finding.confidence * 100) >= 80 ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-amber-500/30 bg-amber-500/5 text-amber-500'}`} title="Confidence Score">
              <Activity className="h-3 w-3" />
              {Math.round(finding.confidence * 100)}% Conf
            </div>
            {finding.updatedAt && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--vt-text-3)]" title="Freshness Marker">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(finding.updatedAt)}
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--vt-text-3)]" title="Corroboration Indicator">
              <GitBranch className="h-3 w-3" />
              {finding.evidence.length} Corroborating {finding.evidence.length === 1 ? 'Source' : 'Sources'}
            </div>
          </div>

          <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-4 hover-hierarchy shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Status</span>
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--vt-text-1)] capitalize">{finding.status}</p>
            </div>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/80 p-4 hover-hierarchy shadow-sm ring-1 ring-inset ring-vt-info/20 shadow-vt-info/10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-info)] font-semibold">
                <Bot className="h-4 w-4" />
                <span>Investigator</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{finding.investigatorId}</p>
            </div>
            <div className="col-span-2 md:col-span-1 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-4 hover-hierarchy shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Evidence</span>
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--vt-text-1)]">{finding.evidence.length} linked items</p>
            </div>
          </div>

          {finding.providerNpi && onFocusProvider ? (
            <button
              type="button"
              onClick={() => onFocusProvider(finding.providerNpi!)}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--vt-border)] px-3 py-1.5 text-xs font-semibold text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)]"
            >
              Focus provider {finding.providerNpi}
            </button>
          ) : null}
        </article>
      ) : null}
    </SurfaceState>
  );
}
