'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import { CopilotSearchBar } from '@/components/copilot/CopilotSearchBar';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { CopilotContextPayload } from '@/components/copilot/types';
import type {
  IntelligenceFinding,
  IntelligenceGraphResponse,
  IntelligenceProvider,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import {
  buildIntelligenceHref,
  type IntelligenceView,
} from '@/lib/intelligence/routes';
import {
  formatLastRefreshMessage,
  getAccessBannerState,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { summarizeTrustSignals } from '@/lib/intelligence/trust-signals';
import { GraphWorkbenchPanel } from './graph-workbench-panel';
import { OperationsShell } from './shell';
import {
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

function DashboardMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <OpsCard className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{label}</p>
      <p className="text-3xl font-semibold tabular-nums text-[var(--vt-text-1)]">{value}</p>
      <p className="text-sm text-[var(--vt-text-3)]">{detail}</p>
    </OpsCard>
  );
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
      <span className="uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{label}</span>
      <span className="text-[var(--vt-text-1)]">{value}</span>
    </span>
  );
}

function buildDashboardCopilotContext(input: {
  provider: IntelligenceProvider | null;
  finding: IntelligenceFinding | null;
  storyline: IntelligenceStoryline | null;
  graph: IntelligenceGraphResponse | null;
  graphNodeId: string | null;
  focusedPanel: string;
  recentFindings: IntelligenceFinding[];
}): CopilotContextPayload {
  const evidence = input.finding?.evidence ?? input.storyline?.evidence ?? [];
  const finding = input.finding;
  const storyline = input.storyline;
  const evidenceSignals = evidence.map((item) => ({
    source: item.source,
    observedAt: item.observedAt,
    confidence: 0.8,
    corroborationCount: 1,
  }));
  const evidenceSummaryStats = evidenceSignals.length > 0
    ? summarizeTrustSignals(evidenceSignals)
    : null;
  const graphNodeId = input.graphNodeId ?? input.graph?.focusNodeId ?? null;
  const neighborNodeIds = graphNodeId && input.graph
    ? [...new Set(
        input.graph.edges
          .filter((edge) => edge.source === graphNodeId || edge.target === graphNodeId)
          .flatMap((edge) => [edge.source, edge.target]),
      )].filter((nodeId) => nodeId !== graphNodeId)
    : [];
  const neighborEdgeIds = graphNodeId && input.graph
    ? input.graph.edges
        .filter((edge) => edge.source === graphNodeId || edge.target === graphNodeId)
        .map((edge) => edge.id)
    : [];
  const scope = input.focusedPanel === 'graph' && graphNodeId
    ? 'graph'
    : input.finding
      ? 'finding'
      : input.storyline
        ? 'storyline'
        : input.provider
          ? 'provider'
          : 'global';

  return {
    scope,
    provider: input.provider
      ? {
          npi: input.provider.npi,
          label: input.provider.name,
          specialty: input.provider.specialties[0] ?? null,
          state: null,
          trustScore: input.provider.trustScore,
          trustBand: input.provider.risk.toUpperCase(),
          trustConfidence: null,
          activeFindings: input.recentFindings.filter((finding) => finding.providerNpi === input.provider?.npi).length,
          summary: input.provider.summary,
        }
      : null,
    finding: finding
      ? {
          id: finding.id,
          findingType: finding.findingType,
          title: finding.title,
          severity: finding.severity,
          status: finding.status,
          summary: finding.summary,
          explanation: finding.explanation,
          confidence: finding.confidence,
          priorityScore: finding.priorityScore,
          evidence: finding.evidence.map((item) => ({
            source: item.source ?? 'Source unavailable',
            claim: item.snippet ?? item.label,
            confidence: 0.8,
            observedAt: item.observedAt,
            field: item.label,
            provenanceChain: [item.source ?? 'Unknown source', finding.title],
          })),
          storylineId: finding.storylineId,
          storylineTitle: finding.storylineTitle,
          providerNpi: finding.providerNpi,
          npis: finding.providerNpi ? [finding.providerNpi] : [],
        }
      : null,
    storyline: storyline
      ? {
          id: storyline.id,
          title: storyline.title,
          storylineType: storyline.storylineType,
          severity: storyline.severity,
          status: storyline.status,
          narrative: storyline.summary,
          summary: storyline.summary,
          whyItMatters: storyline.whyItMatters,
          confidence: storyline.confidence,
          findingCount: storyline.findingIds.length,
          entityCount: undefined,
          progressionScore: storyline.progressionScore,
          evidence: storyline.evidence.map((item) => ({
            source: item.source ?? 'Source unavailable',
            claim: item.snippet ?? item.label,
            confidence: 0.75,
            observedAt: item.observedAt,
            field: item.label,
            provenanceChain: [item.source ?? 'Unknown source', storyline.title],
          })),
          providerNpi: storyline.providerNpi,
          recommendedActions: storyline.recommendedActions,
          lastActivityAt: storyline.lastActivityAt,
        }
      : null,
    graph: {
      focusNodeId: input.graph?.focusNodeId ?? null,
      selectedNodeId: graphNodeId,
      neighborNodeIds,
      neighborEdgeIds,
    },
    recentFindings: input.recentFindings.slice(0, 5).map((finding) => ({
      id: finding.id,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity,
      priorityScore: finding.priorityScore,
      href: `/findings/${finding.id}`,
    })),
    evidenceSummary: evidence.slice(0, 4).map((item) => ({
      label: item.label,
      detail: item.snippet ?? item.label,
      source: item.source ?? 'Unknown source',
      observedAt: item.observedAt,
    })),
    evidenceSummaryStats,
    riskSummary: input.provider
      ? {
          trustScore: input.provider.trustScore,
          trustBand: input.provider.risk.toUpperCase(),
          summary: input.provider.summary,
          trustConfidence: null,
        }
      : null,
  };
}

function WorkbenchCopilotPanel({
  provider,
  finding,
  storyline,
  onNavigateToNpi,
  onSelectFinding,
  onSelectStoryline,
  onFocusGraphNode,
  onHighlightGraphNode,
  onOpenEvidence,
  context,
}: {
  provider: IntelligenceProvider | null;
  finding: IntelligenceFinding | null;
  storyline: IntelligenceStoryline | null;
  onNavigateToNpi: (npi: string) => void;
  onSelectFinding: (findingId: string) => void;
  onSelectStoryline: (storylineId: string) => void;
  onFocusGraphNode: (nodeId: string) => void;
  onHighlightGraphNode: (nodeId: string) => void;
  onOpenEvidence: (findingId: string, evidenceIndex: number | null) => void;
  context: CopilotContextPayload;
}) {
  const contextLabel = [
    provider ? `${provider.name} (${provider.npi})` : 'global scope',
    finding ? `finding ${finding.id}` : null,
    storyline ? `storyline ${storyline.id}` : null,
  ].filter(Boolean).join(' · ');

  const placeholder = provider
    ? `Ask Copilot about ${provider.name}${finding ? `, finding ${finding.id}` : ''}${storyline ? `, and storyline ${storyline.id}` : ''}…`
    : 'Ask Copilot about provider readiness, graph anomalies, or open findings…';

  return (
    <OpsCard className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Copilot</p>
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Context-aware operator assist</h2>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-300">
            {provider ? 'Scoped' : 'Global'}
          </span>
        </div>
        <p className="text-sm text-[var(--vt-text-2)]">
          The prompt input stays tied to the current workbench selection so responses can be read against the same provider, finding, and storyline context.
        </p>
      </div>

      <p className="text-sm text-[var(--vt-text-2)]">{contextLabel}</p>

      <CopilotSearchBar
        compact={false}
        sessionId={provider ? `workbench:${provider.npi}` : 'workbench:global'}
        context={context}
        placeholder={placeholder}
        onNavigateToNpi={onNavigateToNpi}
        onSelectFinding={onSelectFinding}
        onSelectStoryline={onSelectStoryline}
        onFocusGraphNode={onFocusGraphNode}
        onHighlightGraphNode={onHighlightGraphNode}
        onOpenEvidence={onOpenEvidence}
      />
    </OpsCard>
  );
}

const DASHBOARD_VIEWS: Array<{ view: IntelligenceView; label: string }> = [
  { view: 'findings', label: 'Findings' },
  { view: 'storylines', label: 'Storylines' },
  { view: 'providers', label: 'Providers' },
  { view: 'actions', label: 'Actions' },
  { view: 'investigations', label: 'Investigations' },
];

export function DashboardSurface() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const graphPanelRef = useRef<HTMLDivElement | null>(null);

  const searchQuery = searchParams.get('q') ?? '';
  const selectedNpi = searchParams.get('npi') ?? '';
  const selectedFindingId = searchParams.get('findingId') ?? '';
  const selectedStorylineId = searchParams.get('storylineId') ?? '';
  const focusedPanel = searchParams.get('panel') ?? '';

  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const [copilotFocusNodeId, setCopilotFocusNodeId] = useState<string | null>(null);
  const [copilotHighlightNodeId, setCopilotHighlightNodeId] = useState<string | null>(null);

  useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (focusedPanel === 'graph') {
      graphPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusedPanel]);

  const providers = useProviders({
    query: searchQuery,
    limit: 8,
  });

  const selectedProvider = useMemo(() => {
    const items = providers.data?.providers ?? [];
    if (/^\d{10}$/.test(selectedNpi)) {
      return items.find((provider) => provider.npi === selectedNpi) ?? null;
    }
    return items[0] ?? null;
  }, [providers.data?.providers, selectedNpi]);

  const providerScope = /^\d{10}$/.test(selectedNpi) ? selectedNpi : selectedProvider?.npi ?? null;

  useEffect(() => {
    setCopilotFocusNodeId(null);
    setCopilotHighlightNodeId(null);
  }, [providerScope]);

  const findings = useFindings({
    provider: providerScope,
    limit: 6,
  });
  const storylines = useStorylines({
    provider: providerScope,
    limit: 4,
  });
  const actions = useActions({
    entity: providerScope,
    limit: 5,
  });
  const systemHealth = useSystemHealth();
  const graph = useGraph({
    npi: providerScope,
    layer: 'blended',
    limit: 40,
  });

  const selectedFinding = useMemo(() => {
    const items = findings.data?.findings ?? [];
    if (selectedFindingId) {
      return items.find((item) => item.id === selectedFindingId) ?? null;
    }
    return items[0] ?? null;
  }, [findings.data?.findings, selectedFindingId]);

  const selectedStoryline = useMemo(() => {
    const items = storylines.data?.storylines ?? [];
    if (selectedStorylineId) {
      return items.find((item) => item.id === selectedStorylineId) ?? null;
    }
    if (selectedFinding?.storylineId) {
      return items.find((item) => item.id === selectedFinding.storylineId) ?? null;
    }
    return items[0] ?? null;
  }, [selectedFinding?.storylineId, selectedStorylineId, storylines.data?.storylines]);

  const currentHref = useMemo(() => {
    const serialized = searchParams.toString();
    return `${pathname}${serialized ? `?${serialized}` : ''}`;
  }, [pathname, searchParams]);

  const openFullGraphHref = useMemo(() => {
    const params = new URLSearchParams();

    if (providerScope) {
      params.set('npi', providerScope);
      params.set('providerId', providerScope);
    }

    if (selectedFinding?.id) {
      params.set('findingId', selectedFinding.id);
    }

    if (selectedStoryline?.id) {
      params.set('storylineId', selectedStoryline.id);
    }

    const serialized = params.toString();
    return serialized.length > 0 ? `/graph?${serialized}` : '/graph';
  }, [providerScope, selectedFinding?.id, selectedStoryline?.id]);

  const staleState = getSurfaceFreshnessState({
    generatedAt: providers.data?.generatedAt ?? findings.data?.generatedAt ?? storylines.data?.generatedAt ?? actions.data?.generatedAt,
    lastUpdated: providers.lastUpdated ?? findings.lastUpdated ?? storylines.lastUpdated ?? actions.lastUpdated,
  });
  const findingsUnavailable = Boolean(findings.error && !findings.data);
  const storylinesUnavailable = Boolean(storylines.error && !storylines.data);
  const actionsUnavailable = Boolean(actions.error && !actions.data);
  const accessBanner = useMemo(() => {
    const candidates = [
      providers.data,
      findings.data,
      storylines.data,
      graph.data,
      actions.data,
      systemHealth.data,
    ];

    for (const candidate of candidates) {
      const banner = getAccessBannerState(candidate?.accessMode, candidate?.reason);
      if (banner) {
        return banner;
      }
    }

    return null;
  }, [
    actions.data,
    findings.data,
    graph.data,
    providers.data,
    storylines.data,
    systemHealth.data,
  ]);
  const copilotContext = useMemo(() => buildDashboardCopilotContext({
    provider: selectedProvider,
    finding: selectedFinding,
    storyline: selectedStoryline,
    graph: graph.data ?? null,
    graphNodeId: copilotFocusNodeId ?? copilotHighlightNodeId,
    focusedPanel,
    recentFindings: findings.data?.findings ?? [],
  }), [
    selectedProvider,
    selectedFinding,
    selectedStoryline,
    graph.data,
    copilotFocusNodeId,
    copilotHighlightNodeId,
    focusedPanel,
    findings.data?.findings,
  ]);

  function pushDashboard(updater: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('view', 'dashboard');
    updater(nextParams);

    startTransition(() => {
      router.push(`/intelligence?${nextParams.toString()}`);
    });
  }

  function refreshAll() {
    providers.refresh();
    findings.refresh();
    storylines.refresh();
    actions.refresh();
    systemHealth.refresh();
    graph.refresh();
  }

  function setProviderScope(npi: string) {
    pushDashboard((params) => {
      params.set('npi', npi);
      params.delete('findingId');
      params.delete('storylineId');
      params.delete('panel');
    });
  }

  function setFindingScope(finding: IntelligenceFinding) {
    pushDashboard((params) => {
      if (finding.providerNpi) {
        params.set('npi', finding.providerNpi);
      }
      params.set('findingId', finding.id);
      if (finding.storylineId) {
        params.set('storylineId', finding.storylineId);
      }
    });
  }

  function setStorylineScope(storyline: IntelligenceStoryline) {
    pushDashboard((params) => {
      if (storyline.providerNpi) {
        params.set('npi', storyline.providerNpi);
      }
      params.set('storylineId', storyline.id);
    });
  }

  function selectFindingById(findingId: string) {
    const finding = (findings.data?.findings ?? []).find((entry) => entry.id === findingId);
    if (finding) {
      setFindingScope(finding);
      return;
    }

    pushDashboard((params) => {
      params.set('findingId', findingId);
      params.set('panel', 'graph');
    });
  }

  function selectStorylineById(storylineId: string) {
    const storyline = (storylines.data?.storylines ?? []).find((entry) => entry.id === storylineId);
    if (storyline) {
      setStorylineScope(storyline);
      return;
    }

    pushDashboard((params) => {
      params.set('storylineId', storylineId);
      params.set('panel', 'graph');
    });
  }

  function openEvidenceForFinding(findingId: string, _evidenceIndex: number | null) {
    const finding = (findings.data?.findings ?? []).find((entry) => entry.id === findingId);
    const npi = finding?.providerNpi ?? selectedProvider?.npi ?? providerScope;

    startTransition(() => {
      router.push(buildIntelligenceHref('investigations', {
        npi: npi ?? undefined,
        findingId,
      }));
    });
  }

  return (
    <OperationsShell
      activeHref="/intelligence"
      activeNavKey="dashboard"
      title="Operator Workbench"
      description="Canonical intelligence surface for provider posture, live findings, storylines, action queue state, graph context, and Copilot guidance."
      breadcrumbs={[{ label: 'Dashboard' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Workbench state</p>
          <p>{providers.data?.total ?? 0} providers in scope</p>
          {providers.lastUpdated ? (
            <p title={formatAbsoluteTime(providers.lastUpdated)}>
              Updated {formatRelativeTime(providers.lastUpdated)}
            </p>
          ) : null}
        </div>
      )}
      actions={(
        <>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh all
          </button>
          <Link
            href={buildIntelligenceHref('investigations', providerScope ? { npi: providerScope } : undefined)}
            className="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--vt-accent)]"
          >
            Open investigations
          </Link>
        </>
      )}
      banner={(
        <>
          {accessBanner ? (
            <SurfaceBanner tone={accessBanner.tone}>
              {accessBanner.description}
            </SurfaceBanner>
          ) : null}
          {(providers.recovering || findings.recovering || storylines.recovering || actions.recovering) ? (
            <SurfaceBanner tone="warning">
              One or more dashboard feeds are serving the last successful snapshot while live refresh recovers.
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
      <OpsCard className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <form
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              pushDashboard((params) => {
                const trimmed = draftQuery.trim();
                if (trimmed.length > 0) {
                  params.set('q', trimmed);
                } else {
                  params.delete('q');
                }
                params.delete('npi');
                params.delete('findingId');
                params.delete('storylineId');
                params.delete('panel');
              });
            }}
          >
            <label className="space-y-1 text-sm">
              <span className="text-[var(--vt-text-3)]">Provider or issuer search</span>
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                <Search className="h-4 w-4 text-[var(--vt-text-3)]" />
                <input
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  placeholder="Name, NPI, specialty, issuer"
                  className="w-full bg-transparent text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
                />
              </div>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="submit"
                className="rounded-sm bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[var(--vt-accent)]"
              >
                Apply scope
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftQuery('');
                  pushDashboard((params) => {
                    params.delete('q');
                    params.delete('npi');
                    params.delete('findingId');
                    params.delete('storylineId');
                    params.delete('panel');
                  });
                }}
                className="rounded-sm border border-[var(--vt-border)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
              >
                Clear
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {DASHBOARD_VIEWS.map((item) => (
              <Link
                key={item.view}
                href={buildIntelligenceHref(item.view, providerScope ? { npi: providerScope } : undefined)}
                className="inline-flex items-center rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-2 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
              >
                {item.label}
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedProvider ? <ContextChip label="Provider" value={`${selectedProvider.name} · ${selectedProvider.npi}`} /> : null}
          {selectedFinding ? <ContextChip label="Finding" value={selectedFinding.title} /> : null}
          {selectedStoryline ? <ContextChip label="Storyline" value={selectedStoryline.title} /> : null}
          {!selectedProvider && !selectedFinding && !selectedStoryline ? (
            <ContextChip label="Scope" value="Global operator dashboard" />
          ) : null}
        </div>
      </OpsCard>

      {(providers.error && !providers.data) ? (
        <SurfaceErrorState
          title="Workbench unavailable"
          description={providers.error}
          onRetry={providers.refresh}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label="Providers"
          value={String(providers.data?.total ?? 0)}
          detail={searchQuery ? `Filtered by "${searchQuery}"` : 'Current launch-scoped directory'}
        />
        <DashboardMetricCard
          label="Findings"
          value={findingsUnavailable ? 'ERR' : String(findings.data?.total ?? 0)}
          detail={findingsUnavailable ? findings.error ?? 'Feed unavailable' : providerScope ? `Active for NPI ${providerScope}` : 'Current operator feed'}
        />
        <DashboardMetricCard
          label="Storylines"
          value={storylinesUnavailable ? 'ERR' : String(storylines.data?.total ?? 0)}
          detail={storylinesUnavailable ? storylines.error ?? 'Feed unavailable' : providerScope ? 'Scoped narrative clusters' : 'Live clustering window'}
        />
        <DashboardMetricCard
          label="Actions"
          value={actionsUnavailable ? 'ERR' : String(actions.data?.total ?? 0)}
          detail={actionsUnavailable ? actions.error ?? 'Feed unavailable' : providerScope ? 'Recommended follow-up queue' : 'System-wide queue state'}
        />
        <DashboardMetricCard
          label="Health"
          value={systemHealth.data?.overall?.toUpperCase() ?? 'PENDING'}
          detail={systemHealth.data?.headline ?? 'Waiting for telemetry'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Provider focus</p>
                <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">
                  {selectedProvider ? selectedProvider.name : 'Select a provider'}
                </h2>
              </div>
              {selectedProvider ? (
                <span className={`text-3xl font-semibold tabular-nums ${trustScoreColor(selectedProvider.trustScore)}`}>
                  {selectedProvider.trustScore}
                </span>
              ) : null}
            </div>

            {selectedProvider ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <OpsBadge label={selectedProvider.credentialHealth} tone="info" />
                  <OpsBadge label={selectedProvider.risk} tone="info" />
                  <span className="font-mono text-sm text-[var(--vt-text-3)]">NPI {selectedProvider.npi}</span>
                </div>
                <p className="text-sm text-[var(--vt-text-2)]">{selectedProvider.summary}</p>
                <div className="flex flex-wrap gap-2">
                  <EntityLink href={`/providers/${selectedProvider.npi}?from=${encodeURIComponent(currentHref)}`} label="Open profile" />
                  <EntityLink href={buildIntelligenceHref('investigations', { npi: selectedProvider.npi })} label="Investigate" />
                  <EntityLink href={buildIntelligenceHref('providers', { q: selectedProvider.npi })} label="Directory view" />
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">Specialties</p>
                    <p className="mt-1 text-sm text-[var(--vt-text-1)]">
                      {selectedProvider.specialties.slice(0, 3).join(', ') || 'Not surfaced'}
                    </p>
                  </div>
                  <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">Credentials</p>
                    <p className="mt-1 text-sm text-[var(--vt-text-1)]">
                      {selectedProvider.activeCredentials}/{selectedProvider.credentialCount} active
                    </p>
                  </div>
                  <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">Verified</p>
                    <div className="mt-1"><TimestampPair label="Last" value={selectedProvider.lastVerifiedAt} /></div>
                  </div>
                </div>
              </>
            ) : (
              <SurfaceEmptyState
                title="No provider is currently selected"
                description="Apply a provider search or choose a provider from the scoped results below to activate graph and Copilot context."
              />
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Scoped providers</h3>
                <Link
                  href={buildIntelligenceHref('providers', searchQuery ? { q: searchQuery } : undefined)}
                  className="text-sm text-cyan-300 transition hover:text-[var(--vt-accent)]"
                >
                  Open full view
                </Link>
              </div>
              {(providers.data?.providers ?? []).length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(providers.data?.providers ?? []).slice(0, 4).map((provider) => {
                    const active = selectedProvider?.npi === provider.npi;
                    return (
                      <button
                        key={provider.npi}
                        type="button"
                        onClick={() => setProviderScope(provider.npi)}
                        className={`rounded-sm border p-3 text-left transition ${
                          active
                            ? 'border-cyan-400/40 bg-cyan-400/5'
                            : 'border-[var(--vt-border)] bg-[var(--vt-surface)] hover:border-[var(--vt-text-3)]/40'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div>
                            <p className="font-semibold text-[var(--vt-text-1)]">{provider.name}</p>
                            <p className="text-xs text-[var(--vt-text-3)]">NPI {provider.npi}</p>
                          </div>
                          <span className={`text-xl font-semibold tabular-nums ${trustScoreColor(provider.trustScore)}`}>
                            {provider.trustScore}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-[var(--vt-text-2)]">{provider.summary}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <SurfaceEmptyState
                  title="No providers match the current scope"
                  description="Broaden the query or clear it to bring providers into the operator workbench."
                />
              )}
            </div>
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Findings</p>
                <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Current signal queue</h2>
              </div>
              <Link
                href={buildIntelligenceHref('findings', providerScope ? { provider: providerScope } : undefined)}
                className="text-sm text-cyan-300 transition hover:text-[var(--vt-accent)]"
              >
                Open full view
              </Link>
            </div>
            {findingsUnavailable ? (
              <SurfaceErrorState
                title="Findings unavailable"
                description={findings.error ?? 'The findings feed did not return data.'}
                onRetry={findings.refresh}
              />
            ) : (findings.data?.findings ?? []).length > 0 ? (
              <div className="space-y-3">
                {(findings.data?.findings ?? []).map((finding) => {
                  const active = selectedFinding?.id === finding.id;
                  return (
                    <div
                      key={finding.id}
                      className={`rounded-3xl border p-4 ${
                        active ? 'border-cyan-400/40 bg-cyan-400/5' : 'border-[var(--vt-border)] bg-[var(--vt-surface)]'
                      }`}
                    >
                      <button type="button" onClick={() => setFindingScope(finding)} className="w-full text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                          <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
                          <span className="text-xs text-[var(--vt-text-3)]">{finding.findingType.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-[var(--vt-text-1)]">{finding.title}</p>
                        <p className="mt-1 text-sm text-[var(--vt-text-2)]">{finding.summary}</p>
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <EntityLink href={`/findings/${finding.id}?from=${encodeURIComponent(currentHref)}`} label="Open detail" />
                        {finding.providerNpi ? (
                          <EntityLink href={buildIntelligenceHref('investigations', { npi: finding.providerNpi })} label="Investigate" />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <SurfaceEmptyState
                title="No findings are active in this scope"
                description="Use the provider directory or broaden the query to inspect a wider signal set."
              />
            )}
          </OpsCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <OpsCard className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Storylines</p>
                  <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Narrative clusters</h2>
                </div>
                <Link
                  href={buildIntelligenceHref('storylines', providerScope ? { provider: providerScope } : undefined)}
                  className="text-sm text-cyan-300 transition hover:text-[var(--vt-accent)]"
                >
                  Open full view
                </Link>
              </div>
              {storylinesUnavailable ? (
                <SurfaceErrorState
                  title="Storylines unavailable"
                  description={storylines.error ?? 'The storyline feed did not return data.'}
                  onRetry={storylines.refresh}
                />
              ) : (storylines.data?.storylines ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(storylines.data?.storylines ?? []).map((storyline) => {
                    const active = selectedStoryline?.id === storyline.id;
                    return (
                      <div
                        key={storyline.id}
                        className={`rounded-3xl border p-4 ${
                          active ? 'border-cyan-400/40 bg-cyan-400/5' : 'border-[var(--vt-border)] bg-[var(--vt-surface)]'
                        }`}
                      >
                        <button type="button" onClick={() => setStorylineScope(storyline)} className="w-full text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
                            <OpsBadge label={storyline.status} tone={severityTone(storyline.status)} />
                          </div>
                          <p className="mt-3 text-base font-semibold text-[var(--vt-text-1)]">{storyline.title}</p>
                          <p className="mt-1 text-sm text-[var(--vt-text-2)]">{storyline.whyItMatters}</p>
                        </button>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <EntityLink href={`/storylines/${storyline.id}?from=${encodeURIComponent(currentHref)}`} label="Open detail" />
                          {storyline.providerNpi ? (
                            <EntityLink href={buildIntelligenceHref('investigations', { npi: storyline.providerNpi })} label="Investigate" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <SurfaceEmptyState
                  title="No storylines are clustered here yet"
                  description="Storylines appear once related findings are synchronized into a narrative cluster."
                />
              )}
            </OpsCard>

            <OpsCard className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Actions</p>
                  <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Follow-up queue</h2>
                </div>
                <Link
                  href={buildIntelligenceHref('actions', providerScope ? { entity: providerScope } : undefined)}
                  className="text-sm text-cyan-300 transition hover:text-[var(--vt-accent)]"
                >
                  Open full view
                </Link>
              </div>
              {actionsUnavailable ? (
                <SurfaceErrorState
                  title="Actions unavailable"
                  description={actions.error ?? 'The action queue did not return data.'}
                  onRetry={actions.refresh}
                />
              ) : (actions.data?.actions ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(actions.data?.actions ?? []).map((action) => (
                    <div key={action.id} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <OpsBadge label={action.priority} tone={severityTone(action.priority)} />
                        <OpsBadge label={action.status} tone={severityTone(action.status)} />
                      </div>
                      <p className="mt-3 text-base font-semibold text-[var(--vt-text-1)]">{action.title}</p>
                      <p className="mt-1 text-sm text-[var(--vt-text-2)]">{action.explanation}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <EntityLink href={`/actions/${action.id}?from=${encodeURIComponent(currentHref)}`} label="Open detail" />
                        {action.providerNpi ? (
                          <EntityLink href={buildIntelligenceHref('investigations', { npi: action.providerNpi })} label="Investigate" />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <SurfaceEmptyState
                  title="No actions are queued"
                  description="The current scope has no recommended action backlog."
                />
              )}
            </OpsCard>
          </div>
        </div>

        <div className="space-y-4">
          <div
            ref={graphPanelRef}
            className={focusedPanel === 'graph' ? 'rounded-[28px] ring-2 ring-cyan-400/40 ring-offset-4 ring-offset-transparent' : undefined}
          >
            <GraphWorkbenchPanel
              graph={graph.data}
              providers={providers.data?.providers ?? []}
              selectedProvider={selectedProvider}
              selectedFindingId={selectedFinding?.id ?? selectedFindingId}
              selectedStorylineId={selectedStoryline?.id ?? selectedStorylineId}
              openFullGraphHref={openFullGraphHref}
              loading={graph.loading}
              error={graph.error}
              onRetry={graph.refresh}
              onSelectProvider={(provider) => setProviderScope(provider.npi)}
              focusNodeId={copilotFocusNodeId}
              highlightNodeId={copilotHighlightNodeId}
              onSelectGraphNode={setCopilotFocusNodeId}
            />
          </div>

          <WorkbenchCopilotPanel
            provider={selectedProvider}
            finding={selectedFinding}
            storyline={selectedStoryline}
            onNavigateToNpi={setProviderScope}
            onSelectFinding={selectFindingById}
            onSelectStoryline={selectStorylineById}
            onFocusGraphNode={(nodeId) => {
              setCopilotFocusNodeId(nodeId);
              pushDashboard((params) => {
                params.set('panel', 'graph');
              });
            }}
            onHighlightGraphNode={(nodeId) => {
              setCopilotHighlightNodeId(nodeId);
              pushDashboard((params) => {
                params.set('panel', 'graph');
              });
            }}
            onOpenEvidence={openEvidenceForFinding}
            context={copilotContext}
          />
        </div>
      </div>
    </OperationsShell>
  );
}
