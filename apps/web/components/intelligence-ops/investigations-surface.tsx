'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import {
  buildFindingStatusEndpoint,
  buildInvestigationWorkbenchRequestPath,
  FINDING_STATUS_METHOD,
  type InvestigationWorkbenchAnchorInput,
} from '@/lib/intelligence/investigation-workbench-client';
import type { CopilotContextPayload } from '@/components/copilot/types';
import type { IntelligenceAccessReason, IntelligenceProvider } from '@/lib/intelligence/contracts';
import { getAccessBannerState } from '@/lib/intelligence/state';
import { summarizeTrustSignals } from '@/lib/intelligence/trust-signals';
import { OperationsShell } from './shell';
import { EntityLink, OpsBadge, OpsCard, SurfaceBanner, severityTone } from './primitives';
import { CopilotSearchBar } from '@/components/copilot/CopilotSearchBar';
import { EvidenceViewerPanel } from './evidence-viewer-panel';
import { GraphWorkbenchPanel } from './graph-workbench-panel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkbenchEvidenceItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
  field?: string;
  provenanceChain?: string[];
  qualityRating?: 'STRONG' | 'ADEQUATE' | 'WEAK' | 'MISSING';
  corroborationCount?: number;
}

interface WorkbenchFindingContext {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  explanation: string;
  confidence: number;
  priorityScore: number;
  evidence: WorkbenchEvidenceItem[];
  actions: Array<{ id: string; label: string; type: string }>;
  relatedFindingIds: string[];
  storylineId: string | null;
  storylineTitle: string | null;
  npis: string[];
  createdAt: string;
}

interface WorkbenchStorylineContext {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  narrative: string;
  whyItMatters: string;
  findingCount: number;
  entityCount: number;
  confidence: number;
  progressionScore: number;
  recommendedActions: string[];
  lastActivityAt: string;
  evidence: WorkbenchEvidenceItem[];
}

interface WorkbenchProviderContext {
  npi: string;
  label: string | null;
  specialty: string | null;
  state: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence: number;
  activeFindings: number;
}

interface WorkbenchRelatedFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  summary: string;
  priorityScore: number;
  href: string;
}

interface WorkbenchNavigation {
  graphHref: string;
  copilotHref: string;
  investigationHref: string;
}

interface WorkbenchContext {
  anchor: { npi?: string; findingId?: string; storylineId?: string };
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  relatedFindings: WorkbenchRelatedFinding[];
  navigation: WorkbenchNavigation | null;
  uiHints?: {
    copilotPrompt: string;
    copilotSummary: string | null;
    highlightNodeIds: string[];
  };
  accessMode?: 'full' | 'public_snapshot';
  reason?: IntelligenceAccessReason;
  generatedAt: string;
  error?: string;
}

interface WorkbenchErrorPayload {
  error?: string;
  error_description?: string;
  workspaceSwitchHref?: string;
  accessMode?: 'full' | 'public_snapshot';
  reason?: IntelligenceAccessReason;
}

interface InvestigationGraphSelection {
  focusNodeId: string | null;
  selectedNodeId: string | null;
  neighborNodeIds: string[];
  neighborEdgeIds: string[];
}

function buildInvestigationCopilotContext(
  context: WorkbenchContext,
  graphSelection: InvestigationGraphSelection,
): CopilotContextPayload {
  const evidence = context.finding?.evidence ?? context.storyline?.evidence ?? [];
  const evidenceSignals = evidence.map((item) => ({
    source: item.source,
    observedAt: item.observedAt,
    confidence: item.confidence,
    qualityRating: item.qualityRating,
    corroborationCount: item.corroborationCount,
  }));
  const evidenceSummaryStats = evidenceSignals.length > 0
    ? summarizeTrustSignals(evidenceSignals)
    : null;
  const scope = graphSelection.selectedNodeId || graphSelection.focusNodeId
    ? 'graph'
    : context.finding
      ? 'finding'
      : context.storyline
        ? 'storyline'
        : context.provider
          ? 'provider'
          : 'global';

  return {
    scope,
    provider: context.provider
      ? {
          npi: context.provider.npi,
          label: context.provider.label,
          specialty: context.provider.specialty,
          state: context.provider.state,
          trustScore: context.provider.trustScore,
          trustBand: context.provider.trustBand,
          trustConfidence: context.provider.trustConfidence,
          activeFindings: context.provider.activeFindings,
        }
      : null,
    finding: context.finding
      ? {
          id: context.finding.id,
          findingType: context.finding.findingType,
          title: context.finding.title,
          severity: context.finding.severity,
          status: context.finding.status,
          summary: context.finding.summary,
          explanation: context.finding.explanation,
          confidence: context.finding.confidence,
          priorityScore: context.finding.priorityScore,
          evidence: context.finding.evidence,
          storylineId: context.finding.storylineId,
          storylineTitle: context.finding.storylineTitle,
          providerNpi: context.provider?.npi ?? context.anchor.npi ?? null,
          npis: context.finding.npis,
        }
      : null,
    storyline: context.storyline
      ? {
          id: context.storyline.id,
          title: context.storyline.title,
          storylineType: context.storyline.storylineType,
          severity: context.storyline.severity,
          status: context.storyline.status,
          narrative: context.storyline.narrative,
          summary: context.storyline.whyItMatters,
          whyItMatters: context.storyline.whyItMatters,
          confidence: context.storyline.confidence,
          findingCount: context.storyline.findingCount,
          entityCount: context.storyline.entityCount,
          progressionScore: context.storyline.progressionScore,
          evidence: context.storyline.evidence,
          providerNpi: context.provider?.npi ?? context.anchor.npi ?? null,
          recommendedActions: context.storyline.recommendedActions,
          lastActivityAt: context.storyline.lastActivityAt,
        }
      : null,
    graph: graphSelection,
    recentFindings: context.relatedFindings.slice(0, 6).map((finding) => ({
      id: finding.id,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity,
      priorityScore: finding.priorityScore,
      href: finding.href,
    })),
    evidenceSummary: evidence.slice(0, 4).map((item) => ({
      label: item.field ?? 'Evidence',
      detail: item.claim,
      source: item.source,
      observedAt: item.observedAt,
    })),
    evidenceSummaryStats,
    riskSummary: context.provider
      ? {
          trustScore: context.provider.trustScore,
          trustBand: context.provider.trustBand,
          trustConfidence: context.provider.trustConfidence,
          summary: `${context.provider.activeFindings} active finding${context.provider.activeFindings === 1 ? '' : 's'} in the current provider scope.`,
        }
      : null,
  };
}

// ── Investigation State (lightweight, no external deps) ───────────────────────

interface InvState {
  npi: string | null;
  findingId: string | null;
  storylineId: string | null;
  evidenceIdx: number;
  copilotCollapsed: boolean;
  evidenceCollapsed: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceBar(confidence: number) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-slate-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
    </div>
  );
}

function trustBandTone(band: string): 'success' | 'warning' | 'critical' | 'neutral' {
  switch (band?.toUpperCase()) {
    case 'HIGH': case 'L3': return 'success';
    case 'MEDIUM': case 'L2': return 'neutral';
    case 'LOW': case 'L1': return 'warning';
    case 'CRITICAL': case 'L0': return 'critical';
    default: return 'neutral';
  }
}

function emptyProviderMessage(anchor: WorkbenchContext['anchor']) {
  if (anchor.npi) {
    return `No provider context resolved for NPI ${anchor.npi}.`;
  }

  if (anchor.findingId || anchor.storylineId) {
    return 'No provider context is attached to the selected investigation anchor.';
  }

  return 'Enter a provider NPI, finding, or storyline to load provider context.';
}

function emptyFindingMessage(anchor: WorkbenchContext['anchor']) {
  if (anchor.findingId) {
    return `No finding context resolved for finding ${anchor.findingId}.`;
  }

  if (anchor.npi || anchor.storylineId) {
    return 'No finding context is attached to the current investigation.';
  }

  return 'Select a finding or enter an anchor to load finding context.';
}

function emptyStorylineMessage(anchor: WorkbenchContext['anchor']) {
  if (anchor.storylineId) {
    return `No storyline context resolved for storyline ${anchor.storylineId}.`;
  }

  if (anchor.findingId || anchor.npi) {
    return 'No storyline context is attached to the current investigation.';
  }

  return 'Select a storyline or enter an anchor to load storyline context.';
}

function MissingContextCard({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--vt-text-3)]">{message}</p>
    </div>
  );
}

// ── Left Panel: Findings Inbox ────────────────────────────────────────────────

function FindingsInbox({
  findings,
  selectedId,
  onSelect,
}: {
  findings: WorkbenchRelatedFinding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <p className="shrink-0 px-3 py-2 text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">
        Findings ({findings.length})
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {findings.length === 0 ? (
          <p className="px-2 py-4 text-xs text-[var(--vt-text-3)]">No findings for this provider.</p>
        ) : null}
        {findings.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`w-full rounded-xl border p-2.5 text-left transition ${
              selectedId === f.id
                ? 'border-cyan-400/50 bg-cyan-400/5'
                : 'border-[var(--vt-border)] hover:border-[var(--vt-text-3)]/30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <OpsBadge label={f.severity} tone={severityTone(f.severity)} />
              <span className="text-[10px] text-[var(--vt-text-3)]">{f.findingType.replace(/_/g, ' ')}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-medium text-[var(--vt-text-1)]">{f.title}</p>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--vt-text-3)]">{f.summary}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Center Top: Provider Investigation Panel ──────────────────────────────────

function ProviderInvestigationPanel({
  anchor,
  provider,
  finding,
  storyline,
  navigation,
}: {
  anchor: WorkbenchContext['anchor'];
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  navigation: WorkbenchNavigation | null;
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* Provider header */}
      {provider ? (
        <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">
                {provider.label ?? `Provider ${provider.npi}`}
              </h3>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--vt-text-3)]">
                {provider.specialty ? <span>{provider.specialty}</span> : null}
                {provider.state ? <span>{provider.state}</span> : null}
                <span>NPI {provider.npi}</span>
                <span>{provider.activeFindings} active finding{provider.activeFindings === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <OpsBadge label={provider.trustBand} tone={trustBandTone(provider.trustBand)} />
              <span className="text-xs tabular-nums text-[var(--vt-text-3)]">score {provider.trustScore}</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <EntityLink href={`/providers/${provider.npi}`} label="Profile" />
            <EntityLink href={buildIntelligenceHref('dashboard', { npi: provider.npi, panel: 'graph' })} label="Graph" />
            {navigation?.copilotHref ? <EntityLink href={navigation.copilotHref} label="Copilot" /> : null}
          </div>
        </div>
      ) : (
        <MissingContextCard
          label="Provider"
          message={emptyProviderMessage(anchor)}
        />
      )}

      {/* Active finding */}
      {finding ? (
        <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]">Finding</span>
            <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
            <OpsBadge label={finding.findingType.replace(/_/g, ' ')} />
          </div>
          <h4 className="text-sm font-semibold text-[var(--vt-text-1)]">{finding.title}</h4>
          <p className="text-xs leading-5 text-[var(--vt-text-2)]">{finding.summary}</p>
          <p className="text-xs leading-5 text-[var(--vt-text-3)]">{finding.explanation}</p>
          <div className="flex flex-wrap gap-2">
            <EntityLink href={`/findings/${finding.id}`} label="Full Finding" />
            {finding.storylineId ? (
              <EntityLink href={`/storylines/${finding.storylineId}`} label={finding.storylineTitle ?? 'Storyline'} />
            ) : null}
          </div>
        </div>
      ) : (
        <MissingContextCard
          label="Finding"
          message={emptyFindingMessage(anchor)}
        />
      )}

      {/* Storyline */}
      {storyline ? (
        <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]">Storyline</span>
            <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
            <OpsBadge label={storyline.status} />
          </div>
          <h4 className="text-sm font-semibold text-[var(--vt-text-1)]">{storyline.title}</h4>
          <p className="text-xs leading-5 text-[var(--vt-text-2)]">{storyline.whyItMatters}</p>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--vt-text-3)]">
            <span>{storyline.findingCount} findings</span>
            <span>{Math.round(storyline.confidence * 100)}% confidence</span>
          </div>
          {storyline.recommendedActions.length > 0 ? (
            <ul className="space-y-0.5">
              {storyline.recommendedActions.slice(0, 3).map((a, i) => (
                <li key={i} className="text-xs text-[var(--vt-text-2)]">→ {a}</li>
              ))}
            </ul>
          ) : null}
          <EntityLink href={`/storylines/${storyline.id}`} label="Full Storyline" />
        </div>
      ) : (
        <MissingContextCard
          label="Storyline"
          message={emptyStorylineMessage(anchor)}
        />
      )}
    </div>
  );
}

// ── Right Top: Network Graph Mini ─────────────────────────────────────────────

function toIntelligenceProvider(provider: WorkbenchProviderContext | null): IntelligenceProvider | null {
  if (!provider) {
    return null;
  }

  return {
    id: provider.npi,
    npi: provider.npi,
    name: provider.label ?? `Provider ${provider.npi}`,
    specialties: provider.specialty ? [provider.specialty] : [],
    credentialHealth: 'VERIFIED',
    trustScore: provider.trustScore,
    activeCredentials: 1,
    credentialCount: 1,
    primaryIssuer: provider.state,
    lastVerifiedAt: null,
    summary: `${provider.activeFindings} active finding${provider.activeFindings === 1 ? '' : 's'} in scope.`,
    tags: [provider.trustBand, provider.state ?? ''],
    risk: provider.trustScore >= 80 ? 'healthy' : provider.trustScore >= 65 ? 'neutral' : provider.trustScore >= 45 ? 'degraded' : 'critical',
  };
}

function NetworkGraphPanel({
  provider,
  focusNodeId,
  highlightNodeIds,
  selectedFindingId,
  selectedStorylineId,
  onFocusNode,
  onSnapshotChange,
}: {
  provider: WorkbenchProviderContext | null;
  focusNodeId: string | null;
  highlightNodeIds: string[];
  selectedFindingId: string | null;
  selectedStorylineId: string | null;
  onFocusNode: (nodeId: string) => void;
  onSnapshotChange: (selection: InvestigationGraphSelection) => void;
}) {
  const graph = useGraph({
    npi: provider?.npi ?? null,
    layer: 'blended',
    limit: 48,
    paused: !provider,
  });
  const providers = useProviders({
    limit: 12,
    paused: false,
  });
  const selectedProvider = useMemo(() => toIntelligenceProvider(provider), [provider]);
  const primaryHighlightNodeId = highlightNodeIds[0] ?? null;

  useEffect(() => {
    const nodes = graph.data?.nodes ?? [];
    const edges = graph.data?.edges ?? [];
    const activeNodeId = focusNodeId ?? primaryHighlightNodeId ?? graph.data?.focusNodeId ?? null;

    if (!graph.data) {
      onSnapshotChange({
        focusNodeId: null,
        selectedNodeId: focusNodeId ?? null,
        neighborNodeIds: [],
        neighborEdgeIds: [],
      });
      return;
    }

    const neighborEdgeIds = activeNodeId
      ? edges
          .filter((edge) => edge.source === activeNodeId || edge.target === activeNodeId)
          .map((edge) => edge.id)
      : [];
    const neighborNodeIds = activeNodeId
      ? [...new Set(
          edges
            .filter((edge) => edge.source === activeNodeId || edge.target === activeNodeId)
            .flatMap((edge) => [edge.source, edge.target]),
        )].filter((nodeId) => nodeId !== activeNodeId)
      : [];

    onSnapshotChange({
      focusNodeId: graph.data.focusNodeId,
      selectedNodeId: activeNodeId,
      neighborNodeIds,
      neighborEdgeIds,
    });
  }, [focusNodeId, graph.data, onSnapshotChange, primaryHighlightNodeId]);

  return (
    <div className="h-full p-3">
      <GraphWorkbenchPanel
        graph={graph.data ?? null}
        providers={providers.data?.providers ?? (selectedProvider ? [selectedProvider] : [])}
        selectedProvider={selectedProvider}
        selectedFindingId={selectedFindingId}
        selectedStorylineId={selectedStorylineId}
        openFullGraphHref={buildIntelligenceGraphHref({
          npi: provider?.npi,
          providerId: provider?.npi,
          findingId: selectedFindingId,
          storylineId: selectedStorylineId,
          focusNodeId: focusNodeId ?? undefined,
        })}
        loading={graph.loading}
        error={graph.error}
        onRetry={graph.refresh}
        onSelectProvider={(nextProvider) => {
          window.location.href = buildIntelligenceHref('investigations', { npi: nextProvider.npi });
        }}
        focusNodeId={focusNodeId}
        highlightNodeId={primaryHighlightNodeId}
        highlightNodeIds={highlightNodeIds}
        onSelectGraphNode={(nodeId) => onFocusNode(nodeId ?? '')}
      />
    </div>
  );
}

// ── Right Bottom: Copilot Panel ───────────────────────────────────────────────

function CopilotPanel({
  npi,
  findingId,
  storylineId,
  context,
  accessMode,
  promptSeed,
  summary,
  collapsed,
  onToggle,
  onSelectFinding,
  onSelectStoryline,
  onFocusGraphNode,
  onHighlightGraphNode,
  onOpenEvidence,
}: {
  npi: string;
  findingId: string | null;
  storylineId: string | null;
  context: CopilotContextPayload;
  accessMode: 'full' | 'public_snapshot';
  promptSeed: string | null;
  summary: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onSelectFinding: (findingId: string) => void;
  onSelectStoryline: (storylineId: string) => void;
  onFocusGraphNode: (nodeId: string) => void;
  onHighlightGraphNode: (nodeId: string) => void;
  onOpenEvidence: (findingId: string, evidenceIndex: number | null) => void;
}) {
  const contextParts: string[] = [`NPI ${npi}`];
  if (findingId) contextParts.push(`finding`);
  if (storylineId) contextParts.push(`storyline`);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Copilot</p>
          <button onClick={onToggle} className="text-xs text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        {/* Context chips */}
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/5 px-2 py-0.5 text-[10px] text-cyan-400">NPI {npi}</span>
          {findingId ? <span className="rounded-full border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 text-[10px] text-amber-400">Finding</span> : null}
          {storylineId ? <span className="rounded-full border border-violet-400/30 bg-violet-400/5 px-2 py-0.5 text-[10px] text-violet-400">Storyline</span> : null}
        </div>
      </div>
      {!collapsed ? (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {summary ? (
            <div className="mb-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-xs leading-5 text-[var(--vt-text-2)]">
              {summary}
              {accessMode === 'public_snapshot' ? (
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                  Sign in to run live Copilot queries.
                </p>
              ) : null}
            </div>
          ) : null}
          <CopilotSearchBar
            compact
            sessionId={`inv_${npi}`}
            context={context}
            placeholder={promptSeed ?? `Ask about ${contextParts.join(', ')}…`}
            seedQuery={promptSeed}
            onNavigateToNpi={(targetNpi) => {
              window.location.href = buildIntelligenceHref('investigations', { npi: targetNpi });
            }}
            onSelectFinding={onSelectFinding}
            onSelectStoryline={onSelectStoryline}
            onFocusGraphNode={onFocusGraphNode}
            onHighlightGraphNode={onHighlightGraphNode}
            onOpenEvidence={onOpenEvidence}
            autoFocus={false}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-[var(--vt-text-3)]">Copilot ready · {contextParts.join(' · ')}</p>
        </div>
      )}
    </div>
  );
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────

function useWorkbenchShortcuts(handlers: {
  onEscalate?: () => void;
  onDismiss?: () => void;
  onInvestigating?: () => void;
  onLinkStoryline?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toUpperCase()) {
        case 'E':
          e.preventDefault();
          handlers.onEscalate?.();
          break;
        case 'D':
          e.preventDefault();
          handlers.onDismiss?.();
          break;
        case 'I':
          e.preventDefault();
          handlers.onInvestigating?.();
          break;
        case 'S':
          e.preventDefault();
          handlers.onLinkStoryline?.();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handlers]);
}

// ── Main Surface ──────────────────────────────────────────────────────────────

export function InvestigationsSurface() {
  const searchParams = useSearchParams();
  const seededNpi = searchParams.get('npi') ?? '';
  const seededFindingId = searchParams.get('findingId') ?? '';
  const seededStorylineId = searchParams.get('storylineId') ?? '';
  const hasAnchor = Boolean(seededNpi || seededFindingId || seededStorylineId);

  const [npiInput, setNpiInput] = useState(seededNpi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHref, setErrorHref] = useState<string | null>(null);
  const [context, setContext] = useState<WorkbenchContext | null>(null);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(seededFindingId || null);
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState<number | null>(null);
  const [graphSelection, setGraphSelection] = useState<InvestigationGraphSelection>({
    focusNodeId: null,
    selectedNodeId: null,
    neighborNodeIds: [],
    neighborEdgeIds: [],
  });
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // ── Finding detail cache: hydrated from workbench responses ─────────────
  const findingCacheRef = useRef<Map<string, WorkbenchFindingContext>>(new Map());

  const fetchWorkbench = useCallback(async (params: InvestigationWorkbenchAnchorInput) => {
    const requestPath = buildInvestigationWorkbenchRequestPath(params);

    setLoading(true);
    setError(null);
    setErrorHref(null);

    try {
      const res = await fetch(requestPath, {
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({})) as WorkbenchContext | WorkbenchErrorPayload;
      if (!res.ok) {
        const workbenchError = payload as WorkbenchErrorPayload;
        setErrorHref(typeof workbenchError.workspaceSwitchHref === 'string' ? workbenchError.workspaceSwitchHref : null);
        throw new Error(
          workbenchError.error_description
            ?? workbenchError.error
            ?? `Request failed ${res.status}`,
        );
      }

      const nextContext = payload as WorkbenchContext;
      setContext(nextContext);
      setNpiInput(nextContext.provider?.npi ?? nextContext.anchor.npi ?? params.npi ?? '');
      setSelectedFindingId(params.findingId ?? nextContext.finding?.id ?? null);
      setSelectedEvidenceIndex(null);
      const highlightNodeIds = nextContext.uiHints?.highlightNodeIds ?? [];
      setCopilotCollapsed(false);
      setGraphSelection({
        focusNodeId: highlightNodeIds[0] ?? null,
        selectedNodeId: highlightNodeIds[0] ?? null,
        neighborNodeIds: [],
        neighborEdgeIds: [],
      });
      // Cache the finding detail for instant hydration on re-select
      if (nextContext.finding) {
        findingCacheRef.current.set(nextContext.finding.id, nextContext.finding);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Investigation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAnchor) {
      return;
    }

    void fetchWorkbench({
      npi: seededNpi || undefined,
      findingId: seededFindingId || undefined,
      storylineId: seededStorylineId || undefined,
    });
  }, [fetchWorkbench, hasAnchor, seededFindingId, seededNpi, seededStorylineId]);

  // Finding selection from inbox — optimistic hydration from cache
  const handleSelectFinding = useCallback((id: string) => {
    setSelectedFindingId(id);
    setSelectedEvidenceIndex(null);

    // Optimistic: if we have a cached finding detail, hydrate instantly
    const cached = findingCacheRef.current.get(id);
    if (cached && context) {
      setContext(prev => prev ? { ...prev, finding: cached } : prev);
    }

    // Lazy-fetch full context in background (will update if different)
    if (context?.provider?.npi) {
      void fetchWorkbench({ npi: context.provider.npi, findingId: id });
    }
  }, [context, fetchWorkbench]);

  // Keyboard shortcut actions
  const showAction = useCallback((msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 2000);
  }, []);

  useWorkbenchShortcuts({
    onEscalate: () => {
      if (context?.finding) {
        void fetch(buildFindingStatusEndpoint(context.finding.id), {
          method: FINDING_STATUS_METHOD,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'investigating' }),
        });
        showAction(`Escalated: ${context.finding.title}`);
      }
    },
    onDismiss: () => {
      if (context?.finding) {
        void fetch(buildFindingStatusEndpoint(context.finding.id), {
          method: FINDING_STATUS_METHOD,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'dismissed' }),
        });
        showAction(`Dismissed: ${context.finding.title}`);
      }
    },
    onInvestigating: () => {
      if (context?.finding) showAction(`Investigating: ${context.finding.title}`);
    },
    onLinkStoryline: () => {
      if (context?.finding && context.storyline) {
        showAction(`Linked to storyline: ${context.storyline.title}`);
      }
    },
  });

  const providerNpi = context?.provider?.npi ?? null;
  const accessBanner = getAccessBannerState(context?.accessMode, context?.reason);
  const copilotContext = useMemo(
    () => context ? buildInvestigationCopilotContext(context, graphSelection) : null,
    [context, graphSelection],
  );

  const handleSelectStoryline = useCallback((storylineId: string) => {
    const npi = context?.provider?.npi ?? undefined;
    void fetchWorkbench({
      npi,
      storylineId,
    });
  }, [context?.provider?.npi, fetchWorkbench]);

  const handleOpenEvidence = useCallback((findingId: string, evidenceIndex: number | null) => {
    setSelectedEvidenceIndex(evidenceIndex);
    handleSelectFinding(findingId);
  }, [handleSelectFinding]);

  useEffect(() => {
    const highlightNodeIds = context?.uiHints?.highlightNodeIds ?? [];
    setGraphSelection({
      focusNodeId: highlightNodeIds[0] ?? null,
      selectedNodeId: highlightNodeIds[0] ?? null,
      neighborNodeIds: [],
      neighborEdgeIds: [],
    });
  }, [context?.uiHints?.highlightNodeIds, providerNpi]);

  return (
    <OperationsShell
      activeHref="/intelligence"
      activeNavKey="investigations"
      title="Investigation Workbench"
      description="Four-panel investigation surface. Select findings, inspect evidence, explore the provider network, and query the Copilot — all in one view."
      breadcrumbs={[{ label: 'Investigations' }]}
      banner={actionMsg ? (
        <SurfaceBanner tone="info">
          <span className="animate-pulse">{actionMsg}</span>
        </SurfaceBanner>
      ) : accessBanner ? (
        <SurfaceBanner tone={accessBanner.tone}>
          {accessBanner.description}
        </SurfaceBanner>
      ) : error ? (
        <SurfaceBanner tone="warning">
          <span>{error}</span>
          {errorHref ? (
            <>
              {' '}
              <Link href={errorHref} className="underline">
                Switch workspace
              </Link>
            </>
          ) : null}
        </SurfaceBanner>
      ) : context?.generatedAt ? (() => {
        const ageSec = Math.round((Date.now() - new Date(context.generatedAt).getTime()) / 1000);
        return ageSec > 60 ? (
          <SurfaceBanner tone="neutral">
            Data last refreshed {ageSec}s ago · <button onClick={() => { void fetchWorkbench(context.anchor); }} className="underline">Refresh</button>
          </SurfaceBanner>
        ) : null;
      })() : null}
    >
      {/* NPI input */}
      <OpsCard className="space-y-2">
        <form
          className="flex flex-col gap-2 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{10}$/.test(npiInput.trim())) void fetchWorkbench({ npi: npiInput.trim() });
          }}
        >
          <input
            value={npiInput}
            onChange={(e) => setNpiInput(e.target.value)}
            placeholder="Provider NPI (10 digits)"
            className="min-w-0 flex-1 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-2.5 text-sm text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)] focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
          <button
            type="submit"
            disabled={loading || !/^\d{10}$/.test(npiInput.trim())}
            className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Investigate'}
          </button>
        </form>
        {/* Shortcut hints */}
        {context?.finding ? (
          <div className="flex flex-wrap gap-3 text-[10px] text-[var(--vt-text-3)]">
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">E</kbd> Escalate</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">D</kbd> Dismiss</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">I</kbd> Investigating</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">S</kbd> Link Storyline</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">⌘K</kbd> Copilot</span>
          </div>
        ) : null}
      </OpsCard>

      {/* Empty state — no anchor provided */}
      {!context && !loading && !error ? (
        <OpsCard className="space-y-3 border-dashed">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Start an investigation</h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--vt-text-2)]">
            Enter a 10-digit provider NPI above to load the investigation workbench with findings, evidence, graph context, and Copilot.
          </p>
          <p className="text-sm text-[var(--vt-text-3)]">
            You can also navigate here from a provider profile, finding detail, or storyline detail page.
          </p>
        </OpsCard>
      ) : null}

      {/* Four-panel grid */}
      {context ? (
        <div
          className="grid gap-px overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-border)]"
          style={{
            gridTemplateColumns: '320px 1fr 380px',
            gridTemplateRows: '1fr 280px',
            height: 'calc(100vh - 340px)',
            minHeight: '520px',
          }}
        >
          {/* Left: Findings Inbox (spans both rows) */}
          <div className="row-span-2 bg-[var(--vt-surface)]">
            <FindingsInbox
              findings={context.relatedFindings}
              selectedId={selectedFindingId}
              onSelect={handleSelectFinding}
            />
          </div>

          {/* Center top: Provider Investigation */}
          <div className="bg-[var(--vt-surface)]">
            <ProviderInvestigationPanel
              anchor={context.anchor}
              provider={context.provider}
              finding={context.finding}
              storyline={context.storyline}
              navigation={context.navigation}
            />
          </div>

          {/* Right top: Network Graph */}
          <div className="bg-[var(--vt-surface)]">
            {context?.provider ? (
              <NetworkGraphPanel
                provider={context.provider}
                focusNodeId={graphSelection.selectedNodeId}
                highlightNodeIds={context.uiHints?.highlightNodeIds ?? []}
                selectedFindingId={context.finding?.id ?? null}
                selectedStorylineId={context.storyline?.id ?? null}
                onFocusNode={(nodeId) => setGraphSelection((current) => ({
                  ...current,
                  selectedNodeId: nodeId || current.selectedNodeId,
                }))}
                onSnapshotChange={setGraphSelection}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vt-text-3)]">No provider selected</div>
            )}
          </div>

          {/* Center bottom: Evidence Viewer */}
          <div className="bg-[var(--vt-surface)] overflow-hidden">
            {context.finding && context.finding.evidence.length > 0 ? (
              <div className="h-full overflow-y-auto p-3">
                <EvidenceViewerPanel
                  evidence={context.finding.evidence}
                  findingId={context.finding.id}
                  selectedEvidenceIndex={selectedEvidenceIndex}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vt-text-3)]">
                {context.finding
                  ? 'No evidence is attached to this finding yet.'
                  : 'No finding context resolved yet.'}
              </div>
            )}
          </div>

          {/* Right bottom: Copilot */}
          <div className="bg-[var(--vt-surface)]">
            {providerNpi && copilotContext ? (
              <CopilotPanel
                npi={providerNpi}
                findingId={context.finding?.id ?? null}
                storylineId={context.storyline?.id ?? null}
                context={copilotContext}
                accessMode={context.accessMode ?? 'full'}
                promptSeed={context.uiHints?.copilotPrompt ?? null}
                summary={context.uiHints?.copilotSummary ?? null}
                collapsed={copilotCollapsed}
                onToggle={() => setCopilotCollapsed(c => !c)}
                onSelectFinding={handleSelectFinding}
                onSelectStoryline={handleSelectStoryline}
                onFocusGraphNode={(nodeId) => setGraphSelection((current) => ({
                  ...current,
                  selectedNodeId: nodeId,
                }))}
                onHighlightGraphNode={(nodeId) => setGraphSelection((current) => ({
                  ...current,
                  selectedNodeId: nodeId,
                }))}
                onOpenEvidence={handleOpenEvidence}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vt-text-3)]">Copilot ready</div>
            )}
          </div>
        </div>
      ) : null}
    </OperationsShell>
  );
}
