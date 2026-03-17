'use client';

import { Activity, Clock3, GitMerge, Radar } from 'lucide-react';
import { DecisionBadge } from '@/components/decision/DecisionBadge';
import type { IntelligenceStoryline, IntelligenceTone } from '@/lib/intelligence/contracts';
import { formatRelativeTime } from '@/lib/intelligence/time';
import { ScoreBar, SurfaceState, ToneBadge } from './shared';

interface StorylineCardProps {
  storyline?: IntelligenceStoryline | null;
  loading?: boolean;
  error?: string | null;
  onFocusProvider?: (providerNpi: string) => void;
  onRetry?: () => void;
}

function toneFromSeverity(severity: IntelligenceStoryline['severity']): IntelligenceTone {
  if (severity === 'critical') {
    return 'critical';
  }

  if (severity === 'high' || severity === 'medium') {
    return 'degraded';
  }

  return 'neutral';
}

export function StorylineCard({
  storyline,
  loading,
  error,
  onFocusProvider,
  onRetry,
}: StorylineCardProps) {
  return (
    <SurfaceState
      loading={loading}
      error={error}
      empty={!storyline}
      emptyTitle="No storyline selected"
      emptyCopy="Storyline clusters will appear when related findings accumulate."
      onRetry={onRetry}
    >
      {storyline ? (
        <article className={`vital-feed-card ${storyline.severity === 'critical' ? 'vital-feed-card--critical' : 'vital-feed-card--latest'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="vital-feed-card__eyebrow">Storyline</span>
                <span className="vital-feed-card__signal">
                  <Clock3 className="h-3 w-3" />
                  {formatRelativeTime(storyline.lastActivityAt)}
                </span>
                <span className="vital-feed-card__signal">{storyline.status}</span>
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-semibold text-[var(--vt-text-1)]">{storyline.title}</h3>
            </div>
            <ToneBadge
              tone={toneFromSeverity(storyline.severity)}
              label={storyline.severity}
              pulse={storyline.severity === 'critical'}
            />
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--vt-text-2)]">{storyline.summary}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--vt-text-3)]">{storyline.whyItMatters}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="vital-feed-card__signal">
              <Activity className="h-3.5 w-3.5" />
              {Math.round(storyline.confidence * 100)}% confidence
            </span>
            <span className="vital-feed-card__signal">
              <GitMerge className="h-3.5 w-3.5" />
              {storyline.findingIds.length} linked {storyline.findingIds.length === 1 ? 'finding' : 'findings'}
            </span>
            <span className="vital-feed-card__signal">
              <Radar className="h-3.5 w-3.5" />
              {storyline.evidence.length} evidence items
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="hover-hierarchy rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/60 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <Activity className="h-3.5 w-3.5" />
                <span>Confidence</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{Math.round(storyline.confidence * 100)}%</p>
            </div>
            <div className="hover-hierarchy rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/60 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <GitMerge className="h-3.5 w-3.5" />
                <span>Findings</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{storyline.findingIds.length} connected</p>
            </div>
            <div className="hover-hierarchy rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/60 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <Radar className="h-3.5 w-3.5" />
                <span>Progression</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{Math.round(storyline.progressionScore * 100)}%</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[var(--vt-text-3)]">
              <span>Progression score</span>
              <span>{Math.round(storyline.progressionScore * 100)}</span>
            </div>
            <div className="mt-2">
              <ScoreBar
                value={storyline.progressionScore * 100}
                tone={toneFromSeverity(storyline.severity)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {storyline.recommendedActions.slice(0, 3).map((action) => (
              <div
                key={`${storyline.id}-${action}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 px-3 py-2"
              >
                <DecisionBadge
                  type={action.toLowerCase().includes('monitor') ? 'monitor' : action.toLowerCase().includes('escalate') ? 'escalate' : 'investigate'}
                />
                <span className="line-clamp-1 text-xs font-medium text-[var(--vt-text-2)]">{action}</span>
              </div>
            ))}
          </div>

          {storyline.providerNpi && onFocusProvider ? (
            <button
              type="button"
              onClick={() => onFocusProvider(storyline.providerNpi!)}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--vt-border)] px-3 py-1.5 text-xs font-semibold text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)]"
            >
              Focus provider {storyline.providerNpi}
            </button>
          ) : null}
        </article>
      ) : null}
    </SurfaceState>
  );
}
