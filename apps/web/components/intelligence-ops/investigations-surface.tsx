'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraph } from '@/hooks/useGraph';
import { useFindings } from '@/hooks/useFindings';
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

interface LivePrimerFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  summary: string;
  priorityScore: number;
  providerNpi: string | null;
  providerLabel: string | null;
  storylineId: string | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function trustBandTone(band: string): 'success' | 'warning' | 'critical' | 'neutral' {
  switch (band?.toUpperCase()) {
    case 'HIGH': case 'L3': return 'success';
    case 'MEDIUM': case 'L2': return 'neutral';
    case 'LOW': case 'L1': return 'warning';
    case 'CRITICAL': case 'L0': return 'critical';
    default: return 'neutral';
  }
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">{value}</p>
    </div>
  );
}

// ── Left Panel: Findings Inbox ────────────────────────────────────────────────

function FindingsInbox({
  findings,
  selectedId,
  onSelect,
  provider,
  navigation,
}: {
  findings: WorkbenchRelatedFinding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  provider: WorkbenchProviderContext | null;
  navigation: WorkbenchNavigation | null;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <p className="shrink-0 px-3 py-2 text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">
        Findings ({findings.length})
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {findings.length === 0 ? (
          <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Current scope</p>
            <p className="mt-2 text-sm font-medium text-[var(--vt-text-1)]">
              {provider
                ? `${provider.label ?? `Provider ${provider.npi}`} has no additional linked findings in this slice.`
                : 'The current investigation scope has no linked findings yet.'}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--vt-text-2)]">
              {provider
                ? `${provider.activeFindings} active finding${provider.activeFindings === 1 ? '' : 's'} remain on the provider record. Use the graph or provider profile to widen the scope.`
                : 'Select a provider-backed finding or widen the graph scope to pull more evidence into the rail.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {provider ? <EntityLink href={`/providers/${provider.npi}`} label="Provider profile" /> : null}
              {provider ? <EntityLink href={buildIntelligenceHref('findings', { provider: provider.npi })} label="Provider findings" /> : null}
              {navigation?.graphHref ? <EntityLink href={navigation.graphHref} label="Open graph" /> : null}
            </div>
          </div>
        ) : null}
        {findings.map((f) => (
          <div
            key={f.id}
            className={`rounded-xl border p-2.5 transition ${
              selectedId === f.id
                ? 'border-cyan-400/50 bg-cyan-400/5'
                : 'border-[var(--vt-border)] bg-[var(--vt-surface)] hover:border-[var(--vt-text-3)]/30'
            }`}
          >
            <button onClick={() => onSelect(f.id)} className="w-full text-left">
              <div className="flex items-center gap-1.5">
                <OpsBadge label={f.severity} tone={severityTone(f.severity)} />
                <span className="text-[10px] text-[var(--vt-text-3)]">{f.findingType.replace(/_/g, ' ')}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-medium text-[var(--vt-text-1)]">{f.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-5 text-[var(--vt-text-3)]">{f.summary}</p>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <EntityLink href={f.href} label="Investigate" />
              <EntityLink href={`/findings/${f.id}`} label="Open detail" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveScopePrimer({
  findings,
  providers,
  loading,
  onSelectFinding,
  onSelectProvider,
}: {
  findings: LivePrimerFinding[];
  providers: Array<{ npi: string; name: string; trustScore: number; risk: string; summary: string }>;
  loading: boolean;
  onSelectFinding: (findingId: string) => void;
  onSelectProvider: (npi: string) => void;
}) {
  const headline = findings[0]?.providerLabel ?? providers[0]?.name ?? 'live investigation scope';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <OpsCard className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Live launch point</p>
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">
            {loading ? 'Locking onto the highest-signal live scope' : `Prime scope: ${headline}`}
          </h2>
          <p className="text-sm leading-6 text-[var(--vt-text-2)]">
            The workbench auto-seeds from the live findings and provider feeds. You can take control immediately by selecting a finding or provider below.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Live findings</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--vt-text-1)]">{findings.length}</p>
            <p className="mt-1 text-xs text-[var(--vt-text-2)]">Highest-signal rows ready to investigate.</p>
          </div>
          <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Live providers</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--vt-text-1)]">{providers.length}</p>
            <p className="mt-1 text-xs text-[var(--vt-text-2)]">Available as provider-backed pivots for the workbench.</p>
          </div>
        </div>
      </OpsCard>

      <OpsCard className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Immediate actions</p>
          <p className="text-sm text-[var(--vt-text-2)]">Jump into a live finding or hard-scope the workbench to a provider.</p>
        </div>

        {findings.length > 0 ? (
          <div className="space-y-2">
            {findings.slice(0, 3).map((finding) => (
              <button
                key={finding.id}
                type="button"
                onClick={() => onSelectFinding(finding.id)}
                className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2.5 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/5"
              >
                <div className="flex items-center gap-2">
                  <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-3)]">
                    {finding.findingType.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{finding.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{finding.summary}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 text-sm text-[var(--vt-text-2)]">
            No findings are active in the live feed right now. Use a provider scope below to inspect current graph and trust posture directly.
          </div>
        )}

        {providers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {providers.slice(0, 4).map((provider) => (
              <button
                key={provider.npi}
                type="button"
                onClick={() => onSelectProvider(provider.npi)}
                className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:border-cyan-400/30 hover:text-[var(--vt-text-1)]"
              >
                {provider.name} · {provider.trustScore}
              </button>
            ))}
          </div>
        ) : null}
      </OpsCard>
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
  relatedFindings,
}: {
  anchor: WorkbenchContext['anchor'];
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  navigation: WorkbenchNavigation | null;
  relatedFindings: WorkbenchRelatedFinding[];
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Provider context</p>
            <h3 className="text-base font-semibold text-[var(--vt-text-1)]">
              {provider?.label ?? (anchor.npi ? `NPI ${anchor.npi}` : 'Investigation scope')}
            </h3>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--vt-text-3)]">
              {provider?.specialty ? <span>{provider.specialty}</span> : null}
              {provider?.state ? <span>{provider.state}</span> : null}
              {provider?.npi ? <span>NPI {provider.npi}</span> : null}
              {finding ? <span>{finding.severity} finding selected</span> : null}
              {storyline ? <span>{storyline.findingCount} findings in storyline</span> : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {provider ? (
              <>
                <OpsBadge label={provider.trustBand} tone={trustBandTone(provider.trustBand)} />
                <span className="text-xs tabular-nums text-[var(--vt-text-3)]">score {provider.trustScore}</span>
              </>
            ) : (
              <OpsBadge label="scope" tone="neutral" />
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active findings" value={provider ? String(provider.activeFindings) : String(anchor.findingId ? 1 : 0)} />
          <MetricCard label="Selected evidence" value={finding ? String(finding.evidence.length) : storyline ? String(storyline.evidence.length) : '0'} />
          <MetricCard label="Storyline confidence" value={storyline ? `${Math.round(storyline.confidence * 100)}%` : '0%'} />
          <MetricCard label="Related findings" value={String(relatedFindings.length)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {provider ? <EntityLink href={`/providers/${provider.npi}`} label="Profile" /> : null}
          {provider ? <EntityLink href={buildIntelligenceHref('dashboard', { npi: provider.npi, panel: 'graph' })} label="Graph" /> : null}
          {navigation?.investigationHref ? <EntityLink href={navigation.investigationHref} label="Workbench" /> : null}
          {navigation?.copilotHref ? <EntityLink href={navigation.copilotHref} label="Copilot" /> : null}
        </div>
      </div>

      {finding ? (
        <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Finding</p>
            <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
            <OpsBadge label={finding.findingType.replace(/_/g, ' ')} />
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{finding.title}</h4>
          <p className="mt-2 text-xs leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
          <p className="mt-2 text-xs leading-6 text-[var(--vt-text-3)]">{finding.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <EntityLink href={`/findings/${finding.id}`} label="Open finding" />
            {finding.storylineId ? (
              <EntityLink href={`/storylines/${finding.storylineId}`} label={finding.storylineTitle ?? 'Open storyline'} />
            ) : null}
          </div>
        </div>
      ) : null}

      {storyline ? (
        <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Storyline</p>
            <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
            <OpsBadge label={storyline.status} />
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{storyline.title}</h4>
          <p className="mt-2 text-xs leading-6 text-[var(--vt-text-2)]">{storyline.whyItMatters}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--vt-text-3)]">
            <span>{storyline.findingCount} findings</span>
            <span>{Math.round(storyline.confidence * 100)}% confidence</span>
            <span>{storyline.entityCount} entities</span>
          </div>
          {storyline.recommendedActions.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {storyline.recommendedActions.slice(0, 3).map((a, i) => (
                <p key={i} className="text-xs leading-5 text-[var(--vt-text-2)]">→ {a}</p>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <EntityLink href={`/storylines/${storyline.id}`} label="Open storyline" />
          </div>
        </div>
      ) : null}

      {navigation?.graphHref ? (
        <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Graph scope</p>
          <p className="mt-2 text-sm font-medium text-[var(--vt-text-1)]">
            {provider ? 'The active provider, finding, and storyline are wired into the graph.' : 'Open the graph to pivot into the current investigation scope.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <EntityLink href={navigation.graphHref} label="Open graph" />
          </div>
        </div>
      ) : null}
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
  scopeLabel = 'Live scope',
  findingId,
  storylineId,
  context,
  promptSeed,
  summary,
  onSelectFinding,
  onSelectStoryline,
  onFocusGraphNode,
  onHighlightGraphNode,
  onOpenEvidence,
}: {
  npi: string | null;
  scopeLabel?: string;
  findingId: string | null;
  storylineId: string | null;
  context: CopilotContextPayload;
  promptSeed: string | null;
  summary: string | null;
  onSelectFinding: (findingId: string) => void;
  onSelectStoryline: (storylineId: string) => void;
  onFocusGraphNode: (nodeId: string) => void;
  onHighlightGraphNode: (nodeId: string) => void;
  onOpenEvidence: (findingId: string, evidenceIndex: number | null) => void;
}) {
  const contextParts: string[] = [npi ? `NPI ${npi}` : scopeLabel];
  if (findingId) contextParts.push(`finding`);
  if (storylineId) contextParts.push(`storyline`);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)]">
      <div className="shrink-0 border-b border-[var(--vt-border)] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Copilot</p>
            <p className="text-sm font-semibold text-[var(--vt-text-1)]">Ask against live provider, finding, and graph context</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
              {contextParts.join(' · ')}
            </span>
          </div>
        </div>
        {summary ? (
          <p className="mt-2 text-xs leading-5 text-[var(--vt-text-3)]">{summary}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <CopilotSearchBar
          compact
          sessionId={`inv_${(npi ?? scopeLabel).replace(/\s+/g, '_').toLowerCase()}`}
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
  const autoSeedSignatureRef = useRef<string | null>(null);

  const [npiInput, setNpiInput] = useState(seededNpi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHref, setErrorHref] = useState<string | null>(null);
  const [context, setContext] = useState<WorkbenchContext | null>(null);
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
  const liveFindings = useFindings({
    limit: 12,
    pollIntervalMs: 20_000,
    paused: Boolean(context && !error),
  });
  const liveProviders = useProviders({
    limit: 8,
    pollIntervalMs: 45_000,
  });

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

  const primerFindings = useMemo<LivePrimerFinding[]>(() => (
    (liveFindings.data?.findings ?? []).map((finding) => ({
      id: finding.id,
      findingType: finding.findingType,
      title: finding.title,
      severity: finding.severity,
      summary: finding.summary,
      priorityScore: finding.priorityScore,
      providerNpi: finding.providerNpi,
      providerLabel: finding.providerLabel,
      storylineId: finding.storylineId,
    }))
  ), [liveFindings.data?.findings]);
  const primerProviders = useMemo(() => (
    (liveProviders.data?.providers ?? []).map((provider) => ({
      npi: provider.npi,
      name: provider.name,
      trustScore: provider.trustScore,
      risk: provider.risk,
      summary: provider.summary,
    }))
  ), [liveProviders.data?.providers]);
  const primerAnchor = useMemo<InvestigationWorkbenchAnchorInput | null>(() => {
    const firstFinding = primerFindings.find((finding) => finding.providerNpi);
    if (firstFinding?.providerNpi) {
      return {
        npi: firstFinding.providerNpi,
        findingId: firstFinding.id,
        storylineId: firstFinding.storylineId,
      };
    }

    const firstProvider = primerProviders[0];
    if (firstProvider?.npi) {
      return { npi: firstProvider.npi };
    }

    return null;
  }, [primerFindings, primerProviders]);

  useEffect(() => {
    if (hasAnchor || context || loading || error || !primerAnchor) {
      return;
    }

    const signature = JSON.stringify(primerAnchor);
    if (autoSeedSignatureRef.current === signature) {
      return;
    }

    autoSeedSignatureRef.current = signature;
    void fetchWorkbench(primerAnchor);
  }, [context, error, fetchWorkbench, hasAnchor, loading, primerAnchor]);

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
    const liveFinding = primerFindings.find((finding) => finding.id === id);
    const providerNpi = context?.provider?.npi
      ?? liveFinding?.providerNpi
      ?? null;
    void fetchWorkbench({
      npi: providerNpi ?? undefined,
      findingId: id,
      storylineId: liveFinding?.storylineId ?? undefined,
    });
  }, [context, fetchWorkbench, primerFindings]);

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
  const railFindings = useMemo<WorkbenchRelatedFinding[]>(() => {
    if (context) {
      const seenIds = new Set<string>();
      const prioritized: WorkbenchRelatedFinding[] = [];

      if (context.finding) {
        prioritized.push({
          id: context.finding.id,
          findingType: context.finding.findingType,
          title: context.finding.title,
          severity: context.finding.severity,
          summary: context.finding.summary,
          priorityScore: context.finding.priorityScore,
          href: buildIntelligenceHref('investigations', {
            npi: context.provider?.npi ?? context.anchor.npi,
            findingId: context.finding.id,
            storylineId: context.finding.storylineId ?? undefined,
          }),
        });
        seenIds.add(context.finding.id);
      }

      for (const finding of context.relatedFindings) {
        if (seenIds.has(finding.id)) {
          continue;
        }
        prioritized.push(finding);
        seenIds.add(finding.id);
      }

      return prioritized;
    }

    return primerFindings.map((finding) => ({
      id: finding.id,
      findingType: finding.findingType,
      title: finding.title,
      severity: finding.severity,
      summary: finding.summary,
      priorityScore: finding.priorityScore,
      href: buildIntelligenceHref('investigations', {
        npi: finding.providerNpi ?? undefined,
        findingId: finding.id,
        storylineId: finding.storylineId ?? undefined,
      }),
    }));
  }, [context, primerFindings]);

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
      description="Three-panel investigation surface with live findings, provider context, graph intelligence, and copilot actions in a single operator lane."
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

      {!context ? (
        <LiveScopePrimer
          findings={primerFindings}
          providers={primerProviders}
          loading={loading || (liveFindings.loading && primerFindings.length === 0)}
          onSelectFinding={handleSelectFinding}
          onSelectProvider={(npi) => {
            setNpiInput(npi);
            void fetchWorkbench({ npi });
          }}
        />
      ) : null}

      {/* Three-panel grid */}
      {context ? (
        <div
          className="grid gap-px overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-border)]"
          style={{
            gridTemplateColumns: '320px minmax(0, 1fr) 400px',
            minHeight: '720px',
            height: 'calc(100vh - 280px)',
          }}
        >
          {/* Left: Findings Inbox */}
          <div className="min-h-0 bg-[var(--vt-surface)]">
            <FindingsInbox
              findings={railFindings}
              selectedId={selectedFindingId}
              onSelect={handleSelectFinding}
              provider={context.provider}
              navigation={context.navigation}
            />
          </div>

          {/* Center: Provider context + evidence */}
          <div className="flex min-h-0 flex-col bg-[var(--vt-surface)]">
            <div className="min-h-0 flex-1 overflow-hidden border-b border-[var(--vt-border)]">
              <ProviderInvestigationPanel
                anchor={context.anchor}
                provider={context.provider}
                finding={context.finding}
                storyline={context.storyline}
                navigation={context.navigation}
                relatedFindings={railFindings}
              />
            </div>
            <div className="min-h-[260px] max-h-[340px] overflow-hidden">
              {context.finding && context.finding.evidence.length > 0 ? (
                <div className="h-full overflow-y-auto p-3">
                  <EvidenceViewerPanel
                    evidence={context.finding.evidence}
                    findingId={context.finding.id}
                    selectedEvidenceIndex={selectedEvidenceIndex}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Evidence rail</p>
                    <p className="text-sm font-medium text-[var(--vt-text-1)]">
                      {context.finding
                        ? 'This finding does not have an evidence bundle attached yet.'
                        : 'Select a finding to load its evidence stream into the center panel.'}
                    </p>
                    <p className="text-xs leading-5 text-[var(--vt-text-3)]">
                      {railFindings[0]
                        ? 'Related findings stay live in the left rail while the evidence rail stays anchored to the current scope.'
                        : 'The current scope is already exhausting the live feed.'}
                    </p>
                  </div>
                  {railFindings[0] ? <EntityLink href={railFindings[0].href} label="Open top finding" /> : null}
                </div>
              )}
            </div>
          </div>

          {/* Right: Graph + Copilot */}
          <div className="grid min-h-0 grid-rows-[minmax(320px,1fr)_minmax(280px,0.92fr)] bg-[var(--vt-surface)]">
            <div className="min-h-0 border-b border-[var(--vt-border)]">
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
                <div className="flex h-full items-center justify-center p-4 text-xs text-[var(--vt-text-3)]">
                  Open a provider-backed finding to hydrate the graph rail.
                </div>
              )}
            </div>
            <div className="min-h-0 overflow-hidden">
              {copilotContext ? (
                <CopilotPanel
                  npi={providerNpi ?? context.anchor.npi ?? null}
                  scopeLabel={context.provider?.label ?? context.storyline?.title ?? context.finding?.title ?? 'Current scope'}
                  findingId={context.finding?.id ?? null}
                  storylineId={context.storyline?.id ?? null}
                  context={copilotContext}
                  promptSeed={context.uiHints?.copilotPrompt ?? null}
                  summary={context.uiHints?.copilotSummary ?? null}
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
                <div className="flex h-full items-center justify-center p-4 text-xs text-[var(--vt-text-3)]">
                  Copilot is ready once a live scope is selected.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </OperationsShell>
  );
}
