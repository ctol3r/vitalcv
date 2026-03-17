'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, Bot, Clock3, GitBranch } from 'lucide-react';
import type { IntelligenceFinding, IntelligenceTone } from '@/lib/intelligence/contracts';
import { formatRelativeTime } from '@/lib/intelligence/time';
import { SurfaceState, ToneBadge } from './shared';

interface FindingCardProps {
  finding?: IntelligenceFinding | null;
  loading?: boolean;
  error?: string | null;
  onFocusProvider?: (providerNpi: string) => void;
  onRetry?: () => void;
}

function toneFromSeverity(severity: IntelligenceFinding['severity']): IntelligenceTone {
  if (severity === 'critical') {
    return 'critical';
  }

  if (severity === 'high' || severity === 'medium') {
    return 'degraded';
  }

  return 'neutral';
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
        <article className={`vital-feed-card ${finding.severity === 'critical' ? 'vital-feed-card--critical' : 'vital-feed-card--ranked'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="vital-feed-card__eyebrow">Finding</span>
                <span className="vital-feed-card__signal">Priority {Math.round(finding.priorityScore)}</span>
                {finding.updatedAt ? (
                  <span className="vital-feed-card__signal">
                    <Clock3 className="h-3 w-3" />
                    {formatRelativeTime(finding.updatedAt)}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-semibold text-[var(--vt-text-1)]">{finding.title}</h3>
            </div>
            <ToneBadge
              tone={toneFromSeverity(finding.severity)}
              label={finding.severity}
              pulse={finding.severity === 'critical' || finding.status === 'investigating'}
            />
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--vt-text-3)]">{finding.explanation}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="vital-feed-card__signal vital-feed-card__signal--investigator">
              <Bot className="h-3.5 w-3.5" />
              {finding.investigatorId}
            </span>
            <span className="vital-feed-card__signal">
              <Activity className="h-3.5 w-3.5" />
              {Math.round(finding.confidence * 100)}% confidence
            </span>
            <span className="vital-feed-card__signal">
              <GitBranch className="h-3.5 w-3.5" />
              {finding.evidence.length} corroborating {finding.evidence.length === 1 ? 'source' : 'sources'}
            </span>
            {finding.providerNpi ? (
              <Link
                href={`/providers/${finding.providerNpi}`}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                {finding.providerLabel ?? `Provider ${finding.providerNpi}`}
              </Link>
            ) : null}
            {finding.storylineId ? (
              <Link
                href={`/storylines/${finding.storylineId}`}
                title={finding.storylineTitle ?? 'Open storyline'}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                {finding.storylineTitle ?? 'Storyline'}
              </Link>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="hover-hierarchy rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Status</span>
              </div>
              <p className="mt-2 text-sm font-medium capitalize text-[var(--vt-text-1)]">{finding.status}</p>
            </div>
            <div className="hover-hierarchy rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/80 p-4 shadow-sm ring-1 ring-inset ring-cyan-400/14 shadow-cyan-400/8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/80">
                <Bot className="h-4 w-4" />
                <span>Investigator</span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--vt-text-1)]">{finding.investigatorId}</p>
            </div>
            <div className="hover-hierarchy rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/60 p-4 shadow-sm">
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
