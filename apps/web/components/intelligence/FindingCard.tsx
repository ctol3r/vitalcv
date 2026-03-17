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
        <article 
          className="group relative flex flex-col gap-3 rounded-lg border border-transparent border-b-[var(--vt-border)] bg-transparent p-4 transition-all duration-200 ease-out hover:bg-[var(--vt-surface)] hover:border-[var(--vt-border)] active:scale-[0.99] hover:shadow-[0_0_20px_0_rgba(255,255,255,0.02)] cursor-pointer"
          onClick={() => onFocusProvider && finding.providerNpi && onFocusProvider(finding.providerNpi)}
        >
          {/* Header Row: [Severity dot] Provider Name | Trust */}
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor] ${
              finding.severity === 'critical' ? 'bg-[var(--vt-severity-critical)] text-[var(--vt-severity-critical)]' :
              finding.severity === 'high' ? 'bg-[var(--vt-severity-high)] text-[var(--vt-severity-high)]' :
              finding.severity === 'medium' ? 'bg-[var(--vt-severity-medium)] text-[var(--vt-severity-medium)]' :
              'bg-[var(--vt-severity-low)] text-[var(--vt-severity-low)]'
            }`} />
            <h3 className="text-lg font-medium text-[var(--vt-text-1)] tracking-tight">
              {finding.providerLabel ?? `Provider ${finding.providerNpi}`}
            </h3>
            <div className="ml-auto text-sm font-mono text-[var(--vt-text-2)] tabular-nums">
              {Math.round(finding.priorityScore ?? 0)} SCORE
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm leading-relaxed text-[var(--vt-text-1)]">
            {finding.summary ?? finding.title}
          </p>

          {/* Confidence bar */}
          <div className="h-0.5 w-full bg-[var(--vt-border)] rounded-full overflow-hidden mt-1 opacity-60">
            <div 
              className={`h-full transition-all duration-1000 ease-out ${
                finding.severity === 'critical' ? 'bg-[var(--vt-severity-critical)]' :
                finding.severity === 'high' ? 'bg-[var(--vt-severity-high)]' :
                finding.severity === 'medium' ? 'bg-[var(--vt-severity-medium)]' :
                'bg-[var(--vt-severity-low)]'
              }`} 
              style={{ width: `${Math.round((finding.confidence ?? 0) * 100)}%` }}
            />
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-2 text-xs font-mono uppercase tracking-wider text-[var(--vt-text-3)]">
            {finding.updatedAt && (
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" />
                {formatRelativeTime(finding.updatedAt)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Bot className="h-3 w-3" />
              {finding.investigatorId || 'SYS'}
            </span>
            {finding.storylineId && (
              <span className="flex items-center gap-1.5 truncate">
                <GitBranch className="h-3 w-3" />
                {finding.storylineTitle ?? 'STORYLINE'}
              </span>
            )}
            <span className="flex items-center gap-1.5 ml-auto">
              {Math.round((finding.confidence ?? 0) * 100)}% CONF
            </span>
          </div>
        </article>
      ) : null}
    </SurfaceState>
  );
}
