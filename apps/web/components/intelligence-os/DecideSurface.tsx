'use client';

import { ArrowLeft } from 'lucide-react';
import { CanvasDecisionBlock } from '@/components/intelligence-ops/canvas-decision-block';
import { useActions } from '@/hooks/useActions';
import type { WorkspaceState } from '@/lib/intelligence/workspace-store';
import { formatRelativeTime } from '@/lib/intelligence/time';

interface DecideSurfaceProps {
  state: WorkspaceState;
  onNavigate: (next: Partial<WorkspaceState>) => void;
  onBack: () => void;
}

export function DecideSurface({ state, onNavigate, onBack }: DecideSurfaceProps) {
  const actions = useActions({
    entity: state.npi ?? undefined,
    limit: 30,
    pollIntervalMs: 60_000,
  });

  const items = actions.data?.actions ?? [];
  const loading = actions.loading && items.length === 0;

  return (
    <div className="flex h-full flex-col bg-[var(--vt-bg)]/45 backdrop-blur-sm">
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Monitor
          </button>
          <span className="text-[var(--vt-border)]">/</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-1)]">
            Decide
          </span>
        </div>

        {state.npi ? (
          <button
            type="button"
            onClick={() => onNavigate({ mode: 'investigate', openPanels: ['provider', 'finding', 'storyline'] })}
            className="text-[10px] text-[var(--vt-accent)] transition hover:opacity-80 font-medium"
          >
            ↗ Investigate NPI {state.npi}
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          [...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)]"
              style={{ animationDelay: `${index * 70}ms` }}
            />
          ))
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[var(--vt-text-3)]">No pending decisions.</p>
            <p className="mt-1 text-xs text-[var(--vt-text-3)]">
              Actions generate when investigators flag issues requiring human review.
            </p>
          </div>
        ) : items.map((action) => (
          <CanvasDecisionBlock
            key={action.id}
            eyebrow="Decision"
            title={action.title}
            summary={action.explanation}
            badgeLabel={action.priority}
            badgeTone={
              action.priority.toLowerCase() === 'critical'
                ? 'critical'
                : action.priority.toLowerCase() === 'high'
                  ? 'warning'
                  : 'info'
            }
            metrics={[
              { label: 'Confidence', value: `${Math.round(action.confidence * 100)}%` },
              { label: 'Priority', value: String(Math.round(action.priorityScore)) },
              { label: 'Signals', value: String(action.sourceFindingIds.length) },
              { label: 'Created', value: formatRelativeTime(action.createdAt) },
            ]}
            recommendations={action.evidence.slice(0, 3).map((evidence) => (
              evidence.snippet ? `${evidence.label}: ${evidence.snippet}` : evidence.label
            ))}
            backlinks={[
              ...(action.providerNpi
                ? [{
                    label: action.targetLabel ?? `Provider ${action.providerNpi}`,
                    onClick: () => onNavigate({
                      mode: 'investigate',
                      npi: action.providerNpi,
                      openPanels: ['provider', 'finding', 'storyline'],
                    }),
                  }]
                : []),
              ...(action.sourceFindingIds[0]
                ? [{
                    label: `Finding ${action.sourceFindingIds[0]}`,
                    onClick: () => onNavigate({
                      mode: 'investigate',
                      npi: action.providerNpi ?? state.npi,
                      findingId: action.sourceFindingIds[0],
                      openPanels: ['provider', 'finding', 'storyline'],
                    }),
                  }]
                : []),
            ]}
            primaryAction={{
              label: 'Investigate',
              onClick: () => onNavigate({
                mode: 'investigate',
                npi: action.providerNpi ?? state.npi,
                findingId: action.sourceFindingIds[0] ?? state.findingId,
                openPanels: ['provider', 'finding', 'storyline'],
              }),
              tone: 'primary',
            }}
            secondaryActions={[
              {
                label: 'Hold',
                onClick: () => onNavigate({ actionId: action.id }),
              },
              {
                label: 'Decide later',
                onClick: () => onNavigate({ actionId: action.id }),
              },
            ]}
          />
        ))}
      </div>
    </div>
  );
}
