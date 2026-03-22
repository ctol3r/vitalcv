'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useEntityRegistry } from '@/hooks/useEntityRegistry';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import {
  type IntelligenceFinding,
} from '@/lib/intelligence/contracts';
import {
  hasFindingFilters,
  parseFindingFilters,
  parseMinConfidenceNumber,
  serializeFindingFilters,
} from '@/lib/intelligence/finding-filters';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import {
  formatLastRefreshMessage,
  getAccessBannerState,
  getFindingsEmptyState,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import {
  buildIntelligenceWorkspacePayload,
  resolveGraphFocusNodeId,
  resolveWorkspaceSelectionFromGraphNode,
} from '@/lib/intelligence/workspace-model';
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
  SurfaceEmptyState,
  SurfaceErrorState,
  TimestampPair,
  severityTone,
} from './primitives';

const PAGE_SIZE = 10;

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

function FeedMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--vt-text-1)]">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-[var(--vt-text-3)]">{detail}</p>
    </div>
  );
}

function LiveSignalRow({
  title,
  detail,
  href,
  timestamp,
}: {
  title: string;
  detail: string;
  href: string | null;
  timestamp: string | null;
}) {
  const content = (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-[var(--vt-text-1)]">{title}</p>
        <p className="line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)]">{detail}</p>
      </div>
      {timestamp ? (
        <span className="shrink-0 text-[10px] text-[var(--vt-text-3)]" title={formatAbsoluteTime(timestamp)}>
          {formatRelativeTime(timestamp)}
        </span>
      ) : null}
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 transition hover:border-cyan-400/30 hover:bg-[var(--vt-surface-2)]"
    >
      {content}
    </Link>
  ) : (
    <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
      {content}
    </div>
  );
}

function FindingFeedCard({
  finding,
  currentHref,
  selectionHref,
  isFocused,
  onSelectFinding,
  onFocusGraph,
}: {
  finding: IntelligenceFinding;
  currentHref: string;
  selectionHref: string;
  isFocused: boolean;
  onSelectFinding: (finding: IntelligenceFinding) => void;
  onFocusGraph: (findingId: string) => void;
}) {
  return (
    <div className={`w-full border-[1px] border-[var(--vt-border)] bg-[var(--vt-surface)] transition select-none ${getFindingTypeColor(finding.findingType)} ${finding.severity === 'critical' ? 'bg-rose-500/5' : ''}`}>
      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                {finding.findingType.replace(/_/g, ' ')}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                INV {finding.investigatorId}
              </span>
              <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
            </div>

            <div className="space-y-1">
              <Link
                href={selectionHref}
                onClick={(event) => {
                  event.preventDefault();
                  onSelectFinding(finding);
                }}
                className="block text-base font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
              >
                {finding.title}
              </Link>
              <p className="max-w-4xl text-sm leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {finding.providerNpi ? (
                <Link
                  href={`/providers/${finding.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                  className="inline-flex items-center gap-1 rounded-[2px] bg-[var(--vt-surface)] border border-[var(--vt-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--vt-text-2)] transition hover:border-[var(--vt-text-3)]"
                >
                  <span className="text-[var(--vt-text-3)]">Target</span> {finding.providerLabel ?? `Provider ${finding.providerNpi}`}
                </Link>
              ) : null}
              {finding.storylineId ? (
                <Link
                  href={`/storylines/${finding.storylineId}?from=${encodeURIComponent(currentHref)}`}
                  className="inline-flex items-center gap-1 rounded-[2px] bg-[var(--vt-surface)] border border-[var(--vt-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--vt-text-2)] transition hover:border-[var(--vt-text-3)]"
                >
                   <span className="text-[var(--vt-text-3)]">Story</span> {finding.storylineTitle ?? 'Open storyline'}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => onFocusGraph(finding.id)}
                className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] transition ${
                  isFocused
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                    : 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-2)] hover:border-[var(--vt-text-3)]'
                }`}
              >
                Focus graph
              </button>
            </div>

            {finding.evidence.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2 mt-3">
                {finding.evidence.slice(0, 2).map((evidence) => (
                  <div
                    key={evidence.id}
                    className="border-l-[2px] border-l-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-2)]">{evidence.label}</p>
                      {evidence.observedAt ? (
                        <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]" title={formatAbsoluteTime(evidence.observedAt)}>
                          {formatRelativeTime(evidence.observedAt)}
                        </span>
                      ) : null}
                    </div>
                    {evidence.snippet ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)] italic">"{evidence.snippet}"</p>
                    ) : null}
                  </div>
                ))}
                {finding.evidence.length > 2 ? (
                  <div className="flex items-center border-[1px] border-dashed border-[var(--vt-border)] bg-transparent px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]">
                    + {finding.evidence.length - 2} MORE EVIDENCE ITEM{finding.evidence.length - 2 === 1 ? '' : 'S'}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="w-full max-w-[14rem] shrink-0 space-y-3">
            <div className="border-[1px] border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Confidence</p>
                <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">PRI {Math.round(finding.priorityScore)}</span>
              </div>
              <div className="mt-2 text-xs font-semibold text-[var(--vt-text-1)]">
                {Math.round(finding.confidence * 100)}% Match
              </div>
              <div className="mt-2.5">
                <ConfidenceMeter confidence={finding.confidence} />
              </div>
              <div className="mt-3 space-y-1 text-[10px] text-[var(--vt-text-2)]">
                <TimestampPair label="First seen" value={finding.firstSeenAt} />
                <TimestampPair label="Updated" value={finding.updatedAt} />
              </div>
            </div>

            <FindingMutationControls findingId={finding.id} status={finding.status} compact />
          </div>
        </div>

        {finding.explanation && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--vt-border)] pt-3 text-[10px] uppercase tracking-[0.05em] text-[var(--vt-text-3)]">
            <span className="font-semibold text-[var(--vt-text-2)]">Why it matters:</span> {finding.explanation}
          </div>
        )}
      </div>
    </div>
  );
}

export function FindingsSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const searchQuery = searchParams.toString();
  const providerScope = searchParams.get('provider') ?? searchParams.get('providerId');
  const selectedFindingId = searchParams.get('findingId');
  const selectedGraphFocus = searchParams.get('graphFocus');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = useMemo(() => parseFindingFilters(searchParams), [searchQuery]);
  const hasScopedFilters = hasFindingFilters(filters) || Boolean(providerScope);
  const [criticalOnly, setCriticalOnly] = useState(false);

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

  const currentHref = useMemo(() => `${pathname}${searchQuery ? `?${searchQuery}` : ''}`, [pathname, searchQuery]);

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

  const accessBanner = getAccessBannerState(findings.data?.accessMode, findings.data?.reason);
  const staleState = getSurfaceFreshnessState({
    generatedAt: findings.data?.generatedAt,
    lastUpdated: findings.lastUpdated,
  });
  const alerts = findings.data?.alerts ?? [];
  const rawItems = findings.data?.findings ?? [];
  const items = useMemo(
    () => (criticalOnly ? rawItems.filter((finding) => finding.severity === 'critical') : rawItems),
    [criticalOnly, rawItems],
  );
  const graphItems = items.length > 0 ? items : rawItems;

  const graphFinding = useMemo(
    () => graphItems.find((finding) => finding.id === selectedFindingId) ?? graphItems[0] ?? null,
    [graphItems, selectedFindingId],
  );
  const graphScopeNpi = providerScope ?? graphFinding?.providerNpi ?? null;
  const graph = useGraph({
    npi: graphScopeNpi,
    layer: 'blended',
    limit: graphScopeNpi ? 64 : 40,
    pollIntervalMs: 45_000,
  });
  const graphRelatedFindings = useFindings({
    provider: graphScopeNpi,
    limit: 50,
    pollIntervalMs: 30_000,
    paused: !graphScopeNpi,
  });
  const graphRelatedStorylines = useStorylines({
    provider: graphScopeNpi,
    limit: 50,
    pollIntervalMs: 30_000,
    paused: !graphScopeNpi,
  });
  const selectedGraphProvider = useMemo(() => {
    if (!graphScopeNpi) {
      return null;
    }

    return (providers.data?.providers ?? []).find((provider) => provider.npi === graphScopeNpi) ?? null;
  }, [graphScopeNpi, providers.data?.providers]);
  const graphScopedFindings = graphRelatedFindings.data?.findings ?? [];
  const allFindings = useMemo(() => {
    const map = new Map<string, IntelligenceFinding>();
    for (const f of rawItems) map.set(f.id, f);
    for (const f of graphScopedFindings) { if (!map.has(f.id)) map.set(f.id, f); }
    return [...map.values()];
  }, [rawItems, graphScopedFindings]);
  const workspacePayload = useMemo(() => buildIntelligenceWorkspacePayload({
    providers: providers.data?.providers ?? [],
    findings: allFindings,
    storylines: graphRelatedStorylines.data?.storylines ?? [],
  }), [allFindings, graphRelatedStorylines.data?.storylines, providers.data?.providers]);
  const selectedGraphStoryline = useMemo(
    () => (graphFinding?.storylineId ? workspacePayload.storylinesById.get(graphFinding.storylineId) ?? null : null),
    [graphFinding?.storylineId, workspacePayload.storylinesById],
  );
  const graphFocusNodeId = useMemo(() => resolveGraphFocusNodeId({
    graph: graph.data ?? null,
    graphFocus: selectedGraphFocus,
    provider: selectedGraphProvider,
    finding: graphFinding,
    storyline: selectedGraphStoryline,
  }), [graph.data, graphFinding, selectedGraphFocus, selectedGraphProvider, selectedGraphStoryline]);
  const selectedGraphNode = useMemo(
    () => (graph.data?.nodes ?? []).find((node) => node.id === graphFocusNodeId) ?? null,
    [graph.data?.nodes, graphFocusNodeId],
  );
  const graphRelationshipCount = useMemo(() => {
    if (!graphFocusNodeId) {
      return 0;
    }

    return (graph.data?.edges ?? []).filter((edge) => edge.source === graphFocusNodeId || edge.target === graphFocusNodeId).length;
  }, [graph.data?.edges, graphFocusNodeId]);

  const { expandGraphNode, getTooltipContext } = useEntityRegistry({
    providers: providers.data?.providers ?? [],
    findings: allFindings,
    storylines: graphRelatedStorylines.data?.storylines ?? [],
    graph: graph.data ?? null,
  });
  const graphSelection = useMemo(() => resolveWorkspaceSelectionFromGraphNode({
    graph: graph.data ?? null,
    nodeId: graphFocusNodeId,
    providers: providers.data?.providers ?? [],
    findings: allFindings,
    storylines: graphRelatedStorylines.data?.storylines ?? [],
  }), [allFindings, graph.data, graphFocusNodeId, graphRelatedStorylines.data?.storylines, providers.data?.providers]);

  const nodeContext = useMemo(
    () => graphFocusNodeId ? expandGraphNode(graphFocusNodeId) : null,
    [expandGraphNode, graphFocusNodeId],
  );

  const graphContextProvider = useMemo(() => {
    if (graphSelection.provider) {
      return graphSelection.provider;
    }
    const npi = nodeContext?.providers[0]?.sourceId;
    if (npi) {
      const match = (providers.data?.providers ?? []).find((p) => p.npi === npi);
      if (match) return match;
    }
    return selectedGraphProvider;
  }, [graphSelection.provider, nodeContext?.providers, providers.data?.providers, selectedGraphProvider]);

  const graphContextFinding = useMemo(() => {
    if (graphSelection.finding) {
      return graphSelection.finding;
    }
    for (const entity of nodeContext?.findings ?? []) {
      const match = graphScopedFindings.find((f) => f.id === entity.sourceId)
        ?? rawItems.find((f) => f.id === entity.sourceId);
      if (match) return match;
    }
    return graphFinding;
  }, [graphFinding, graphScopedFindings, graphSelection.finding, nodeContext?.findings, rawItems]);
  const graphContextStoryline = useMemo(() => {
    if (graphSelection.storyline) {
      return graphSelection.storyline;
    }

    const storylineId = graphContextFinding?.storylineId
      ?? nodeContext?.storylines[0]?.sourceId
      ?? selectedGraphNode?.storylineIds?.[0]
      ?? null;
    if (!storylineId) {
      return selectedGraphStoryline;
    }

    return workspacePayload.storylinesById.get(storylineId)
      ?? selectedGraphStoryline;
  }, [
    graphContextFinding?.storylineId,
    graphSelection.storyline,
    nodeContext?.storylines,
    selectedGraphNode?.storylineIds,
    selectedGraphStoryline,
    workspacePayload.storylinesById,
  ]);
  const graphContextStorylineId = graphContextStoryline?.id ?? null;
  const graphContextStorylineTitle = graphContextStoryline?.title
    ?? graphContextFinding?.storylineTitle
    ?? null;
  const openFullGraphHref = useMemo(() => {
    return buildIntelligenceGraphHref({
      npi: graphScopeNpi,
      providerId: graphScopeNpi,
      findingId: graphContextFinding?.id,
      storylineId: graphContextStorylineId,
      focusNodeId: graphFocusNodeId,
    });
  }, [graphContextFinding?.id, graphContextStorylineId, graphFocusNodeId, graphScopeNpi]);

  const total = findings.data?.total ?? 0;
  const totalPages = findings.data?.pageInfo?.totalPages ?? 1;
  const visibleCount = items.length;
  const activeScopeLabel = providerScope ? `Provider ${providerScope}` : hasScopedFilters ? 'Filtered scope' : 'Global feed';
  const refreshLabel = findings.loading && !findings.data ? 'Loading live feed…' : findings.loading ? 'Refreshing…' : 'Refresh';
  const liveFeedNote = criticalOnly && rawItems.length > 0 && items.length === 0
    ? `Critical-only filter is hiding ${rawItems.length} live finding${rawItems.length === 1 ? '' : 's'}.`
    : findings.loading && findings.data
      ? `Live feed is refreshing for ${activeScopeLabel}.`
      : `Feed query active for ${activeScopeLabel}.`;
  const emptyState = !findings.loading && !findings.error && items.length === 0
    ? (
      criticalOnly && rawItems.length > 0
        ? {
            title: 'No findings match the current filters.',
            description: 'Clear the critical-only toggle or widen the route filters to show the hidden findings on this page.',
          }
        : getFindingsEmptyState({
            findingCount: rawItems.length,
            hasFilters: hasScopedFilters,
            providerCount: providers.data?.total ?? null,
          })
    )
    : null;

  function buildWorkspaceHref(next: {
    providerNpi?: string | null;
    findingId?: string | null;
    storylineId?: string | null;
    graphFocus?: string | null;
  }) {
    const params = serializeFindingFilters(filters, { page });
    const nextProviderNpi = next.providerNpi ?? providerScope ?? null;

    params.delete('provider');
    params.delete('npi');
    params.delete('findingId');
    params.delete('storylineId');
    params.delete('graphFocus');

    if (nextProviderNpi) {
      params.set('provider', nextProviderNpi);
      params.set('npi', nextProviderNpi);
    }
    if (next.findingId) {
      params.set('findingId', next.findingId);
    }
    if (next.storylineId) {
      params.set('storylineId', next.storylineId);
    }
    if (next.graphFocus) {
      params.set('graphFocus', next.graphFocus);
    }

    return buildSurfaceHref(params);
  }

  function focusFindingInWorkspace(finding: IntelligenceFinding) {
    startTransition(() => {
      router.push(buildWorkspaceHref({
        providerNpi: finding.providerNpi ?? providerScope,
        findingId: finding.id,
        storylineId: finding.storylineId,
        graphFocus: finding.id,
      }));
    });
  }

  function focusGraphNodeInWorkspace(nodeId: string | null) {
    if (!nodeId) {
      return;
    }

    const selection = resolveWorkspaceSelectionFromGraphNode({
      graph: graph.data ?? null,
      nodeId,
      providers: providers.data?.providers ?? [],
      findings: allFindings,
      storylines: graphRelatedStorylines.data?.storylines ?? [],
    });

    startTransition(() => {
      router.push(buildWorkspaceHref({
        providerNpi: selection.provider?.npi
          ?? selection.finding?.providerNpi
          ?? selection.storyline?.providerNpi
          ?? providerScope,
        findingId: selection.finding?.id ?? graphFinding?.id ?? null,
        storylineId: selection.storyline?.id
          ?? selection.finding?.storylineId
          ?? graphFinding?.storylineId
          ?? null,
        graphFocus: nodeId,
      }));
    });
  }

  useEffect(() => {
    if (!findings.loading && !findings.error && totalPages > 0 && page > totalPages) {
      pushWithParams(totalPages);
    }
  }, [findings.error, findings.loading, page, totalPages]);

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
          <p>{visibleCount} findings on this page</p>
          <p className="text-sm text-[var(--vt-text-3)]">
            {total} total available · {alerts.length} alert{alerts.length === 1 ? '' : 's'}
          </p>
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
          {refreshLabel}
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
          {liveFeedNote ? (
            <SurfaceBanner tone="neutral">
              {liveFeedNote}
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.85fr)]">
        <OpsCard className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Feed controls</p>
              <p className="text-sm text-[var(--vt-text-2)]">
                {hasScopedFilters
                  ? 'Route filters are active and the list is constrained to the current operational scope.'
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
                  ? `${items.length} critical finding${items.length === 1 ? '' : 's'} on this page`
                  : 'Severity, confidence, and timestamps are live from /api/intelligence/findings.'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FeedMetric
              label="Scope"
              value={activeScopeLabel}
              detail={providerScope ? 'Provider-constrained query' : 'All findings in route scope'}
            />
            <FeedMetric
              label="Findings"
              value={String(visibleCount)}
              detail={`${total} total available on page ${page}`}
            />
            <FeedMetric
              label="Alerts"
              value={String(alerts.length)}
              detail={alerts.length > 0 ? alerts[0]?.title ?? 'Live alert stream' : 'No active alert rows'}
            />
            <FeedMetric
              label="Freshness"
              value={staleState.isStale && staleState.ageMinutes !== null ? `${staleState.ageMinutes}m` : 'Live'}
              detail={findings.loading ? 'Refreshing now' : 'Current backend snapshot'}
            />
          </div>

          {alerts.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Live alerts</p>
                <span className="text-xs text-[var(--vt-text-3)]">{alerts.length} active</span>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <LiveSignalRow
                    key={alert.id}
                    title={alert.title}
                    detail={alert.summary}
                    href={alert.providerNpi ? `/providers/${alert.providerNpi}?from=${encodeURIComponent(currentHref)}` : null}
                    timestamp={alert.occurredAt}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </OpsCard>

        <OpsCard className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Workbench links</p>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              Jump directly into the graph, provider context, or scoped investigation flow without leaving the feed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EntityLink href={openFullGraphHref} label="Open graph" />
            {providerScope ? (
              <EntityLink href={buildIntelligenceHref('findings', { provider: providerScope })} label="Scoped feed" />
            ) : null}
            {graphContextProvider ? (
              <EntityLink
                href={`/providers/${graphContextProvider.npi}?from=${encodeURIComponent(currentHref)}`}
                label="Provider"
              />
            ) : null}
            {graphContextFinding ? (
              <EntityLink
                href={`/findings/${graphContextFinding.id}?from=${encodeURIComponent(currentHref)}`}
                label="Open finding"
              />
            ) : null}
          </div>
          <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3 text-sm text-[var(--vt-text-2)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Current route</p>
            <p className="mt-1 break-words">{pathname}{searchQuery ? `?${searchQuery}` : ''}</p>
          </div>
        </OpsCard>
      </div>

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
          highlightNodeIds={graphFocusNodeId ? [graphFocusNodeId] : []}
          getTooltipContext={getTooltipContext}
          onSelectProvider={(provider) => {
            startTransition(() => {
              router.push(buildWorkspaceHref({
                providerNpi: provider.npi,
                findingId: graphContextFinding?.id ?? null,
                storylineId: graphContextStorylineId,
                graphFocus: provider.npi,
              }));
            });
          }}
          onSelectGraphNode={focusGraphNodeInWorkspace}
        />

        <OpsCard className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Investigation context</p>
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">
              {selectedGraphNode ? selectedGraphNode.label : 'Select a node to inspect'}
            </h2>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              {selectedGraphNode
                ? selectedGraphNode.title || 'This node is driving the embedded investigation context.'
                : 'Click any graph node to make the right rail more specific.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedGraphNode ? <OpsBadge label={selectedGraphNode.type.replace(/_/g, ' ')} /> : null}
            {graphContextFinding ? <OpsBadge label={graphContextFinding.severity} tone={severityTone(graphContextFinding.severity)} /> : null}
            <span className="text-sm text-[var(--vt-text-3)]">
              {graphRelationshipCount} relationship{graphRelationshipCount === 1 ? '' : 's'} in scope
            </span>
          </div>

          <div className="space-y-2 text-sm text-[var(--vt-text-2)]">
            <p>
              Provider: {graphContextProvider ? `${graphContextProvider.name} (${graphContextProvider.npi})` : 'No provider mapped'}
            </p>
            <p>
              Finding: {graphContextFinding
                ? graphContextFinding.title
                : graphRelatedFindings.loading
                  ? 'Loading provider finding context…'
                  : 'No linked finding resolved from the current graph slice'}
            </p>
            <p>
              Storyline: {graphContextStorylineTitle ?? graphContextStorylineId ?? (graphRelatedStorylines.loading ? 'Loading storyline context…' : 'No linked storyline')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {graphContextProvider ? (
              <EntityLink
                href={`/providers/${graphContextProvider.npi}?from=${encodeURIComponent(currentHref)}`}
                label={graphContextProvider.name}
              />
            ) : null}
            {graphContextProvider ? (
              <EntityLink
                href={buildIntelligenceHref('findings', { provider: graphContextProvider.npi })}
                label="Provider findings"
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
            {(graphContextProvider || graphContextFinding || graphContextStorylineId) ? (
              <EntityLink
                href={buildIntelligenceHref('investigations', {
                  npi: graphContextProvider?.npi,
                  findingId: graphContextFinding?.id,
                  storylineId: graphContextStorylineId,
                })}
                label="Investigate scope"
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

      {emptyState ? (
        <SurfaceEmptyState
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((finding) => (
            <FindingFeedCard
              key={finding.id}
              finding={finding}
              currentHref={currentHref}
              selectionHref={buildWorkspaceHref({
                providerNpi: finding.providerNpi ?? providerScope,
                findingId: finding.id,
                storylineId: finding.storylineId,
                graphFocus: finding.id,
              })}
              isFocused={graphFinding?.id === finding.id}
              onSelectFinding={focusFindingInWorkspace}
              onFocusGraph={(findingId) => {
                const finding = items.find((item) => item.id === findingId)
                  ?? rawItems.find((item) => item.id === findingId)
                  ?? null;
                if (finding) {
                  focusFindingInWorkspace(finding);
                }
              }}
            />
          ))}
        </div>
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
