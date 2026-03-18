'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import { CommandPalette } from '@/components/command/command-palette';
import { CopilotSearchBar } from '@/components/copilot/CopilotSearchBar';
import { LiveFeedRibbon } from '@/components/intelligence/LiveFeedRibbon';
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
    provider ? `TARGET: ${provider.name} (${provider.npi})` : null,
    finding ? `FINDING: ${finding.id}` : null,
    storyline ? `STORYLINE: ${storyline.id}` : null,
  ].filter(Boolean).join(' · ');

  const placeholder = provider
    ? `Ask Copilot about ${provider.name}...`
    : 'Ask Copilot about provider readiness, graph anomalies, or open findings...';

  return (
    <div className="space-y-4 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--vt-text-3)] mb-0.5">Copilot</p>
          <h2 className="text-sm font-medium text-[var(--vt-text-1)]">Analyst Assistant</h2>
        </div>
        <span className="rounded-[2px] border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase text-[var(--vt-text-2)]">
          {provider ? 'TARGET LOCKED' : 'GLOBAL CONTEXT'}
        </span>
      </div>

      {contextLabel && (
        <div className="border-l-2 border-[var(--vt-border)] pl-2">
          <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--vt-text-3)] truncate leading-relaxed">
            {contextLabel}
          </p>
        </div>
      )}

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
    </div>
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

  // ── Keyboard navigation (j/k = prev/next finding, Enter = open, Esc = clear) ─
  const findingsList = findings.data?.findings ?? [];
  const selectedFindingIndex = useMemo(
    () => findingsList.findIndex((f) => f.id === selectedFinding?.id),
    [findingsList, selectedFinding?.id],
  );

  const navigateFinding = useCallback((delta: number) => {
    const next = Math.max(0, Math.min(findingsList.length - 1, selectedFindingIndex + delta));
    const nextFinding = findingsList[next];
    if (nextFinding) setFindingScope(nextFinding);
  }, [findingsList, selectedFindingIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'j') { e.preventDefault(); navigateFinding(1); }
      if (e.key === 'k') { e.preventDefault(); navigateFinding(-1); }
      if (e.key === 'Escape') {
        pushDashboard((p) => { p.delete('npi'); p.delete('findingId'); p.delete('storylineId'); });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateFinding, pushDashboard]);

  return (
    <>
    <CommandPalette />
    <div className="flex flex-col h-screen min-h-0 w-full overflow-hidden bg-[var(--vt-bg)] text-[var(--vt-text-1)] font-sans">
      {/* ZONE A — SIGNAL HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-5">
        <div className="flex items-center gap-6 overflow-hidden">
          <LiveFeedRibbon />
        </div>
        <div className="flex items-center gap-5">
          <form
            className="flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2 py-1 transition-colors focus-within:border-[var(--vt-text-3)]"
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
            <Search className="h-3.5 w-3.5 text-[var(--vt-text-3)]" />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search scope..."
              className="w-48 bg-transparent text-xs text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
            />
          </form>

          <div className="h-4 w-px bg-[var(--vt-border)]"></div>

          <span className="text-[10px] text-[var(--vt-text-3)] uppercase tracking-widest">
            Last seen {providers.lastUpdated ? formatRelativeTime(providers.lastUpdated) : '...'}
          </span>
          <button 
            type="button" 
            onClick={refreshAll}
            className="flex items-center justify-center rounded-sm text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ZONE B & C AREA */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* ZONE B — PRIMARY WORK AREA */}
        <section className="flex flex-1 flex-col overflow-y-auto border-r border-[var(--vt-border)] bg-[var(--vt-surface-dim)]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)]/95 px-5 py-3 backdrop-blur-sm">
            <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-1)]">Signal Queue</h1>
            <div className="flex items-center gap-1 rounded-sm border border-[var(--vt-border)] p-0.5 bg-[var(--vt-surface-dim)]">
              <button className="rounded-[2px] bg-[var(--vt-surface-2)] px-3 py-1 text-[9px] font-semibold tracking-widest uppercase text-[var(--vt-text-1)] shadow-sm">Ranked</button>
              <button className="rounded-[2px] px-3 py-1 text-[9px] font-semibold tracking-widest uppercase text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">Latest</button>
              <button className="rounded-[2px] px-3 py-1 text-[9px] font-semibold tracking-widest uppercase text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">Critical Only</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 px-5 py-6 border-b border-[var(--vt-border)] bg-[var(--vt-surface)]">
            <div>
              <p className="text-4xl tracking-tighter font-light text-[var(--vt-text-1)]">{findings.data?.total ?? 0}</p>
              <p className="text-[10px] mt-1 uppercase font-mono tracking-widest text-[var(--vt-text-3)]">Findings</p>
            </div>
            <div>
              <p className="text-4xl tracking-tighter font-light text-[var(--vt-text-1)]">{providers.data?.total ?? 0}</p>
              <p className="text-[10px] mt-1 uppercase font-mono tracking-widest text-[var(--vt-text-3)]">Providers</p>
            </div>
            <div>
              <p className="text-4xl tracking-tighter font-light text-[var(--vt-text-1)]">{findings.data?.findings.filter(f => f.severity.toLowerCase() === 'critical').length ?? 0}</p>
              <p className="text-[10px] mt-1 uppercase font-mono tracking-widest text-[var(--vt-text-3)]">Active Risk</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {/* Findings List */}
            <div className="flex flex-col gap-2 relative">
              {findingsUnavailable ? (
                <SurfaceErrorState
                  title="Signals unavailable"
                  description={findings.error ?? 'Signal queue failed to load'}
                  onRetry={findings.refresh}
                />
              ) : (findings.data?.findings ?? []).length > 0 ? (
                (findings.data?.findings ?? []).map((finding) => {
                  const active = selectedFinding?.id === finding.id;
                  
                  // Noise reduction: monochrome palette
                  let typeColorClass = "border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)]";
                  
                  const activeSelectionExists = selectedFindingId !== '';
                  
                  return (
                    <button
                      key={finding.id}
                      type="button"
                      onClick={() => setFindingScope(finding)}
                      className={`group relative w-full flex-col overflow-hidden rounded-sm border bg-[var(--vt-surface)] text-left transition-all duration-300 ease-out 
                      ${active ? 'border-[var(--vt-text-2)] shadow-md ring-1 ring-inset ring-[var(--vt-border)] scale-[1.01] bg-[var(--vt-surface-2)]' 
                               : activeSelectionExists 
                                 ? 'border-[var(--vt-border)]/40 opacity-40 hover:opacity-100 hover:border-[var(--vt-text-3)]'
                                 : 'border-[var(--vt-border)] hover:border-[var(--vt-text-3)] hover:shadow-sm hover:translate-y-[-1px]'
                      }`}
                    >
                      <div className="flex h-full">
                        <div className={`w-[2px] shrink-0 transition-opacity bg-[var(--vt-text-3)] ${active ? 'opacity-100' : 'opacity-30'}`} />
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                               <div className="flex items-center gap-2 mb-1.5 opacity-80">
                                 <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-2)]">
                                   {finding.providerNpi ? `Provider NPI ${finding.providerNpi}` : 'Global Signal'}
                                 </p>
                                 <span className="h-1 w-1 rounded-full bg-[var(--vt-border)]" />
                                 <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-3)]">
                                   SEVERITY: {finding.severity}
                                 </p>
                               </div>
                               <p className={`text-sm font-medium leading-snug ${active ? 'text-[var(--vt-text-1)]' : 'text-[var(--vt-text-1)]'}`}>
                                 {finding.title || finding.summary}
                               </p>
                               {finding.explanation && (
                                 <p className="mt-1.5 text-xs text-[var(--vt-text-2)] line-clamp-2 leading-relaxed">
                                   {finding.explanation}
                                 </p>
                               )}
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`rounded-[2px] border px-2 py-0.5 text-[10px] uppercase tracking-widest ${typeColorClass}`}>
                                  {finding.findingType.replace(/_/g, ' ')}
                                </span>
                                <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-1)] opacity-0 transition-all duration-300 group-hover:opacity-100 flex items-center gap-1">
                                  Investigate <ArrowUpRight className="w-3 h-3 inline" />
                                </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center justify-between border-t border-[var(--vt-border)] pt-3 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                             <div className="flex items-center gap-3 pl-0.5">
                               <div className="flex items-center gap-2">
                                 <div className="h-1 w-12 overflow-hidden bg-[var(--vt-surface-2)] rounded-full">
                                   <div className={`h-full transition-all duration-500 ease-out ${active ? 'bg-[var(--vt-text-1)] shadow-[0_0_8px_var(--vt-text-1)]' : 'bg-[var(--vt-text-3)] group-hover:bg-[var(--vt-text-2)]'}`} style={{ width: `${Math.round(finding.confidence * 100)}%` }} />
                                 </div>
                                 <span className="text-[10px] font-mono tracking-widest text-[var(--vt-text-3)]">CONF {Math.round(finding.confidence * 100)}%</span>
                               </div>
                               {(finding.evidence?.length ?? 0) > 0 && (
                                 <>
                                   <div className="w-px h-3 bg-[var(--vt-text-3)] opacity-30" />
                                   <span className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">
                                      {finding.evidence.length} Evidence {finding.evidence.length === 1 ? 'Item' : 'Items'}
                                   </span>
                                 </>
                               )}
                             </div>
                             <div className="flex items-center gap-3">
                               {finding.storylineTitle && (
                                 <span className="rounded-[2px] border border-[var(--vt-border)]/50 bg-[var(--vt-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--vt-text-2)]">
                                   {finding.storylineTitle}
                                 </span>
                               )}
                               <span className="text-[10px] font-mono tracking-widest text-[var(--vt-text-3)] flex items-center gap-1.5">
                                 <div className={`w-1.5 h-1.5 rounded-full ${finding.updatedAt > new Date(Date.now() - 3600000).toISOString() ? 'bg-[var(--vt-text-2)] animate-pulse' : 'bg-[var(--vt-border)]'}`} />
                                 {formatRelativeTime(finding.updatedAt)}
                               </span>
                             </div>
                          </div>
                        </div>
                      </div>
                      {active && <div className="absolute inset-0 pointer-events-none rounded-sm bg-[var(--vt-text-1)]/5 ring-1 ring-inset ring-[var(--vt-border)]" />}
                    </button>
                  );
                })
              ) : (
                /* Always show skeleton rows — never an empty canvas */
                <div className="flex flex-col gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="flex overflow-hidden rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="w-[3px] shrink-0 bg-[var(--vt-border)]" />
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-20 rounded bg-[var(--vt-surface-2)]" />
                          <div className="h-3 w-14 rounded bg-[var(--vt-surface-2)]" />
                        </div>
                        <div className="h-4 w-3/4 rounded bg-[var(--vt-surface-2)]" />
                        <div className="h-3 w-full rounded bg-[var(--vt-surface-2)]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Graph Preview */}
            <div className="hidden lg:block">
              <div className="sticky top-0 h-[calc(100vh-8rem)] w-full relative rounded-sm border border-[var(--vt-border)] bg-black shadow-inner overflow-hidden">
                <div className="absolute left-3 top-3 z-10 pointer-events-none flex flex-col gap-1.5">
                   <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-1)] mix-blend-difference">Network Context</p>
                   {graph.data && (
                     <p className="text-[9px] font-mono tracking-widest text-[var(--vt-info)] mix-blend-difference opacity-80">
                       {graph.data.nodes.length} NODES · {graph.data.edges.length} EDGES
                     </p>
                   )}
                </div>
                <div className="absolute top-3 right-3 z-10 pointer-events-none">
                  <span className="flex items-center gap-1.5 rounded-[2px] bg-black/40 px-2 py-1 text-[9px] uppercase tracking-widest text-[var(--vt-success)] backdrop-blur-md border border-[var(--vt-success)]/20 shadow-sm">
                    <div className="h-1 w-1 rounded-full bg-[var(--vt-success)] animate-pulse" />
                    LIVE TRACE
                  </span>
                </div>
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
                  highlightNodeIds={useMemo(() => {
                    if (!findings.data?.findings || !graph.data?.nodes) return [];
                    const npis = new Set(findings.data.findings.map(f => f.providerNpi).filter(Boolean));
                    return graph.data.nodes.filter(n => npis.has(n.id) || npis.has(n.metadata?.npi as string)).map(n => n.id);
                  }, [findings.data?.findings, graph.data?.nodes])}
                  onSelectGraphNode={setCopilotFocusNodeId}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ZONE C — CONTEXT / ACTION RAIL */}
        <aside className="no-scrollbar z-20 flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-[var(--vt-border)] bg-[var(--vt-surface-dim)]">
          <div className="flex flex-col gap-6 p-5">
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

            {selectedProvider && (
              <div className="space-y-4 pt-5 border-t border-[var(--vt-border)]/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-1 bg-[var(--vt-text-3)] rounded-full" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-2)]">Profile Context</p>
                  </div>
                  <span className={`text-sm font-mono tracking-widest ${trustScoreColor(selectedProvider.trustScore)}`}>
                    TRUST {selectedProvider.trustScore}
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-[15px] font-medium text-[var(--vt-text-1)]">{selectedProvider.name}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)] font-mono">NPI {selectedProvider.npi}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--vt-text-2)] line-clamp-4">{selectedProvider.summary}</p>
                
                <div className="flex flex-col gap-1.5 pt-2">
                  <EntityLink href={`/providers/${selectedProvider.npi}?from=${encodeURIComponent(currentHref)}`} label="View Complete Profile" />
                  <EntityLink href={buildIntelligenceHref('investigations', { npi: selectedProvider.npi })} label="Launch Specific Investigation" />
                </div>
              </div>
            )}
            
            {selectedStoryline && (
              <div className="space-y-4 pt-5 border-t border-[var(--vt-border)]/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-1 bg-[var(--vt-text-3)] rounded-full" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-2)]">Active Cluster</p>
                  </div>
                </div>
                <h3 className="text-[15px] font-medium text-[var(--vt-text-1)]">{selectedStoryline.title}</h3>
                <p className="text-[13px] leading-relaxed text-[var(--vt-text-2)] line-clamp-4">{selectedStoryline.whyItMatters}</p>
                <div className="flex flex-col gap-1.5 pt-2">
                  <EntityLink href={`/storylines/${selectedStoryline.id}?from=${encodeURIComponent(currentHref)}`} label="Expand Storyline" />
                </div>
              </div>
            )}

            {!selectedProvider && !selectedStoryline && (
              <div className="space-y-3 animate-pulse">
                <div className="h-3 w-24 rounded bg-[var(--vt-surface-2)]" />
                <div className="h-4 w-40 rounded bg-[var(--vt-surface-2)]" />
                <div className="h-3 w-full rounded bg-[var(--vt-surface-2)]" />
                <div className="h-3 w-5/6 rounded bg-[var(--vt-surface-2)]" />
                <div className="h-3 w-3/4 rounded bg-[var(--vt-surface-2)]" />
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
    </>
  );
}
