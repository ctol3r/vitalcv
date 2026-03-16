'use client';

import { Activity, GitMerge, Radar } from 'lucide-react';
import type { IntelligenceStoryline } from '@/lib/intelligence/contracts';
import { ScoreBar, SurfaceState, ToneBadge } from './shared';
import { DecisionBadge } from '@/components/decision/DecisionBadge';

interface StorylineCardProps {
  storyline?: IntelligenceStoryline | null;
  loading?: boolean;
  error?: string | null;
  onFocusProvider?: (providerNpi: string) => void;
  onRetry?: () => void;
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
        <article className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                Storyline Card
              </p>
              <h3 className="mt-2 text-base font-semibold text-[var(--vt-text-1)]">{storyline.title}</h3>
            </div>
            <ToneBadge tone={storyline.severity === 'critical' ? 'critical' : storyline.severity === 'high' || storyline.severity === 'medium' ? 'degraded' : 'neutral'} label={storyline.status} />
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--vt-text-2)]">{storyline.summary}</p>
          <p className="mt-3 text-xs leading-5 text-[var(--vt-text-3)]">{storyline.whyItMatters}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <Activity className="h-3.5 w-3.5" />
                <span>Confidence</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{Math.round(storyline.confidence * 100)}%</p>
            </div>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                <GitMerge className="h-3.5 w-3.5" />
                <span>Findings</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{storyline.findingIds.length} linked findings</p>
            </div>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
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
                tone={storyline.severity === 'critical' ? 'critical' : storyline.severity === 'high' || storyline.severity === 'medium' ? 'degraded' : 'neutral'}
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
                <span className="text-xs font-medium text-[var(--vt-text-2)]">{action}</span>
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
