'use client';

import { Link2, ShieldCheck } from 'lucide-react';
import { ContextPanel } from '@/components/shell/ContextPanel';
import type {
  IntelligenceAlert,
  IntelligenceGraphResponse,
  IntelligenceProvider,
  IntelligenceSource,
  IntelligenceSystemHealth,
} from '@/lib/intelligence/contracts';
import { CopilotPanel } from './CopilotPanel';
import { GraphPanel } from './GraphPanel';
import { HealthStatusCard } from './HealthStatusCard';
import { ToneBadge } from './shared';

interface RightPanelProps {
  providers: IntelligenceProvider[];
  selectedProvider: IntelligenceProvider | null;
  graph: IntelligenceGraphResponse | null;
  graphLoading: boolean;
  graphError: string | null;
  systemHealth: IntelligenceSystemHealth | null;
  systemHealthLoading: boolean;
  systemHealthError: string | null;
  sources: IntelligenceSource[];
  alerts: IntelligenceAlert[];
  onSelectProvider: (provider: IntelligenceProvider) => void;
  onRefreshGraph: () => void;
  onRefreshSystemHealth: () => void;
}

export function RightPanel({
  providers,
  selectedProvider,
  graph,
  graphLoading,
  graphError,
  systemHealth,
  systemHealthLoading,
  systemHealthError,
  sources,
  alerts,
  onSelectProvider,
  onRefreshGraph,
  onRefreshSystemHealth,
}: RightPanelProps) {
  return (
    <ContextPanel
      title="Context Panel"
      subtitle="Trust graph, Copilot, source evidence, and system health for the selected provider."
    >
      <div className="grid gap-4">
        <GraphPanel
          graph={graph}
          providers={providers}
          selectedProvider={selectedProvider}
          loading={graphLoading}
          error={graphError}
          onSelectProvider={onSelectProvider}
          onRetry={onRefreshGraph}
        />

        <CopilotPanel provider={selectedProvider} />

        <section className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">Sources</p>
              <h2 className="vital-panel__title">Source evidence</h2>
            </div>
            <Link2 className="h-4 w-4 text-cyan-100" />
          </div>
          <p className="vital-panel__copy">
            Evidence is derived from active findings, storyline support, and action context.
          </p>
          <div className="mt-4 grid gap-3">
            {sources.length === 0 ? (
              <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4 text-sm text-[var(--vt-text-2)]">
                No source evidence is available for the current scope.
              </div>
            ) : (
              sources.map((source) => (
                <article key={source.id} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{source.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{source.detail}</p>
                    </div>
                    <ToneBadge tone="neutral" label={source.kind} />
                  </div>
                  <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
                    {source.source ?? 'Unspecified source'}
                    {source.observedAt ? ` • ${new Date(source.observedAt).toLocaleString('en-US')}` : ''}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">System Health</p>
              <h2 className="vital-panel__title">System health agents</h2>
            </div>
            <ShieldCheck className="h-4 w-4 text-emerald-100" />
          </div>
          <p className="vital-panel__copy">
            Trust pipeline health, graph integrity, and live incidents from backend health agents.
          </p>
          <div className="mt-4 grid gap-3">
            {(systemHealth?.cards ?? []).map((card) => (
              <HealthStatusCard
                key={card.id}
                card={card}
                loading={systemHealthLoading}
                error={systemHealthError}
                onRetry={onRefreshSystemHealth}
              />
            ))}
            {(systemHealth?.incidents ?? alerts.filter((alert) => alert.source === 'system')).slice(0, 3).map((incident) => (
              <article key={incident.id} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{incident.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{incident.summary}</p>
                  </div>
                  <ToneBadge
                    tone={incident.severity === 'critical' ? 'critical' : incident.severity === 'high' ? 'degraded' : 'neutral'}
                    label={incident.severity}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </ContextPanel>
  );
}
