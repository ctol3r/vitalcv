'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { GraphWorkbenchPanel } from '@/components/intelligence-ops/graph-workbench-panel';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import {
  getAccessEmptyState,
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import {
  ConfidenceMeter,
  EntityLink,
  OpsBadge,
  OpsCard,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  TimestampPair,
  severityTone,
  trustScoreColor,
} from './primitives';

function OverviewPanel({
  title,
  total,
  href,
  children,
}: {
  title: string;
  total: number;
  href: string;
  children: ReactNode;
}) {
  return (
    <OpsCard className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--vt-text-1)]">{total}</p>
        </div>
        <Link
          href={href}
          className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
        >
          Open
        </Link>
      </div>
      {children}
    </OpsCard>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--vt-text-1)]">{value}</p>
    </div>
  );
}

export function IntelligenceOverviewSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const query = searchParams.get('q') ?? '';
  const requestedNpi = searchParams.get('npi');
  const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const providers = useProviders({
    query,
    limit: 8,
  });

  const selectedProvider = requestedNpi
    ? providers.data?.providers.find((provider) => provider.npi === requestedNpi) ?? null
    : null;
  const providerScope = selectedProvider?.npi ?? requestedNpi ?? null;

  const findings = useFindings({
    provider: providerScope,
    limit: 8,
  });
  const storylines = useStorylines({
    provider: providerScope,
    limit: 6,
  });
  const actions = useActions({
    entity: providerScope,
    limit: 6,
  });
  const actionAccessState = getAccessEmptyState({
    error: actions.error,
    resourceLabel: 'actions',
  });
  const graph = useGraph({
    npi: providerScope,
    layer: 'blended',
    limit: 48,
  });

  const selectedFinding = findings.data?.findings[0] ?? null;
  const selectedStoryline = storylines.data?.storylines[0] ?? null;
  const openFullGraphHref = buildIntelligenceGraphHref({
    npi: providerScope,
    providerId: providerScope,
    findingId: selectedFinding?.id,
    storylineId: selectedStoryline?.id,
  });
  const staleState = getSurfaceFreshnessState({
    generatedAt: findings.data?.generatedAt
      ?? providers.data?.generatedAt
      ?? storylines.data?.generatedAt
      ?? actions.data?.generatedAt
      ?? graph.data?.generatedAt,
    lastUpdated: findings.lastUpdated
      ?? providers.lastUpdated
      ?? storylines.lastUpdated
      ?? actions.lastUpdated
      ?? graph.lastUpdated,
  });

  function refreshAll() {
    providers.refresh();
    findings.refresh();
    storylines.refresh();
    actions.refresh();
    graph.refresh();
  }

  function selectProvider(nextNpi: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'dashboard');
    params.set('npi', nextNpi);
    startTransition(() => {
      router.push(`/intelligence?${params.toString()}`);
    });
  }

  const findingsHref = buildIntelligenceHref('findings', providerScope ? { provider: providerScope } : undefined);
  const providersHref = buildIntelligenceHref('providers', query ? { q: query } : undefined);
  const storylinesHref = buildIntelligenceHref('storylines', providerScope ? { provider: providerScope } : undefined);
  const actionsHref = buildIntelligenceHref('actions', providerScope ? { entity: providerScope } : undefined);

  return (
    <OperationsShell
      activeHref="/intelligence"
      activeNavKey="dashboard"
      title="Intelligence"
      description="Live findings, providers, storylines, actions, and graph context sourced directly from the backend."
      breadcrumbs={[{ label: 'Intelligence' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Console state</p>
          <p>{providers.data?.total ?? 0} providers in scope</p>
          {providers.lastUpdated ? (
            <p title={formatAbsoluteTime(providers.lastUpdated)}>Updated {formatRelativeTime(providers.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
      banner={(
        <>
          {staleState.isStale && staleState.ageMinutes !== null ? (
            <SurfaceBanner tone="info">
              {formatLastRefreshMessage(staleState.ageMinutes)}
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,1fr)]">
        <GraphWorkbenchPanel
          graph={graph.data}
          providers={providers.data?.providers ?? []}
          selectedProvider={selectedProvider}
          selectedFindingId={selectedFinding?.id ?? null}
          selectedStorylineId={selectedStoryline?.id ?? null}
          openFullGraphHref={openFullGraphHref}
          loading={graph.loading}
          error={graph.error}
          onRetry={graph.refresh}
          onSelectProvider={(provider) => selectProvider(provider.npi)}
        />

        <OpsCard className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Active scope</p>
            <h2 className="text-xl font-semibold text-[var(--vt-text-1)]">
              {selectedProvider ? selectedProvider.name : 'Global intelligence'}
            </h2>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              {selectedProvider
                ? selectedProvider.summary
                : 'The operator console is pulling live results from the findings, providers, storylines, actions, and graph backends.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryMetric label="Findings" value={findings.data?.total ?? 0} />
            <SummaryMetric label="Providers" value={providers.data?.total ?? 0} />
            <SummaryMetric label="Storylines" value={storylines.data?.total ?? 0} />
            <SummaryMetric label="Actions" value={actions.data?.total ?? 0} />
          </div>

          {selectedProvider ? (
            <div className="space-y-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-[var(--vt-text-3)]">NPI {selectedProvider.npi}</p>
                  <p className="mt-1 text-sm text-[var(--vt-text-2)]">{selectedProvider.specialties.slice(0, 3).join(' | ') || 'No specialties mapped'}</p>
                </div>
                <p className={`text-3xl font-semibold tabular-nums ${trustScoreColor(selectedProvider.trustScore)}`}>
                  {selectedProvider.trustScore}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <EntityLink href={`/providers/${selectedProvider.npi}?from=${encodeURIComponent(currentHref)}`} label="Open profile" />
                <EntityLink href={findingsHref} label="Open findings" />
                <EntityLink href={storylinesHref} label="Open storylines" />
                <EntityLink href={actionsHref} label="Open actions" />
              </div>
            </div>
          ) : null}
        </OpsCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewPanel title="Findings" total={findings.data?.total ?? 0} href={findingsHref}>
          {findings.loading && (findings.data?.findings.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--vt-text-2)]">Loading findings for the current intelligence scope…</p>
          ) : findings.error && (findings.data?.findings.length ?? 0) === 0 ? (
            <SurfaceErrorState
              title="Findings unavailable"
              description={findings.error}
              onRetry={findings.refresh}
            />
          ) : (findings.data?.findings.length ?? 0) === 0 ? (
            <SurfaceEmptyState
              title="No findings yet"
              description="The backend has not generated findings for the current scope."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
                  <tr>
                    <th className="pb-3 font-medium">Finding</th>
                    <th className="pb-3 font-medium">Provider</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Confidence</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--vt-border)]">
                  {(findings.data?.findings ?? []).map((finding) => (
                    <tr key={finding.id}>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/findings/${finding.id}?from=${encodeURIComponent(currentHref)}`}
                          className="font-medium text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                        >
                          {finding.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        {finding.providerNpi ? (
                          <Link
                            href={`/providers/${finding.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                            className="text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                          >
                            {finding.providerLabel ?? finding.providerNpi}
                          </Link>
                        ) : (
                          <span className="text-[var(--vt-text-3)]">Not attached</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <OpsBadge label={finding.findingType.replace(/_/g, ' ')} tone={severityTone(finding.severity)} />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="min-w-[9rem]">
                          <ConfidenceMeter confidence={finding.confidence} />
                        </div>
                      </td>
                      <td className="py-3 text-[var(--vt-text-2)]">
                        <TimestampPair label="Updated" value={finding.updatedAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </OverviewPanel>

        <OverviewPanel title="Providers" total={providers.data?.total ?? 0} href={providersHref}>
          {providers.loading && (providers.data?.providers.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--vt-text-2)]">Loading provider directory records…</p>
          ) : providers.error && (providers.data?.providers.length ?? 0) === 0 ? (
            <SurfaceErrorState
              title="Providers unavailable"
              description={providers.error}
              onRetry={providers.refresh}
            />
          ) : (providers.data?.providers.length ?? 0) === 0 ? (
            <SurfaceEmptyState
              title="No providers yet"
              description="The directory has not returned any providers for the current scope."
            />
          ) : (
            <div className="space-y-3">
              {(providers.data?.providers ?? []).map((provider) => (
                <button
                  key={provider.npi}
                  type="button"
                  onClick={() => selectProvider(provider.npi)}
                  className="flex w-full items-start justify-between gap-4 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 text-left transition hover:border-[var(--vt-text-3)]"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--vt-text-1)]">{provider.name}</p>
                    <p className="font-mono text-xs text-[var(--vt-text-3)]">NPI {provider.npi}</p>
                    <p className="text-sm text-[var(--vt-text-2)]">{provider.primaryIssuer ?? 'Issuer not mapped'}</p>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className={`text-2xl font-semibold tabular-nums ${trustScoreColor(provider.trustScore)}`}>
                      {provider.trustScore}
                    </p>
                    <TimestampPair label="Verified" value={provider.lastVerifiedAt} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </OverviewPanel>

        <OverviewPanel title="Storylines" total={storylines.data?.total ?? 0} href={storylinesHref}>
          {storylines.loading && (storylines.data?.storylines.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--vt-text-2)]">Loading storyline clusters…</p>
          ) : storylines.error && (storylines.data?.storylines.length ?? 0) === 0 ? (
            <SurfaceErrorState
              title="Storylines unavailable"
              description={storylines.error}
              onRetry={storylines.refresh}
            />
          ) : (storylines.data?.storylines.length ?? 0) === 0 ? (
            <SurfaceEmptyState
              title="No storylines yet"
              description="The backend has not linked any storyline clusters for the current scope."
            />
          ) : (
            <div className="space-y-3">
              {(storylines.data?.storylines ?? []).map((storyline) => (
                <div key={storyline.id} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Link
                        href={`/storylines/${storyline.id}?from=${encodeURIComponent(currentHref)}`}
                        className="text-base font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                      >
                        {storyline.title}
                      </Link>
                      <p className="text-sm leading-6 text-[var(--vt-text-2)]">{storyline.summary}</p>
                    </div>
                    <div className="space-y-2 text-right">
                      <OpsBadge label={storyline.storylineType.replace(/_/g, ' ')} tone={severityTone(storyline.severity)} />
                      <TimestampPair label="Active" value={storyline.lastActivityAt} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OverviewPanel>

        <OverviewPanel title="Actions" total={actions.data?.total ?? 0} href={actionsHref}>
          {actions.loading && (actions.data?.actions.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--vt-text-2)]">Loading the operator action queue…</p>
          ) : actionAccessState && (actions.data?.actions.length ?? 0) === 0 ? (
            <SurfaceEmptyState
              title={actionAccessState.title}
              description={actionAccessState.description}
            />
          ) : actions.error && (actions.data?.actions.length ?? 0) === 0 ? (
            <SurfaceErrorState
              title="Actions unavailable"
              description={actions.error}
              onRetry={actions.refresh}
            />
          ) : (actions.data?.actions.length ?? 0) === 0 ? (
            <SurfaceEmptyState
              title="No actions queued"
              description="The action backend has not recommended any active next steps for the current scope."
            />
          ) : (
            <div className="space-y-3">
              {(actions.data?.actions ?? []).map((action) => (
                <div key={action.id} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Link
                        href={`/actions/${action.id}?from=${encodeURIComponent(currentHref)}`}
                        className="text-base font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                      >
                        {action.title}
                      </Link>
                      <p className="text-sm leading-6 text-[var(--vt-text-2)]">{action.explanation}</p>
                    </div>
                    <div className="space-y-2 text-right">
                      <OpsBadge label={action.status} tone={severityTone(action.status)} />
                      <TimestampPair label="Created" value={action.createdAt} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OverviewPanel>
      </div>
    </OperationsShell>
  );
}
