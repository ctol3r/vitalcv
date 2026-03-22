'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Command,
  GitBranch,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CommandPalette } from '@/components/command/command-palette';
import { Tooltip } from '@/components/ui/lab/Tooltip';
import { CopilotSearchBar } from '@/components/copilot/CopilotSearchBar';
import type { CopilotContextPayload } from '@/components/copilot/types';
import { LiveFeedRibbon } from '@/components/intelligence/LiveFeedRibbon';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type {
  IntelligenceFinding,
  IntelligenceGraphResponse,
  IntelligenceProvider,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import {
  findGraphNodeIdForProvider,
} from '@/lib/intelligence/contracts';
import {
  CANVAS_OPEN_PANEL_VALUES,
  buildCanvasOpenPanelParams,
  mergeCanvasOpenPanels,
  parseCanvasOpenPanels,
  parseCompareSelection,
  removeCanvasOpenPanel,
  serializeCompareSelection,
  toggleCompareSelection,
  type CanvasOpenPanel,
} from '@/lib/intelligence/canvas';
import {
  buildIntelligenceGraphHref,
  buildIntelligenceHref,
  resolveIntelligenceView,
  type IntelligenceView,
} from '@/lib/intelligence/routes';
import {
  formatLastRefreshMessage,
  getAccessBannerState,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { summarizeTrustSignals } from '@/lib/intelligence/trust-signals';
import {
  buildIntelligenceWorkspacePayload,
  resolveGraphFocusNodeId,
  resolveWorkspaceSelectionFromGraphNode,
} from '@/lib/intelligence/workspace-model';
import { CanvasDecisionBlock, type CanvasDecisionAction, type CanvasDecisionBacklink, type CanvasDecisionMetric } from './canvas-decision-block';
import { GraphWorkbenchPanel } from './graph-workbench-panel';
import { LaunchReadinessPanel } from './launch-readiness-panel';
import {
  EntityLink,
  OpsBadge,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  severityTone,
  trustScoreColor,
} from './primitives';

type CanvasSectionKind = 'findings' | 'storylines' | 'providers';

interface CompareResponse {
  comparison?: {
    ranking?: Array<{ npi: string; score: number; band: string }>;
    commonGaps?: string[];
    strengthDelta?: Array<{ dimension: string; spread: number; leader: string }>;
  };
  recommendations?: string[];
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
  const normalizedFinding = input.finding
    ? (() => {
        const finding = input.finding;
        return {
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
        };
      })()
    : null;
  const normalizedStoryline = input.storyline
    ? (() => {
        const storyline = input.storyline;
        return {
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
        };
      })()
    : null;
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
    finding: normalizedFinding,
    storyline: normalizedStoryline,
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
    <div className="space-y-4 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[10px] uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Copilot</p>
          <h2 className="text-sm font-medium text-[var(--vt-text-1)]">Analyst Assistant</h2>
        </div>
        <span className="rounded-[2px] border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase text-[var(--vt-text-2)]">
          {provider ? 'TARGET LOCKED' : 'GLOBAL CONTEXT'}
        </span>
      </div>

      {contextLabel ? (
        <div className="border-l-2 border-[var(--vt-border)] pl-2">
          <p className="truncate text-[9px] font-mono uppercase tracking-widest leading-relaxed text-[var(--vt-text-3)]">
            {contextLabel}
          </p>
        </div>
      ) : null}

      <CopilotSearchBar
        compact={false}
        sessionId={provider ? `canvas:${provider.npi}` : 'canvas:global'}
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

function SignalSection({
  title,
  detail,
  count,
  children,
}: {
  title: string;
  detail: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--vt-text-2)]">{detail}</p>
        </div>
        <span className="text-sm font-semibold text-[var(--vt-text-1)]">{count}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function CompareModePanel({
  providers,
  payload,
  loading,
  error,
  onFocusProvider,
  onRemoveProvider,
  onClose,
}: {
  providers: IntelligenceProvider[];
  payload: CompareResponse | null;
  loading: boolean;
  error: string | null;
  onFocusProvider: (npi: string) => void;
  onRemoveProvider: (npi: string) => void;
  onClose: () => void;
}) {
  const ranking = payload?.comparison?.ranking ?? [];
  const commonGaps = payload?.comparison?.commonGaps ?? [];
  const strengthDelta = payload?.comparison?.strengthDelta ?? [];
  const rankedProviders = [...providers].sort((left, right) => (
    (ranking.find((entry) => entry.npi === right.npi)?.score ?? right.trustScore)
    - (ranking.find((entry) => entry.npi === left.npi)?.score ?? left.trustScore)
  ));

  return (
    <CanvasDecisionBlock
      eyebrow="Compare Mode"
      title={providers.length > 1 ? `${providers.length} providers in play` : 'Compare providers'}
      summary={providers.length > 1
        ? 'Use compare mode to hold multiple provider profiles against the same graph and decision context.'
        : 'Pick providers from the queue or use the command palette to enter compare mode.'}
      badgeLabel={providers.length > 1 ? 'live' : 'waiting'}
      badgeTone={providers.length > 1 ? 'success' : 'info'}
      recommendations={payload?.recommendations ?? []}
      secondaryActions={[
        {
          label: 'Close compare',
          onClick: onClose,
          tone: 'neutral',
        },
      ]}
      onClose={onClose}
    >
      {providers.length > 0 ? (
        <div className="grid gap-2">
          {rankedProviders.map((provider) => {
            const rank = ranking.find((entry) => entry.npi === provider.npi) ?? null;
            return (
              <div
                key={provider.npi}
                className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--vt-text-1)]">{provider.name}</p>
                    <p className="mt-1 text-xs text-[var(--vt-text-3)]">
                      NPI {provider.npi} · {provider.specialties[0] ?? 'Provider'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveProvider(provider.npi)}
                    className="rounded-full border border-[var(--vt-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Trust</p>
                    <p className={`mt-1 text-sm font-semibold ${trustScoreColor(provider.trustScore)}`}>{provider.trustScore}</p>
                  </div>
                  <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Credentials</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">
                      {provider.activeCredentials}/{provider.credentialCount}
                    </p>
                  </div>
                  <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Rank</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">
                      {rank ? `${Math.round(rank.score)} · ${rank.band}` : provider.risk.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onFocusProvider(provider.npi)}
                    className="inline-flex items-center rounded-sm border border-cyan-400/40 bg-cyan-400 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-cyan-300"
                  >
                    Focus provider
                  </button>
                  <Link
                    href={buildIntelligenceHref('providers', {
                      npi: provider.npi,
                      open: ['provider'],
                    })}
                    className="inline-flex items-center rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                  >
                    Open panel
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {strengthDelta.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Leader deltas</p>
          {strengthDelta.map((entry) => (
            <p
              key={`${entry.dimension}:${entry.leader}`}
              className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-2)]"
            >
              {entry.dimension} favors {entry.leader} by {Math.round(entry.spread)}
            </p>
          ))}
        </div>
      ) : null}

      {commonGaps.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Common gaps</p>
          {commonGaps.map((gap) => (
            <p
              key={gap}
              className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-2)]"
            >
              {gap}
            </p>
          ))}
        </div>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-[var(--vt-text-3)]">Loading comparison deltas…</p> : null}
      {!loading && error ? <p className="mt-4 text-sm text-amber-200">{error}</p> : null}
    </CanvasDecisionBlock>
  );
}

function resolveSectionOrder(view: IntelligenceView): CanvasSectionKind[] {
  switch (view) {
    case 'providers':
      return ['providers', 'findings', 'storylines'];
    case 'storylines':
      return ['storylines', 'findings', 'providers'];
    case 'findings':
    case 'investigations':
      return ['findings', 'storylines', 'providers'];
    default:
      return ['findings', 'providers', 'storylines'];
  }
}

export function DashboardSurface() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const graphPanelRef = useRef<HTMLDivElement | null>(null);

  const view = resolveIntelligenceView(searchParams.get('view'));
  const searchQuery = searchParams.get('q') ?? '';
  const focusedPanel = searchParams.get('panel') ?? '';
  const selectedNpi = searchParams.get('npi') ?? '';
  const selectedFindingId = searchParams.get('findingId') ?? '';
  const selectedStorylineId = searchParams.get('storylineId') ?? '';
  const compareModeRequested = searchParams.get('compareMode') === '1';
  const hasExplicitOpenPanels = searchParams.getAll('open').length > 0;
  const openPanels = useMemo(
    () => parseCanvasOpenPanels(searchParams.getAll('open')),
    [searchParams],
  );
  const compareSelection = useMemo(
    () => parseCompareSelection(searchParams.get('compare')),
    [searchParams],
  );

  const providerFilters = useMemo(() => ({
    minTrustScore: view === 'providers'
      ? Number.parseInt(searchParams.get('minTrustScore') ?? '0', 10) || 0
      : 0,
  }), [searchParams, view]);

  const findingFilters = useMemo(() => ({
    severity: view === 'findings' ? searchParams.get('severity') : null,
    status: view === 'findings' ? searchParams.get('status') : null,
    type: view === 'findings' ? (searchParams.get('type') ?? searchParams.get('findingType')) : null,
    dateFrom: view === 'findings' ? searchParams.get('dateFrom') : null,
    dateTo: view === 'findings' ? searchParams.get('dateTo') : null,
    minConfidence: view === 'findings' ? searchParams.get('minConfidence') : null,
    investigatorId: view === 'findings' ? searchParams.get('investigatorId') : null,
  }), [searchParams, view]);

  const storylineFilters = useMemo(() => ({
    severity: view === 'storylines' ? searchParams.get('severity') : null,
    status: view === 'storylines' ? searchParams.get('status') : null,
    storylineType: view === 'storylines' ? searchParams.get('storylineType') : null,
    perspective: view === 'storylines' ? searchParams.get('perspective') : null,
  }), [searchParams, view]);

  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const [copilotFocusNodeId, setCopilotFocusNodeId] = useState<string | null>(null);
  const [copilotHighlightNodeId, setCopilotHighlightNodeId] = useState<string | null>(null);
  const [comparePayload, setComparePayload] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

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
    limit: view === 'providers' ? 14 : 10,
    minTrustScore: providerFilters.minTrustScore,
  });

  const findings = useFindings({
    provider: /^\d{10}$/.test(selectedNpi) ? selectedNpi : null,
    limit: view === 'findings' || view === 'investigations' ? 10 : 8,
    severity: findingFilters.severity,
    status: findingFilters.status,
    type: findingFilters.type,
    dateFrom: findingFilters.dateFrom,
    dateTo: findingFilters.dateTo,
    minConfidence: findingFilters.minConfidence,
    investigatorId: findingFilters.investigatorId,
  });

  const storylines = useStorylines({
    provider: /^\d{10}$/.test(selectedNpi) ? selectedNpi : null,
    limit: view === 'storylines' ? 10 : 6,
    severity: storylineFilters.severity,
    status: storylineFilters.status,
    storylineType: storylineFilters.storylineType,
    perspective: storylineFilters.perspective,
  });

  const actions = useActions({
    entity: /^\d{10}$/.test(selectedNpi) ? selectedNpi : null,
    limit: 6,
  });
  const graph = useGraph({
    npi: /^\d{10}$/.test(selectedNpi) ? selectedNpi : null,
    layer: 'blended',
    limit: 48,
  });
  const systemHealth = useSystemHealth();

  const selectedProvider = useMemo(() => {
    const items = providers.data?.providers ?? [];
    if (/^\d{10}$/.test(selectedNpi)) {
      return items.find((provider) => provider.npi === selectedNpi) ?? null;
    }
    return items[0] ?? null;
  }, [providers.data?.providers, selectedNpi]);

  const selectedFinding = useMemo(() => {
    const items = findings.data?.findings ?? [];
    if (selectedFindingId) {
      return items.find((finding) => finding.id === selectedFindingId) ?? null;
    }
    if (view === 'findings' || view === 'investigations' || view === 'dashboard') {
      return items[0] ?? null;
    }
    return null;
  }, [findings.data?.findings, selectedFindingId, view]);

  const selectedStoryline = useMemo(() => {
    const items = storylines.data?.storylines ?? [];
    if (selectedStorylineId) {
      return items.find((storyline) => storyline.id === selectedStorylineId) ?? null;
    }
    if (selectedFinding?.storylineId) {
      return items.find((storyline) => storyline.id === selectedFinding.storylineId) ?? null;
    }
    if (view === 'storylines' || view === 'investigations') {
      return items[0] ?? null;
    }
    return null;
  }, [selectedFinding?.storylineId, selectedStorylineId, storylines.data?.storylines, view]);
  const findingItems = findings.data?.findings ?? [];
  const storylineItems = storylines.data?.storylines ?? [];
  const providerItems = providers.data?.providers ?? [];
  const visibleFindingItems = findingItems.slice(0, 6);
  const visibleStorylineItems = storylineItems.slice(0, 5);
  const visibleProviderItems = providerItems.slice(0, 5);
  const totalFindingCount = findings.data?.total ?? findingItems.length;
  const findingsQueueHref = buildIntelligenceHref('findings', {
    provider: /^\d{10}$/.test(selectedNpi)
      ? selectedNpi
      : selectedFinding?.providerNpi ?? selectedProvider?.npi ?? undefined,
    findingId: selectedFinding?.id ?? undefined,
  });
  const workspacePayload = useMemo(() => buildIntelligenceWorkspacePayload({
    providers: providers.data?.providers ?? [],
    findings: findings.data?.findings ?? [],
    storylines: storylines.data?.storylines ?? [],
    actions: actions.data?.actions ?? [],
  }), [actions.data?.actions, findings.data?.findings, providers.data?.providers, storylines.data?.storylines]);
  const selectedProviderStats = useMemo(
    () => (selectedProvider ? workspacePayload.providerStatsByNpi.get(selectedProvider.npi) ?? null : null),
    [selectedProvider, workspacePayload.providerStatsByNpi],
  );

  const sectionOrder = useMemo(() => resolveSectionOrder(view), [view]);
  const currentHref = useMemo(() => {
    const serialized = searchParams.toString();
    return `${pathname}${serialized ? `?${serialized}` : ''}`;
  }, [pathname, searchParams]);

  const defaultPanels = useMemo(() => {
    const next: CanvasOpenPanel[] = [];

    if (view === 'providers' && selectedProvider) {
      next.push('provider');
    }

    if ((view === 'findings' || view === 'dashboard' || view === 'investigations') && selectedFinding) {
      next.push('finding');
    }

    if ((view === 'storylines' || view === 'investigations') && selectedStoryline) {
      next.push('storyline');
    }

    if (selectedProvider && (next.length === 0 || view === 'investigations' || view === 'dashboard')) {
      next.push('provider');
    }

    if (selectedStoryline && view === 'dashboard') {
      next.push('storyline');
    }

    return parseCanvasOpenPanels(next);
  }, [selectedFinding, selectedProvider, selectedStoryline, view]);

  const renderedPanels = hasExplicitOpenPanels ? openPanels : defaultPanels;
  const activeCompareNpis = compareModeRequested
    ? parseCompareSelection([
        ...(compareSelection.length === 0 && selectedProvider ? [selectedProvider.npi] : []),
        ...compareSelection,
      ].join(','))
    : [];

  const compareProviders = useMemo(() => {
    const directoryProviders = providers.data?.providers ?? [];
    return activeCompareNpis
      .map((npi) => directoryProviders.find((provider) => provider.npi === npi) ?? null)
      .filter((provider): provider is IntelligenceProvider => Boolean(provider));
  }, [activeCompareNpis, providers.data?.providers]);

  useEffect(() => {
    setCopilotFocusNodeId(null);
    setCopilotHighlightNodeId(null);
  }, [selectedNpi]);

  useEffect(() => {
    if (activeCompareNpis.length < 2) {
      setComparePayload(null);
      setCompareError(null);
      setCompareLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadComparison() {
      setCompareLoading(true);
      setCompareError(null);

      try {
        const response = await fetch('/api/investigation/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npis: activeCompareNpis }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null) as CompareResponse | null;
        if (!response.ok || !payload) {
          throw new Error('Provider comparison is unavailable.');
        }

        if (!controller.signal.aborted) {
          setComparePayload(payload);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setCompareError(error instanceof Error ? error.message : 'Provider comparison is unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setCompareLoading(false);
        }
      }
    }

    void loadComparison();
    return () => controller.abort();
  }, [activeCompareNpis]);

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
  }, [actions.data, findings.data, graph.data, providers.data, storylines.data, systemHealth.data]);

  const staleState = getSurfaceFreshnessState({
    generatedAt: providers.data?.generatedAt
      ?? findings.data?.generatedAt
      ?? storylines.data?.generatedAt
      ?? actions.data?.generatedAt
      ?? graph.data?.generatedAt,
    lastUpdated: providers.lastUpdated
      ?? findings.lastUpdated
      ?? storylines.lastUpdated
      ?? actions.lastUpdated
      ?? graph.lastUpdated,
  });

  const copilotContext = useMemo(() => buildDashboardCopilotContext({
    provider: selectedProvider,
    finding: selectedFinding,
    storyline: selectedStoryline,
    graph: graph.data ?? null,
    graphNodeId: copilotFocusNodeId ?? copilotHighlightNodeId,
    focusedPanel,
    recentFindings: findings.data?.findings ?? [],
  }), [
    copilotFocusNodeId,
    copilotHighlightNodeId,
    findings.data?.findings,
    focusedPanel,
    graph.data,
    selectedFinding,
    selectedProvider,
    selectedStoryline,
  ]);

  const highlightedNodeIds = useMemo(() => {
    const nodeIds = new Set<string>();
    const graphNodes = graph.data?.nodes ?? [];
    const graphFindings = selectedFinding?.id ? [selectedFinding.id] : [];
    const graphStorylines = selectedStoryline?.id ? [selectedStoryline.id] : [];

    for (const provider of compareProviders) {
      const nodeId = findGraphNodeIdForProvider(provider, graphNodes);
      if (nodeId) {
        nodeIds.add(nodeId);
      }
    }

    if (selectedProvider) {
      const nodeId = findGraphNodeIdForProvider(selectedProvider, graphNodes);
      if (nodeId) {
        nodeIds.add(nodeId);
      }
    }

    for (const node of graphNodes) {
      if (graphFindings.some((findingId) => node.findingIds?.includes(findingId))) {
        nodeIds.add(node.id);
      }
      if (graphStorylines.some((storylineId) => node.storylineIds?.includes(storylineId))) {
        nodeIds.add(node.id);
      }
    }

    return [...nodeIds];
  }, [compareProviders, graph.data?.nodes, selectedFinding?.id, selectedProvider, selectedStoryline?.id]);
  const currentGraphFocusNodeId = useMemo(() => (
    copilotFocusNodeId
    ?? resolveGraphFocusNodeId({
      graph: graph.data ?? null,
      graphFocus: searchParams.get('graphFocus'),
      provider: selectedProvider,
      finding: selectedFinding,
      storyline: selectedStoryline,
    })
  ), [copilotFocusNodeId, graph.data, searchParams, selectedFinding, selectedProvider, selectedStoryline]);

  function pushCanvas(
    updater: (params: URLSearchParams) => void,
    nextView: IntelligenceView = view,
  ) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('view', nextView);
    updater(nextParams);

    startTransition(() => {
      router.push(`/intelligence?${nextParams.toString()}`);
    });
  }

  function setOpenPanels(nextPanels: CanvasOpenPanel[], nextView: IntelligenceView = view) {
    pushCanvas((params) => {
      params.delete('open');
      for (const panel of buildCanvasOpenPanelParams(nextPanels)) {
        params.append('open', panel);
      }
    }, nextView);
  }

  function openPanel(panel: CanvasOpenPanel, nextView: IntelligenceView = view) {
    setOpenPanels(mergeCanvasOpenPanels(renderedPanels, panel), nextView);
  }

  function closePanel(panel: CanvasOpenPanel) {
    setOpenPanels(removeCanvasOpenPanel(renderedPanels, panel));
  }

  function setCompare(nextSelection: string[], keepMode = true) {
    pushCanvas((params) => {
      const serialized = serializeCompareSelection(nextSelection);
      if (keepMode) {
        params.set('compareMode', '1');
      } else {
        params.delete('compareMode');
      }

      if (serialized) {
        params.set('compare', serialized);
      } else {
        params.delete('compare');
      }
    }, 'providers');
  }

  function clearCompare() {
    pushCanvas((params) => {
      params.delete('compare');
      params.delete('compareMode');
    }, 'providers');
  }

  function focusProvider(npi: string, nextPanels: CanvasOpenPanel[] = ['provider']) {
    pushCanvas((params) => {
      params.set('npi', npi);
      params.set('graphFocus', npi);
      params.delete('findingId');
      params.delete('storylineId');
      params.delete('panel');
      params.delete('open');
      for (const panel of buildCanvasOpenPanelParams(nextPanels)) {
        params.append('open', panel);
      }
    }, 'providers');
  }

  function focusFinding(finding: IntelligenceFinding) {
    const nextPanels: CanvasOpenPanel[] = ['finding', 'provider'];
    if (finding.storylineId) {
      nextPanels.push('storyline');
    }

    pushCanvas((params) => {
      if (finding.providerNpi) {
        params.set('npi', finding.providerNpi);
      }
      params.set('findingId', finding.id);
      params.set('graphFocus', finding.id);
      if (finding.storylineId) {
        params.set('storylineId', finding.storylineId);
      }
      params.delete('panel');
      params.delete('open');
      for (const panel of buildCanvasOpenPanelParams(nextPanels)) {
        params.append('open', panel);
      }
    }, 'findings');
  }

  function focusStoryline(storyline: IntelligenceStoryline) {
    pushCanvas((params) => {
      if (storyline.providerNpi) {
        params.set('npi', storyline.providerNpi);
      }
      params.set('storylineId', storyline.id);
      params.set('graphFocus', storyline.id);
      params.delete('findingId');
      params.delete('panel');
      params.delete('open');
      for (const panel of buildCanvasOpenPanelParams(['storyline', 'provider'])) {
        params.append('open', panel);
      }
    }, 'storylines');
  }

  function selectFindingById(findingId: string) {
    const finding = (findings.data?.findings ?? []).find((candidate) => candidate.id === findingId);
    if (finding) {
      focusFinding(finding);
      return;
    }

    pushCanvas((params) => {
      params.set('findingId', findingId);
      params.set('panel', 'graph');
    }, 'findings');
  }

  function selectStorylineById(storylineId: string) {
    const storyline = (storylines.data?.storylines ?? []).find((candidate) => candidate.id === storylineId);
    if (storyline) {
      focusStoryline(storyline);
      return;
    }

    pushCanvas((params) => {
      params.set('storylineId', storylineId);
      params.set('panel', 'graph');
    }, 'storylines');
  }

  function openEvidenceForFinding(findingId: string, _evidenceIndex: number | null) {
    const finding = (findings.data?.findings ?? []).find((candidate) => candidate.id === findingId);
    if (finding) {
      focusFinding(finding);
    } else {
      selectFindingById(findingId);
    }
  }

  function refreshAll() {
    providers.refresh();
    findings.refresh();
    storylines.refresh();
    actions.refresh();
    systemHealth.refresh();
    graph.refresh();
  }

  function handleCompareToggle(npi: string) {
    const seededSelection = compareSelection.length === 0 && selectedProvider && selectedProvider.npi !== npi
      ? [selectedProvider.npi]
      : compareSelection;
    setCompare(toggleCompareSelection(seededSelection, npi), true);
  }

  function openPalette() {
    window.dispatchEvent(new Event('vital:open-command-palette'));
  }

  const providerBacklinks = useMemo<CanvasDecisionBacklink[]>(() => {
    if (!selectedProvider) {
      return [];
    }

    const linkedFindings = (findings.data?.findings ?? [])
      .filter((finding) => finding.providerNpi === selectedProvider.npi)
      .slice(0, 3)
      .map((finding) => ({
        label: `Finding · ${finding.title}`,
        onClick: () => focusFinding(finding),
      }));
    const linkedStorylines = (storylines.data?.storylines ?? [])
      .filter((storyline) => storyline.providerNpi === selectedProvider.npi)
      .slice(0, 2)
      .map((storyline) => ({
        label: `Storyline · ${storyline.title}`,
        onClick: () => focusStoryline(storyline),
      }));

    return [...linkedFindings, ...linkedStorylines];
  }, [findings.data?.findings, selectedProvider, storylines.data?.storylines]);

  const findingBacklinks = useMemo<CanvasDecisionBacklink[]>(() => {
    if (!selectedFinding) {
      return [];
    }

    const links: CanvasDecisionBacklink[] = [];
    if (selectedFinding.providerNpi) {
      links.push({
        label: `Provider · ${selectedFinding.providerLabel ?? selectedFinding.providerNpi}`,
        onClick: () => focusProvider(selectedFinding.providerNpi ?? ''),
      });
    }
    if (selectedFinding.storylineId && selectedStoryline) {
      links.push({
        label: `Storyline · ${selectedStoryline.title}`,
        onClick: () => focusStoryline(selectedStoryline),
      });
    }

    const siblingFindings = (findings.data?.findings ?? [])
      .filter((finding) => finding.id !== selectedFinding.id && (
        finding.providerNpi === selectedFinding.providerNpi
        || (selectedFinding.storylineId && finding.storylineId === selectedFinding.storylineId)
      ))
      .slice(0, 2);

    for (const finding of siblingFindings) {
      links.push({
        label: `Related finding · ${finding.title}`,
        onClick: () => focusFinding(finding),
      });
    }

    return links;
  }, [findings.data?.findings, selectedFinding, selectedStoryline]);

  const storylineBacklinks = useMemo<CanvasDecisionBacklink[]>(() => {
    if (!selectedStoryline) {
      return [];
    }

    const links: CanvasDecisionBacklink[] = [];
    if (selectedStoryline.providerNpi) {
      links.push({
        label: `Provider · ${selectedStoryline.providerNpi}`,
        onClick: () => focusProvider(selectedStoryline.providerNpi ?? ''),
      });
    }

    const linkedFindings = (findings.data?.findings ?? [])
      .filter((finding) => selectedStoryline.findingIds.includes(finding.id))
      .slice(0, 3);

    for (const finding of linkedFindings) {
      links.push({
        label: `Finding · ${finding.title}`,
        onClick: () => focusFinding(finding),
      });
    }

    return links;
  }, [findings.data?.findings, selectedStoryline]);

  const providerPanelMetrics = useMemo<CanvasDecisionMetric[]>(() => (
    selectedProvider
      ? [
          { label: 'Trust', value: String(selectedProvider.trustScore) },
          { label: 'Credentials', value: `${selectedProvider.activeCredentials}/${selectedProvider.credentialCount}` },
          { label: 'Findings', value: String(selectedProviderStats?.findingCount ?? findings.data?.total ?? 0) },
          { label: 'Storylines', value: String(selectedProviderStats?.storylineCount ?? storylines.data?.total ?? 0) },
        ]
      : []
  ), [findings.data?.total, selectedProvider, selectedProviderStats, storylines.data?.total]);

  const findingPanelMetrics = useMemo<CanvasDecisionMetric[]>(() => (
    selectedFinding
      ? [
          { label: 'Severity', value: selectedFinding.severity.toUpperCase() },
          { label: 'Confidence', value: `${Math.round(selectedFinding.confidence * 100)}%` },
          { label: 'Priority', value: String(Math.round(selectedFinding.priorityScore)) },
          { label: 'Evidence', value: String(selectedFinding.evidence.length) },
        ]
      : []
  ), [selectedFinding]);

  const storylinePanelMetrics = useMemo<CanvasDecisionMetric[]>(() => (
    selectedStoryline
      ? [
          { label: 'Severity', value: selectedStoryline.severity.toUpperCase() },
          { label: 'Confidence', value: `${Math.round(selectedStoryline.confidence * 100)}%` },
          { label: 'Findings', value: String(selectedStoryline.findingIds.length) },
          { label: 'Progression', value: `${Math.round(selectedStoryline.progressionScore * 100)}%` },
        ]
      : []
  ), [selectedStoryline]);

  const providerRecommendations = useMemo(() => (
    (actions.data?.actions ?? [])
      .filter((action) => action.providerNpi === selectedProvider?.npi)
      .slice(0, 3)
      .map((action) => action.title)
  ), [actions.data?.actions, selectedProvider?.npi]);

  const findingRecommendations = useMemo(() => (
    (actions.data?.actions ?? [])
      .filter((action) => action.sourceFindingIds.includes(selectedFinding?.id ?? ''))
      .slice(0, 3)
      .map((action) => action.title)
  ), [actions.data?.actions, selectedFinding?.id]);

  const graphHref = useMemo(() => buildIntelligenceGraphHref({
    npi: selectedNpi || undefined,
    providerId: selectedNpi || undefined,
    findingId: selectedFinding?.id ?? undefined,
    storylineId: selectedStoryline?.id ?? undefined,
  }), [selectedFinding?.id, selectedNpi, selectedStoryline?.id]);

  const panelBlocks = useMemo(() => {
    const blocks: React.ReactNode[] = [];

    if (renderedPanels.includes('provider') && selectedProvider) {
      const secondaryActions: CanvasDecisionAction[] = [
        {
          label: activeCompareNpis.includes(selectedProvider.npi) ? 'Remove compare' : 'Compare',
          onClick: () => handleCompareToggle(selectedProvider.npi),
        },
        {
          label: 'Open profile',
          href: `/providers/${selectedProvider.npi}?from=${encodeURIComponent(currentHref)}`,
        },
        {
          label: 'Lock graph',
          onClick: () => pushCanvas((params) => {
            params.set('panel', 'graph');
          }),
        },
      ];

      blocks.push(
        <CanvasDecisionBlock
          key="provider-panel"
          eyebrow="Provider Panel"
          title={selectedProvider.name}
          summary={selectedProvider.summary}
          badgeLabel={`Trust ${selectedProvider.trustScore}`}
          badgeTone="info"
          metrics={providerPanelMetrics}
          backlinks={providerBacklinks}
          recommendations={providerRecommendations}
          primaryAction={{
            label: 'Open investigation',
            href: buildIntelligenceHref('investigations', {
              npi: selectedProvider.npi,
              open: ['provider', 'finding', 'storyline'],
            }),
            tone: 'primary',
          }}
          secondaryActions={secondaryActions}
          onClose={() => closePanel('provider')}
        />,
      );
    }

    if (renderedPanels.includes('finding') && selectedFinding) {
      blocks.push(
        <CanvasDecisionBlock
          key="finding-panel"
          eyebrow="Finding Panel"
          title={selectedFinding.title}
          summary={selectedFinding.explanation || selectedFinding.summary}
          badgeLabel={selectedFinding.severity}
          badgeTone={severityTone(selectedFinding.severity)}
          metrics={findingPanelMetrics}
          backlinks={findingBacklinks}
          recommendations={findingRecommendations}
          primaryAction={{
            label: 'Investigate',
            onClick: () => focusFinding(selectedFinding),
            tone: 'primary',
          }}
          secondaryActions={[
            {
              label: 'Open detail',
              href: `/findings/${selectedFinding.id}?from=${encodeURIComponent(currentHref)}`,
            },
            {
              label: 'Graph trace',
              onClick: () => pushCanvas((params) => {
                params.set('panel', 'graph');
              }),
            },
          ]}
          onClose={() => closePanel('finding')}
        />,
      );
    }

    if (renderedPanels.includes('storyline') && selectedStoryline) {
      blocks.push(
        <CanvasDecisionBlock
          key="storyline-panel"
          eyebrow="Storyline Panel"
          title={selectedStoryline.title}
          summary={selectedStoryline.whyItMatters || selectedStoryline.summary}
          badgeLabel={selectedStoryline.status}
          badgeTone="info"
          metrics={storylinePanelMetrics}
          backlinks={storylineBacklinks}
          recommendations={selectedStoryline.recommendedActions.slice(0, 3)}
          primaryAction={{
            label: 'Trace storyline',
            onClick: () => focusStoryline(selectedStoryline),
            tone: 'primary',
          }}
          secondaryActions={[
            {
              label: 'Open detail',
              href: `/storylines/${selectedStoryline.id}?from=${encodeURIComponent(currentHref)}`,
            },
            {
              label: 'Provider lane',
              onClick: () => {
                if (selectedStoryline.providerNpi) {
                  focusProvider(selectedStoryline.providerNpi);
                }
              },
            },
          ]}
          onClose={() => closePanel('storyline')}
        />,
      );
    }

    return blocks;
  }, [
    activeCompareNpis,
    closePanel,
    currentHref,
    findingBacklinks,
    findingPanelMetrics,
    findingRecommendations,
    focusFinding,
    focusProvider,
    focusStoryline,
    handleCompareToggle,
    providerBacklinks,
    providerPanelMetrics,
    providerRecommendations,
    pushCanvas,
    renderedPanels,
    selectedFinding,
    selectedProvider,
    selectedStoryline,
    storylineBacklinks,
    storylinePanelMetrics,
  ]);

  return (
    <>
      <CommandPalette />
      <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden bg-[var(--vt-bg)] text-[var(--vt-text-1)]">
        <header className="border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <LiveFeedRibbon />
              <div className="hidden h-5 w-px bg-[var(--vt-border)] lg:block" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Intelligence OS</p>
                <p className="text-sm font-medium text-[var(--vt-text-1)]">
                  Operator Work Surface active.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form
                className="flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  pushCanvas((params) => {
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
                  className="w-44 bg-transparent text-xs text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
                />
              </form>

              <button
                type="button"
                onClick={openPalette}
                className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
              >
                <Command className="h-3.5 w-3.5" />
                Palette
              </button>

              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Findings</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">{totalFindingCount}</p>
            </div>
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Providers</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">{visibleProviderItems.length}</p>
            </div>
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Storylines</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">{visibleStorylineItems.length}</p>
            </div>
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Last refresh</p>
              <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">
                {providers.lastUpdated ? formatRelativeTime(providers.lastUpdated) : 'Pending'}
              </p>
            </div>
          </div>
        </header>

        {accessBanner ? (
          <SurfaceBanner tone={accessBanner.tone}>
            {accessBanner.description}
          </SurfaceBanner>
        ) : null}
        {staleState.isStale && staleState.ageMinutes !== null ? (
          <SurfaceBanner tone="info">
            {formatLastRefreshMessage(staleState.ageMinutes)}
          </SurfaceBanner>
        ) : null}

        <main className="grid min-h-0 flex-1 gap-px overflow-hidden bg-[var(--vt-border)] xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,420px)]">
          <aside className="min-h-0 overflow-y-auto bg-[var(--vt-surface-dim)] p-4">
            <div className="space-y-4">
              {view === 'dashboard' ? <LaunchReadinessPanel compact /> : null}
              {sectionOrder.map((section) => {
                if (section === 'findings') {
                  return (
                    <SignalSection
                      key="findings-section"
                      title="Findings"
                      detail="Promote the highest-signal findings directly into the canvas."
                      count={totalFindingCount}
                    >
                      {findings.error && findingItems.length === 0 ? (
                        <SurfaceErrorState
                          title="Findings unavailable"
                          description={findings.error}
                          onRetry={findings.refresh}
                        />
                      ) : null}
                      {!findings.loading && !findings.error && findingItems.length === 0 ? (
                        <SurfaceEmptyState
                          title="No findings in scope"
                          description="Widen the search or lock a provider into scope to pull more signals into the queue."
                        />
                      ) : null}
                      {visibleFindingItems.map((finding) => (
                        <Tooltip
                          key={finding.id}
                          title={finding.title}
                          trustScore={Math.round(finding.confidence * 100)}
                          lastSignal={finding.findingType.replace(/_/g, ' ')}
                          reason={finding.explanation || finding.summary}
                          side="right"
                          wrapperClassName="w-full"
                        >
                          <button
                            type="button"
                            onClick={() => focusFinding(finding)}
                            className={`w-full border-[1px] py-3 pl-3 pr-2 text-left transition select-none ${
                              selectedFinding?.id === finding.id
                                ? 'border-cyan-400/40 bg-cyan-400/10'
                                : 'border-[var(--vt-border)] bg-transparent hover:border-cyan-400/30 hover:bg-[var(--vt-surface)]'
                            }`}
                          >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                                  {finding.findingType.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                                  CONF {Math.round(finding.confidence * 100)}%
                                </span>
                              </div>
                              
                              <p className="text-sm font-semibold text-[var(--vt-text-1)] leading-tight mb-1">
                                {finding.title}
                              </p>
                              
                              <p className="text-xs text-[var(--vt-text-2)] leading-relaxed mb-2 line-clamp-2">
                                {finding.summary}
                              </p>

                              {finding.explanation ? (
                                <div className="mb-2 pl-2 border-l border-[var(--vt-border)]">
                                  <p className="text-[10px] italic leading-tight text-[var(--vt-text-3)] line-clamp-2">
                                    {finding.explanation}
                                  </p>
                                </div>
                              ) : null}

                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {finding.providerNpi ? (
                                  <span className="inline-flex items-center gap-1 rounded-[2px] bg-[var(--vt-surface)] border border-[var(--vt-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--vt-text-2)]">
                                    <span className="text-[var(--vt-text-3)]">Target</span> {finding.providerLabel ?? finding.providerNpi}
                                  </span>
                                ) : null}
                                {finding.storylineTitle ? (
                                  <span className="inline-flex items-center gap-1 rounded-[2px] bg-[var(--vt-surface)] border border-[var(--vt-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--vt-text-2)]">
                                    <span className="text-[var(--vt-text-3)]">Story</span> {finding.storylineTitle}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                        </Tooltip>
                      ))}
                      {totalFindingCount > visibleFindingItems.length ? (
                        <Link
                          href={findingsQueueHref}
                          className="flex items-center justify-between border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-3 text-sm font-medium text-[var(--vt-text-2)] transition hover:border-cyan-400/30 hover:text-[var(--vt-text-1)]"
                        >
                          <span>View all findings →</span>
                          <span className="text-xs uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
                            {totalFindingCount} total
                          </span>
                        </Link>
                      ) : null}
                    </SignalSection>
                  );
                }

                if (section === 'storylines') {
                  return (
                    <SignalSection
                      key="storylines-section"
                      title="Storylines"
                      detail="Open cluster context without leaving the graph and queue."
                      count={visibleStorylineItems.length}
                    >
                      {storylines.error && storylineItems.length === 0 ? (
                        <SurfaceErrorState
                          title="Storylines unavailable"
                          description={storylines.error}
                          onRetry={storylines.refresh}
                        />
                      ) : null}
                      {!storylines.loading && !storylines.error && storylineItems.length === 0 ? (
                        <SurfaceEmptyState
                          title="No storylines in scope"
                          description="Storyline clustering has not returned any active narratives for the current slice."
                        />
                      ) : null}
                      {visibleStorylineItems.map((storyline) => (
                        <Tooltip
                          key={storyline.id}
                          title={storyline.title}
                          lastSignal={`Status: ${storyline.status}`}
                          reason={storyline.whyItMatters}
                          side="right"
                          wrapperClassName="w-full"
                        >
                          <button
                            type="button"
                            onClick={() => focusStoryline(storyline)}
                            className={`w-full rounded-sm border px-3 py-3 text-left transition ${
                              selectedStoryline?.id === storyline.id
                                ? 'border-cyan-400/40 bg-cyan-400/10'
                                : 'border-[var(--vt-border)] bg-[var(--vt-surface)] hover:border-[var(--vt-text-3)]'
                            }`}
                          >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
                                <OpsBadge label={storyline.status} tone="info" />
                              </div>
                              <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{storyline.title}</p>
                              <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{storyline.whyItMatters}</p>
                            </div>
                            <GitBranch className="mt-1 h-4 w-4 shrink-0 text-[var(--vt-text-3)]" />
                          </div>
                        </button>
                        </Tooltip>
                      ))}
                    </SignalSection>
                  );
                }

                return (
                  <SignalSection
                    key="providers-section"
                    title="Providers"
                    detail="Lock a provider into scope or pull it into compare mode."
                    count={visibleProviderItems.length}
                  >
                    {providers.error && providerItems.length === 0 ? (
                      <SurfaceErrorState
                        title="Providers unavailable"
                        description={providers.error}
                        onRetry={providers.refresh}
                      />
                    ) : null}
                    {!providers.loading && !providers.error && providerItems.length === 0 ? (
                      <SurfaceEmptyState
                        title="No providers returned"
                        description="Adjust the search scope or trust threshold to widen the provider slice."
                      />
                    ) : null}
                    {visibleProviderItems.map((provider) => {
                      const inCompare = activeCompareNpis.includes(provider.npi);
                      return (
                        <Tooltip
                          key={provider.npi}
                          title={provider.name}
                          trustScore={provider.trustScore}
                          lastSignal={`Health: ${provider.credentialHealth}`}
                          reason={`NPI: ${provider.npi}`}
                          side="right"
                          wrapperClassName="w-full"
                        >
                        <div
                          className={`w-full rounded-sm border px-3 py-3 transition ${
                            selectedProvider?.npi === provider.npi
                              ? 'border-cyan-400/40 bg-cyan-400/10'
                              : 'border-[var(--vt-border)] bg-[var(--vt-surface)]'
                          }`}
                        >
                          <button type="button" onClick={() => focusProvider(provider.npi)} className="w-full text-left">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <OpsBadge label={provider.credentialHealth} tone="info" />
                                  <span className={`text-xs font-semibold ${trustScoreColor(provider.trustScore)}`}>
                                    {provider.trustScore}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{provider.name}</p>
                                <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{provider.summary}</p>
                              </div>
                              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--vt-text-3)]" />
                            </div>
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCompareToggle(provider.npi)}
                              className={`inline-flex items-center rounded-sm border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest transition ${
                                inCompare
                                  ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                                  : 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] text-[var(--vt-text-2)] hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]'
                              }`}
                            >
                              {inCompare ? 'In compare' : 'Compare'}
                            </button>
                            <EntityLink
                              href={buildIntelligenceHref('providers', {
                                npi: provider.npi,
                                open: ['provider'],
                              })}
                              label="Open panel"
                            />
                          </div>
                        </div>
                        </Tooltip>
                      );
                    })}
                  </SignalSection>
                );
              })}
            </div>
          </aside>

          {/* --- PRIMARY WORK AREA: FINDINGS / CASEBOARD CENTER --- */}
          <section className="min-h-0 overflow-y-auto bg-[var(--vt-surface)] p-4">
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Caseboard Space</p>
                    <p className="mt-1 text-sm text-[var(--vt-text-2)]">
                      Evaluate active signals, providers, and storylines to reach decisions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CANVAS_OPEN_PANEL_VALUES.map((panel) => (
                      <button
                        key={panel}
                        type="button"
                        onClick={() => openPanel(panel)}
                        className={`rounded-sm border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest transition ${
                          renderedPanels.includes(panel)
                            ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                            : 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)] hover:bg-[var(--vt-surface)]'
                        }`}
                      >
                        {panel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {compareModeRequested ? (
                <CompareModePanel
                  providers={compareProviders}
                  payload={comparePayload}
                  loading={compareLoading}
                  error={compareError}
                  onFocusProvider={(npi) => focusProvider(npi)}
                  onRemoveProvider={(npi) => setCompare(toggleCompareSelection(compareSelection, npi), true)}
                  onClose={clearCompare}
                />
              ) : null}

              {panelBlocks.length > 0 ? (
                <div className="space-y-4">
                  {panelBlocks}
                </div>
              ) : (
                <SurfaceEmptyState
                  title="Active caseboard empty"
                  description="Drop a finding, storyline, or provider here from the queue to start an evaluation."
                />
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-sm xl:col-span-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Decision pressure</p>
                  <p className="mt-2 text-sm text-[var(--vt-text-2)]">
                    {actions.data?.actions?.length
                      ? `${actions.data.actions.length} recommended actions are available for the active slice.`
                      : 'No recommended actions were returned for the current slice yet.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(actions.data?.actions ?? []).slice(0, 3).map((action) => (
                      <span
                        key={action.id}
                        className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-1 text-xs text-[var(--vt-text-1)]"
                        title={action.explanation}
                      >
                        {action.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* --- CONTEXT / ACTION RAIL: GRAPH + COPILOT + EVIDENCE --- */}
          <aside ref={graphPanelRef} className="min-h-0 overflow-y-auto bg-[var(--vt-surface-dim)] p-4">
            <div className="space-y-4">
              <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-2)]">Trust Network</p>
                  <Link
                    href={graphHref}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-2)] transition-all hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
                  >
                    Open Full Graph
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <GraphWorkbenchPanel
                  graph={graph.data ?? null}
                  providers={providers.data?.providers ?? []}
                  selectedProvider={selectedProvider}
                  selectedFindingId={selectedFinding?.id ?? selectedFindingId}
                  selectedStorylineId={selectedStoryline?.id ?? selectedStorylineId}
                  openFullGraphHref={graphHref}
                  loading={graph.loading}
                  error={graph.error}
                  onRetry={graph.refresh}
                  onSelectProvider={(provider) => focusProvider(provider.npi)}
                  focusNodeId={currentGraphFocusNodeId}
                  highlightNodeId={copilotHighlightNodeId ?? currentGraphFocusNodeId}
                  highlightNodeIds={highlightedNodeIds}
                  onSelectGraphNode={(nodeId) => {
                    setCopilotFocusNodeId(nodeId);
                    const selection = resolveWorkspaceSelectionFromGraphNode({
                      graph: graph.data ?? null,
                      nodeId,
                      providers: providers.data?.providers ?? [],
                      findings: findings.data?.findings ?? [],
                      storylines: storylines.data?.storylines ?? [],
                    });
                    if (selection.finding) {
                      focusFinding(selection.finding);
                      return;
                    }
                    if (selection.storyline) {
                      focusStoryline(selection.storyline);
                      return;
                    }
                    if (selection.provider) {
                      focusProvider(selection.provider.npi, renderedPanels.includes('provider') ? renderedPanels : ['provider']);
                    }
                  }}
                />
              </div>

              <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Scope Integrity</p>
                <p className="mt-2 text-sm text-[var(--vt-text-2)]">
                  {selectedProvider
                    ? `Targeting ${selectedProvider.name}. Network depth trimmed.`
                    : 'Global graph scope active. High noise ratio without target.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedProvider ? <OpsBadge label={`NPI ${selectedProvider.npi}`} tone="info" /> : null}
                  {selectedFinding ? <OpsBadge label={`Finding ${selectedFinding.id}`} tone={severityTone(selectedFinding.severity)} /> : null}
                  {selectedStoryline ? <OpsBadge label={`Storyline ${selectedStoryline.id}`} tone="info" /> : null}
                </div>
              </div>

              <WorkbenchCopilotPanel
                provider={selectedProvider}
                finding={selectedFinding}
                storyline={selectedStoryline}
                onNavigateToNpi={(npi) => focusProvider(npi)}
                onSelectFinding={selectFindingById}
                onSelectStoryline={selectStorylineById}
                onFocusGraphNode={(nodeId) => {
                  setCopilotFocusNodeId(nodeId);
                  pushCanvas((params) => {
                    params.set('panel', 'graph');
                  });
                }}
                onHighlightGraphNode={(nodeId) => {
                  setCopilotHighlightNodeId(nodeId);
                  pushCanvas((params) => {
                    params.set('panel', 'graph');
                  });
                }}
                onOpenEvidence={openEvidenceForFinding}
                context={copilotContext}
              />

              <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">System State</p>
                    <p className="mt-1 text-sm text-[var(--vt-text-2)]">Active links available for dedicated detail pages.</p>
                  </div>
                  <Sparkles className="h-4 w-4 text-[var(--vt-text-3)]" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedProvider ? (
                    <EntityLink href={`/providers/${selectedProvider.npi}?from=${encodeURIComponent(currentHref)}`} label="Provider detail" />
                  ) : null}
                  {selectedFinding ? (
                    <EntityLink href={`/findings/${selectedFinding.id}?from=${encodeURIComponent(currentHref)}`} label="Finding detail" />
                  ) : null}
                  {selectedStoryline ? (
                    <EntityLink href={`/storylines/${selectedStoryline.id}?from=${encodeURIComponent(currentHref)}`} label="Storyline detail" />
                  ) : null}
                  <EntityLink href={graphHref} label="Graph workspace" />
                </div>
                <p className="mt-3 text-xs text-[var(--vt-text-3)]" title={staleState.timestamp ? formatAbsoluteTime(staleState.timestamp) : undefined}>
                  {staleState.timestamp ? `Intelligence fed ${formatRelativeTime(staleState.timestamp)}.` : 'Waiting for connection.'}
                </p>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}
