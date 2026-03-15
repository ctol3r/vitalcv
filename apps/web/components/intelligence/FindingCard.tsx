'use client';

import { AlertTriangle, Bot, GitBranch } from 'lucide-react';
import type { IntelligenceFinding } from '@/lib/intelligence/contracts';
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
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Finding Card
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">{finding.title}</h3>
            </div>
            <ToneBadge tone={finding.severity === 'critical' ? 'critical' : finding.severity === 'high' || finding.severity === 'medium' ? 'degraded' : 'neutral'} label={finding.severity} />
          </div>

          <p className="mt-3 text-sm leading-6 text-white/70">{finding.summary}</p>
          <p className="mt-3 text-xs leading-5 text-white/50">{finding.explanation}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/45">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Status</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{finding.status}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/45">
                <Bot className="h-3.5 w-3.5" />
                <span>Investigator</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{finding.investigatorId}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/45">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Evidence</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{finding.evidence.length} linked items</p>
            </div>
          </div>

          {finding.providerNpi && onFocusProvider ? (
            <button
              type="button"
              onClick={() => onFocusProvider(finding.providerNpi!)}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
            >
              Focus provider {finding.providerNpi}
            </button>
          ) : null}
        </article>
      ) : null}
    </SurfaceState>
  );
}
