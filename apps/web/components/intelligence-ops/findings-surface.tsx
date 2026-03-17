'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import {
  findGraphNodeIdForProvider,
  findProviderForGraphNode,
} from '@/lib/intelligence/contracts';
import {
  hasFindingFilters,
  parseFindingFilters,
  parseMinConfidenceNumber,
  serializeFindingFilters,
} from '@/lib/intelligence/finding-filters';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
import {
  formatLastRefreshMessage,
  getAccessBannerState,
  getFindingsEmptyState,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { GraphWorkbenchPanel } from './graph-workbench-panel';
import { FindingMutationControls } from './mutation-controls';
import { OperationsShell } from './shell';
import { formatPaginationSummary, Pagination } from './pagination';
import {
  ConfidenceMeter,
  EntityLink,
  OpsBadge,
  OpsCard,
  SurfaceBanner,
  SurfaceErrorState,
  TimestampPair,
  severityTone,
} from './primitives';

const PAGE_SIZE = 10;

function formatFindingType(findingType: string) {
  return findingType.replace(/_/g, ' ');
}

function getFindingTypeColor(findingType: string) {
  switch (findingType.toLowerCase()) {
    case 'oig_exclusion':
    case 'sanction':
    case 'license_disciplinary_action':
      return 'border-l-4 border-l-rose-500';
    case 'npi_deactivation':
    case 'npi_discrepancy':
    case 'credential_mismatch':
      return 'border-l-4 border-l-amber-500';
    case 'network_anomaly':
    case 'billing_anomaly':
      return 'border-l-4 border-l-purple-500';
    default:
      return 'border-l-4 border-l-cyan-500';
  }
}

function FindingsMessageCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <OpsCard className="border-dashed">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--vt-text-1)]">{title}</p>
        <p className="max-w-2xl text-sm leading-6 text-[var(--vt-text-2)]">{description}</p>
      </div>
    </OpsCard>
  );
}

export function FindingsSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const searchQuery = searchParams.toString();
  const providerScope = searchParams.get('provider') ?? searchParams.get('providerId');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = useMemo(() => parseFindingFilters(searchParams), [searchQuery]);
  const hasScopedFilters = hasFindingFilters(filters) || Boolean(providerScope);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [graphFindingId, setGraphFindingId] = useState<string | null>(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);

  const findings = useFindings({
    provider: providerScope,
    severity: filters.severity,
    status: filters.status,
    type: filters.type,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    minConfidence: parseMinConfidenceNumber(filters.minConfidence),
    page,
    limit: PAGE_SIZE,
  });
  const providers = useProviders({
    limit: 100,
    pollIntervalMs: 60_000,
  });

  const currentHref = useMemo(() => {
    return `${pathname}${searchQuery ? `?${searchQuery}` : ''}`;
  }, [pathname, searchQuery]);

  function buildSurfaceHref(params: URLSearchParams) {
    return pathname === '/intelligence'
      ? buildIntelligenceHref('findings', params)
      : `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  }

  function pushWithParams(nextPage = 1) {
    const params = serializeFindingFilters(filters, { page: nextPage });
    if (providerScope) {
      params.set('provider', providerScope);
    }

    startTransition(() => {
      router.push(buildSurfaceHref(params));
    });
  }

  function pushProviderScope(nextProviderNpi: string) {
    const params = serializeFindingFilters(filters, { page: 1 });
    params.set('provider', nextProviderNpi);

    startTransition(() => {
      router.push(buildSurfaceHref(params));
    });
  }

  const accessBanner = getAccessBannerState(findings.data?.accessMode, findings.data?.reason);
  const staleState = getSurfaceFreshnessState({
    generatedAt: findings.data?.generatedAt,
    lastUpdated: findings.lastUpdated,
  });
  const rawItems = findings.data?.findings ?? [];
  const items = useMemo(
    () => (criticalOnly ? rawItems.filter((finding) => finding.severity === 'critical') : rawItems),
    [criticalOnly, rawItems],
  );
  const graphItems = items.length > 0 ? items : rawItems;

  useEffect(() => {
    if (graphItems.length === 0) {
      setGraphFindingId(null);
      return;
    }

    if (graphFindingId && graphItems.some((finding) => finding.id === graphFindingId)) {
      return;
    }

    setGraphFindingId(graphItems[0]?.id ?? null);
  }, [graphFindingId, graphItems]);

  const graphFinding = useMemo(
    () => graphItems.find((finding) => finding.id === graphFindingId) ?? graphItems[0] ?? null,
    [graphFindingId, graphItems],
  );
  const graphScopeNpi = providerScope ?? graphFinding?.providerNpi ?? null;
  const graph = useGraph({
    npi: graphScopeNpi,
    layer: 'blended',
    limit: graphScopeNpi ? 64 : 40,
    pollIntervalMs: 45_000,
  });
  const selectedGraphProvider = useMemo(() => {
    if (!graphScopeNpi) {
      return null;
    }

    return (providers.data?.providers ?? []).find((provider) => provider.npi === graphScopeNpi) ?? null;
  }, [graphScopeNpi, providers.data?.providers]);
  const graphFocusNodeId = useMemo(() => {
    const nodes = graph.data?.nodes ?? [];

    if (nodes.length === 0) {
      return null;
    }

    if (selectedGraphNodeId && nodes.some((node) => node.id === selectedGraphNodeId)) {
      return selectedGraphNodeId;
    }

    return (
      findGraphNodeIdForProvider(selectedGraphProvider, nodes)
      ?? graph.data?.focusNodeId
      ?? nodes[0]?.id
      ?? null
    );
  }, [graph.data?.focusNodeId, graph.data?.nodes, selectedGraphNodeId, selectedGraphProvider]);
  const selectedGraphNode = useMemo(
    () => (graph.data?.nodes ?? []).find((node) => node.id === graphFocusNodeId) ?? null,
    [graph.data?.nodes, graphFocusNodeId],
  );
  const graphRelationshipCount = useMemo(() => {
    if (!graphFocusNodeId) {
      return 0;
    }

    return (graph.data?.edges ?? []).filter((edge) => (
      edge.source === graphFocusNodeId || edge.target === graphFocusNodeId
    )).length;
  }, [graph.data?.edges, graphFocusNodeId]);
  const graphContextProvider = useMemo(() => (
    findProviderForGraphNode(
      graphFocusNodeId,
      graph.data?.nodes ?? [],
      providers.data?.providers ?? [],
    ) ?? selectedGraphProvider
  ), [graph.data?.nodes, graphFocusNodeId, providers.data?.providers, selectedGraphProvider]);
  const graphContextFinding = useMemo(() => {
    const candidateFindingIds = new Set<string>(selectedGraphNode?.findingIds ?? []);

    for (const edge of graph.data?.edges ?? []) {
      if (!graphFocusNodeId || (edge.source !== graphFocusNodeId && edge.target !== graphFocusNodeId)) {
        continue;
      }

      for (const findingId of edge.findingIds ?? []) {
        candidateFindingIds.add(findingId);
      }
    }

    return rawItems.find((finding) => candidateFindingIds.has(finding.id)) ?? graphFinding ?? null;
  }, [graph.data?.edges, graphFinding, graphFocusNodeId, rawItems, selectedGraphNode?.findingIds]);
  const graphContextStorylineId = graphContextFinding?.storylineId ?? selectedGraphNode?.storylineIds?.[0] ?? null;
  const graphContextStorylineTitle = graphContextFinding?.storylineId === graphContextStorylineId
    ? graphContextFinding.storylineTitle
    : null;
  const openFullGraphHref = useMemo(() => {
    const params = new URLSearchParams();

    if (graphScopeNpi) {
      params.set('npi', graphScopeNpi);
      params.set('providerId', graphScopeNpi);
    }

    if (graphContextFinding?.id) {
      params.set('findingId', graphContextFinding.id);
    }

    if (graphContextStorylineId) {
      params.set('storylineId', graphContextStorylineId);
    }

    if (graphFocusNodeId) {
      params.set('focusNodeId', graphFocusNodeId);
    }

    const serialized = params.toString();
    return serialized.length > 0 ? `/graph?${serialized}` : '/graph';
  }, [graphContextFinding?.id, graphContextStorylineId, graphFocusNodeId, graphScopeNpi]);

  const total = findings.data?.total ?? 0;
  const totalPages = findings.data?.pageInfo?.totalPages ?? 1;
  const apiReturnedEmpty = !findings.loading && !findings.error && rawItems.length === 0;
  const criticalFilterRemovedAll = !findings.loading && !findings.error && rawItems.length > 0 && criticalOnly && items.length === 0;
  const emptyState = getFindingsEmptyState({
    findingCount: rawItems.length,
    hasFilters: hasScopedFilters,
    providerCount: providers.data?.total ?? null,
  });

  return (
    <OperationsShell
      activeHref={pathname === '/intelligence' ? '/intelligence' : '/findings'}
      activeNavKey="findings"
      title="Findings"
      description="Live investigator findings with direct links across providers, storylines, evidence, and graph context."
      breadcrumbs={[{ label: 'Findings' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Feed state</p>
          <p>{findings.data?.total ?? 0} total findings</p>
          {findings.lastUpdated ? (
            <p className="text-sm text-[var(--vt-text-3)]" title={formatAbsoluteTime(findings.lastUpdated)}>
              Last update: {formatRelativeTime(findings.lastUpdated)}
            </p>
          ) : (
            <p className="text-sm text-[var(--vt-text-3)]">Last update: Just now</p>
          )}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={findings.refresh}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
      banner={(
        <>
          {accessBanner ? (
            <SurfaceBanner tone={accessBanner.tone}>
              {accessBanner.description}
            </SurfaceBanner>
          ) : null}
          {findings.recovering && findings.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful findings snapshot while background retries continue.
            </SurfaceBanner>
          ) : null}
          {staleState.isStale && staleState.ageMinutes !== null ? (
            <SurfaceBanner tone="info">
              {formatLastRefreshMessage(staleState.ageMinutes)}
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      <OpsCard className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">List controls</p>
          <p className="text-sm text-[var(--vt-text-2)]">
            {hasScopedFilters
              ? 'Query filters from the current route are active.'
              : 'Rendering the live feed order returned by the backend.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={criticalOnly}
            onClick={() => setCriticalOnly((current) => !current)}
            className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-xs font-medium transition ${
              criticalOnly
                ? 'border-cyan-400/30 bg-cyan-400/10 text-[var(--vt-text-1)]'
                : 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-2)]'
            }`}
          >
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                criticalOnly ? 'bg-cyan-400/30' : 'bg-[var(--vt-surface-2)]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-cyan-300 transition ${
                  criticalOnly ? 'left-4' : 'left-0.5'
                }`}
              />
            </span>
            Critical Only
          </button>
          <span className="text-xs text-[var(--vt-text-3)]">
            {criticalOnly
              ? `${items.length} critical finding${items.length === 1 ? '' : 's'} visible on this page`
              : 'Severity, confidence, and timestamps are live from /api/intelligence/findings.'}
          </span>
        </div>
      </OpsCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <GraphWorkbenchPanel
          graph={graph.data ?? null}
          providers={providers.data?.providers ?? []}
          selectedProvider={graphContextProvider}
          selectedFindingId={graphContextFinding?.id ?? graphFinding?.id ?? null}
          selectedStorylineId={graphContextStorylineId}
          openFullGraphHref={openFullGraphHref}
          loading={graph.loading && !graph.data}
          error={graph.error}
          onRetry={graph.refresh}
          focusNodeId={graphFocusNodeId}
          highlightNodeId={graphFocusNodeId}
          onSelectProvider={(provider) => {
            setSelectedGraphNodeId(null);
            pushProviderScope(provider.npi);
          }}
          onSelectGraphNode={setSelectedGraphNodeId}
        />

        <OpsCard className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Investigation context</p>
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">
              {selectedGraphNode ? selectedGraphNode.label : 'Select a node to inspect'}
            </h2>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              {selectedGraphNode
                ? selectedGraphNode.title || 'This node is now driving the embedded investigation context.'
                : 'The embedded graph highlights the first-degree network around the current provider scope. Click any node to update this context panel.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedGraphNode ? <OpsBadge label={selectedGraphNode.type.replace(/_/g, ' ')} /> : null}
            {graphContextFinding ? (
              <OpsBadge label={graphContextFinding.severity} tone={severityTone(graphContextFinding.severity)} />
            ) : null}
            <span className="text-sm text-[var(--vt-text-3)]">
              {graphRelationshipCount} relationship{graphRelationshipCount === 1 ? '' : 's'} in scope
            </span>
          </div>

          <div className="space-y-2 text-sm text-[var(--vt-text-2)]">
            <p>
              Provider: {graphContextProvider ? `${graphContextProvider.name} (${graphContextProvider.npi})` : 'No provider mapped'}
            </p>
            <p>
              Finding: {graphContextFinding ? graphContextFinding.title : 'No linked finding in the current page payload'}
            </p>
            <p>
              Storyline: {graphContextStorylineTitle ?? graphContextStorylineId ?? 'No linked storyline'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {graphContextProvider ? (
              <EntityLink
                href={buildIntelligenceHref('findings', { provider: graphContextProvider.npi })}
                label={graphContextProvider.name}
              />
            ) : null}
            {graphContextFinding ? (
              <EntityLink
                href={`/findings/${graphContextFinding.id}?from=${encodeURIComponent(currentHref)}`}
                label="Open finding"
              />
            ) : null}
            {graphContextStorylineId ? (
              <EntityLink
                href={`/storylines/${graphContextStorylineId}?from=${encodeURIComponent(currentHref)}`}
                label={graphContextStorylineTitle ?? 'Open storyline'}
              />
            ) : null}
            <EntityLink href={openFullGraphHref} label="Open full graph" />
          </div>
        </OpsCard>
      </div>

      {findings.error && rawItems.length === 0 ? (
        <SurfaceErrorState
          title="Finding feed unavailable"
          description={findings.error}
          onRetry={findings.refresh}
        />
      ) : null}

      {apiReturnedEmpty && emptyState ? (
        <FindingsMessageCard
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : null}

      {criticalFilterRemovedAll ? (
        <FindingsMessageCard
          title="No critical findings on this page"
          description="The live feed returned findings, but none of them are currently marked critical."
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((finding, index) => (
          <OpsCard
            key={finding.id}
            className={`overflow-hidden opacity-0 animate-alive-slide ${getFindingTypeColor(finding.findingType)} ${finding.severity === 'critical' ? 'animate-critical-pulse' : ''}`}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={formatFindingType(finding.findingType)} />
                  <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                  <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
                  <span className="text-xs text-[var(--vt-text-3)]">{finding.investigatorId}</span>
                </div>

                <div className="space-y-2">
                  <Link
                    href={{
                      pathname: `/findings/${finding.id}`,
                      query: { from: currentHref },
                    }}
                    className="block text-xl font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                  >
                    {finding.title}
                  </Link>
                  <p className="max-w-4xl text-sm leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {finding.providerNpi ? (
                    <Link
                      href={`/providers/${finding.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                      className="font-medium text-cyan-300 transition hover:text-[var(--vt-accent)]"
                    >
                      {finding.providerLabel ?? `Provider ${finding.providerNpi}`}
                    </Link>
                  ) : (
                    <span className="text-[var(--vt-text-3)]">Provider not attached</span>
                  )}
                  {finding.storylineId ? (
                    <EntityLink
                      href={`/storylines/${finding.storylineId}?from=${encodeURIComponent(currentHref)}`}
                      label={finding.storylineTitle ?? 'Open storyline'}
                    />
                  ) : null}
                  {finding.providerNpi ? (
                    <EntityLink
                      href={buildIntelligenceHref('findings', { provider: finding.providerNpi })}
                      label="Provider findings"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setGraphFindingId(finding.id);
                      setSelectedGraphNodeId(null);
                    }}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                      graphFinding?.id === finding.id
                        ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                        : 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)]'
                    }`}
                  >
                    Focus graph
                  </button>
                </div>

                {finding.evidence.length > 0 ? (
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Evidence preview</p>
                      <span className="text-xs text-[var(--vt-text-3)]">{finding.evidence.length} sources</span>
                    </div>
                    <ul className="space-y-3">
                      {finding.evidence.slice(0, 3).map((evidence) => (
                        <li key={evidence.id} className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[var(--vt-text-1)]">{evidence.label}</span>
                            {evidence.observedAt ? (
                              <span className="text-xs text-[var(--vt-text-3)]" title={formatAbsoluteTime(evidence.observedAt)}>
                                {formatRelativeTime(evidence.observedAt)}
                              </span>
                            ) : null}
                          </div>
                          {evidence.snippet ? (
                            <p className="leading-6 text-[var(--vt-text-2)]">{evidence.snippet}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="w-full max-w-sm shrink-0 space-y-4">
                <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Confidence</p>
                  <div className="mt-3">
                    <ConfidenceMeter confidence={finding.confidence} />
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[var(--vt-text-2)]">
                    <p>Priority {Math.round(finding.priorityScore)}</p>
                    <TimestampPair label="First seen" value={finding.firstSeenAt} />
                    <TimestampPair label="Updated" value={finding.updatedAt} />
                  </div>
                </div>

                <FindingMutationControls findingId={finding.id} status={finding.status} compact />
              </div>
            </div>
          </OpsCard>
        ))}
      </div>

      {findings.loading && rawItems.length === 0 ? (
        <FindingsMessageCard
          title="Loading live findings"
          description={providerScope
            ? `Fetching the latest findings for provider ${providerScope}.`
            : 'Fetching the latest findings feed and graph context from the intelligence APIs.'}
        />
      ) : null}

      {total > 0 ? (
        <OpsCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--vt-text-2)]">
            {formatPaginationSummary({
              page,
              limit: PAGE_SIZE,
              total,
              label: 'findings',
            })}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={pushWithParams} />
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
