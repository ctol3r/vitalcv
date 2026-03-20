'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { Bot, Command, ExternalLink, Link2, Network, ShieldCheck } from 'lucide-react';
import { CommandPalette } from '@/components/command/command-palette';
import { CopilotPanel } from '@/components/intelligence/CopilotPanel';
import { GraphWorkbenchPanel } from '@/components/intelligence-ops/graph-workbench-panel';
import { CanvasDecisionBlock } from '@/components/intelligence-ops/canvas-decision-block';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import {
  useActionDetail,
  useFindingDetail,
  useProviderDetail,
  useStorylineDetail,
} from '@/hooks/useIntelligenceDetail';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type {
  IntelligenceAction,
  IntelligenceFinding,
  IntelligenceProvider,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import { computeProviderView } from '@/lib/intelligence/contracts';
import { buildFindingEvidenceRows } from '@/lib/intelligence/evidence';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
import { formatRelativeTime } from '@/lib/intelligence/time';
import { type OSMode, useWorkspace } from '@/lib/intelligence/workspace-store';
import {
  type IntelligenceFocus,
  type EvidenceDensity,
  type EvidenceGroup,
  type EvidenceSort,
  useInvestigationContextStore,
} from '@/stores/investigation-context';

type QueueItemKind = 'finding' | 'storyline' | 'action' | 'provider';

interface QueueItem {
  id: string;
  key: string;
  kind: QueueItemKind;
  title: string;
  summary: string;
  severity: string;
  updatedAt: string;
  priorityScore: number;
  providerId: string | null;
  storylineId: string | null;
  findingId: string | null;
  actionId: string | null;
}

interface EvidenceEntry {
  id: string;
  sourceName: string;
  evidenceType: string;
  timestamp: string | null;
  summary: string;
  fields: Array<{ label: string; value: string }>;
  confidence: number | null;
  relevance: number | null;
  originLabel: string;
  originKind: 'finding' | 'storyline' | 'action';
}

const MODE_TABS: Array<{ id: OSMode; label: string; focus: string }> = [
  { id: 'monitor', label: 'Monitor', focus: 'dashboard' },
  { id: 'investigate', label: 'Investigate', focus: 'investigations' },
  { id: 'decide', label: 'Decide', focus: 'actions' },
];

function severityTone(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    default:
      return 'neutral';
  }
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function providerFromDetail(
  detail: ReturnType<typeof useProviderDetail>['data'],
): IntelligenceProvider | null {
  if (!detail) {
    return null;
  }

  return computeProviderView({
    id: detail.provider.npi,
    npi: detail.provider.npi,
    name: detail.provider.fullName,
    specialties: detail.provider.specialties,
    credentialHealth: detail.profile.status === 'CLEARED' ? 'VERIFIED' : 'PENDING',
    trustScore: detail.provider.trustScore,
    readinessScore: detail.provider.readinessScore,
    activeCredentials: detail.provider.activeCredentialCount,
    credentialCount: detail.provider.totalCredentialCount,
    primaryIssuer: detail.credentials[0]?.issuer ?? null,
    lastVerifiedAt: detail.profile.lastAnchored,
    summary: detail.signals?.summary
      ?? `${detail.provider.findingCount} findings · ${detail.provider.activeStorylineCount} active storylines`,
    tags: detail.provider.specialties.slice(0, 4),
  });
}

function buildQueueItems(input: {
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  actions: IntelligenceAction[];
  providers: IntelligenceProvider[];
}): QueueItem[] {
  const items: QueueItem[] = [];

  for (const finding of input.findings) {
    items.push({
      id: finding.id,
      key: `finding:${finding.id}`,
      kind: 'finding',
      title: finding.title,
      summary: finding.explanation || finding.summary,
      severity: finding.severity,
      updatedAt: finding.updatedAt,
      priorityScore: Math.round(finding.priorityScore),
      providerId: finding.providerNpi,
      storylineId: finding.storylineId,
      findingId: finding.id,
      actionId: null,
    });
  }

  for (const storyline of input.storylines) {
    items.push({
      id: storyline.id,
      key: `storyline:${storyline.id}`,
      kind: 'storyline',
      title: storyline.title,
      summary: storyline.whyItMatters || storyline.summary,
      severity: storyline.severity,
      updatedAt: storyline.lastActivityAt,
      priorityScore: Math.round(storyline.progressionScore * 100),
      providerId: storyline.providerNpi,
      storylineId: storyline.id,
      findingId: null,
      actionId: null,
    });
  }

  for (const action of input.actions) {
    items.push({
      id: action.id,
      key: `action:${action.id}`,
      kind: 'action',
      title: action.title,
      summary: action.explanation,
      severity: action.priority.toLowerCase(),
      updatedAt: action.createdAt,
      priorityScore: Math.round(action.priorityScore),
      providerId: action.providerNpi,
      storylineId: null,
      findingId: action.sourceFindingIds[0] ?? null,
      actionId: action.id,
    });
  }

  for (const provider of input.providers) {
    if (provider.trustScore >= 75 && provider.risk === 'healthy') {
      continue;
    }

    items.push({
      id: provider.npi,
      key: `provider:${provider.npi}`,
      kind: 'provider',
      title: provider.name,
      summary: provider.summary,
      severity: provider.risk === 'critical' ? 'critical' : 'high',
      updatedAt: provider.lastVerifiedAt ?? new Date().toISOString(),
      priorityScore: 100 - provider.trustScore,
      providerId: provider.npi,
      storylineId: null,
      findingId: null,
      actionId: null,
    });
  }

  return items
    .sort((left, right) => (
      right.priorityScore - left.priorityScore
      || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    ))
    .slice(0, 40);
}

function BacklinkButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-2)] transition hover:border-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">{value}</p>
    </div>
  );
}

function QueueCard({
  item,
  active,
  selected,
  onOpen,
  onHover,
}: {
  item: QueueItem;
  active: boolean;
  selected: boolean;
  onOpen: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onOpen}
      className={`w-full rounded-sm border p-3 text-left transition ${
        selected
          ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg'
          : active
            ? 'border-[var(--vt-border)] bg-[var(--vt-surface)]'
            : 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] hover:border-[var(--vt-text-3)]'
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
        <span className="rounded-full border border-[var(--vt-border)] px-2 py-0.5">
          {item.kind}
        </span>
        <span className={item.severity === 'critical' ? 'text-rose-300' : item.severity === 'high' ? 'text-amber-300' : 'text-[var(--vt-text-3)]'}>
          {item.severity}
        </span>
        <span className="ml-auto font-mono">{formatRelativeTime(item.updatedAt)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{item.title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)]">{item.summary}</p>
    </button>
  );
}

function EvidenceToolbar({
  sort,
  group,
  density,
  onSort,
  onGroup,
  onDensity,
}: {
  sort: EvidenceSort;
  group: EvidenceGroup;
  density: EvidenceDensity;
  onSort: (sort: EvidenceSort) => void;
  onGroup: (group: EvidenceGroup) => void;
  onDensity: (density: EvidenceDensity) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSort(sort === 'newest' ? 'strongest' : 'newest')}
        className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-2)]"
      >
        Sort: {sort}
      </button>
      <button
        type="button"
        onClick={() => onGroup(group === 'none' ? 'source' : 'none')}
        className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-2)]"
      >
        Group: {group}
      </button>
      <button
        type="button"
        onClick={() => onDensity(density === 'expanded' ? 'compact' : 'expanded')}
        className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-2)]"
      >
        Density: {density}
      </button>
    </div>
  );
}

function EvidencePanel({
  items,
  selectedEvidence,
  sort,
  group,
  density,
  onSelect,
  onSort,
  onGroup,
  onDensity,
}: {
  items: EvidenceEntry[];
  selectedEvidence: string | null;
  sort: EvidenceSort;
  group: EvidenceGroup;
  density: EvidenceDensity;
  onSelect: (id: string) => void;
  onSort: (sort: EvidenceSort) => void;
  onGroup: (group: EvidenceGroup) => void;
  onDensity: (density: EvidenceDensity) => void;
}) {
  const orderedItems = useMemo(() => {
    const next = [...items];
    next.sort((left, right) => {
      if (sort === 'strongest') {
        return (right.confidence ?? right.relevance ?? 0) - (left.confidence ?? left.relevance ?? 0)
          || Date.parse(right.timestamp ?? '') - Date.parse(left.timestamp ?? '');
      }

      return Date.parse(right.timestamp ?? '') - Date.parse(left.timestamp ?? '')
        || (right.confidence ?? right.relevance ?? 0) - (left.confidence ?? left.relevance ?? 0);
    });
    return next;
  }, [items, sort]);

  const grouped = useMemo(() => {
    if (group === 'none') {
      return [{ label: 'Evidence', items: orderedItems }];
    }

    const bucket = new Map<string, EvidenceEntry[]>();
    for (const item of orderedItems) {
      const key = item.sourceName || 'Unknown source';
      const groupItems = bucket.get(key) ?? [];
      groupItems.push(item);
      bucket.set(key, groupItems);
    }

    return [...bucket.entries()].map(([label, groupItems]) => ({ label, items: groupItems }));
  }, [group, orderedItems]);

  return (
    <section className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Evidence</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--vt-text-1)]">Attached records</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--vt-text-2)]">
            Source-backed evidence for the active provider, finding, storyline, or action.
          </p>
        </div>
        <Link2 className="h-4 w-4 text-[var(--vt-text-3)]" />
      </div>

      <div className="mt-4">
        <EvidenceToolbar
          sort={sort}
          group={group}
          density={density}
          onSort={onSort}
          onGroup={onGroup}
          onDensity={onDensity}
        />
      </div>

      {orderedItems.length === 0 ? (
        <div className="mt-4 rounded-sm border border-dashed border-[var(--vt-border)] px-4 py-6 text-sm text-[var(--vt-text-3)]">
          Evidence not yet attached to this case
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {grouped.map((bucket) => (
            <div key={bucket.label} className="space-y-2">
              {group === 'source' ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
                  {bucket.label}
                </p>
              ) : null}
              {bucket.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`w-full rounded-sm border p-3 text-left transition ${
                    selectedEvidence === item.id
                      ? 'border-cyan-400/40 bg-cyan-400/10'
                      : 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] hover:border-[var(--vt-text-3)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                    <span>{item.originKind}</span>
                    <span>{item.evidenceType}</span>
                    {item.timestamp ? <span className="ml-auto font-mono">{formatRelativeTime(item.timestamp)}</span> : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">{item.sourceName}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--vt-text-2)]">{item.summary}</p>
                  {density === 'expanded' ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {item.fields.slice(0, 4).map((field) => (
                        <div key={`${item.id}:${field.label}`} className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{field.label}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--vt-text-1)]">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--vt-text-3)]">
                    <span>Origin: {item.originLabel}</span>
                    {item.confidence !== null ? <span>Confidence {Math.round(item.confidence * 100)}%</span> : null}
                    {item.relevance !== null ? <span>Relevance {Math.round(item.relevance * 100)}%</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function IntelligenceOS() {
  const { state, push } = useWorkspace();
  const queueCursor = useInvestigationContextStore((store) => store.queueCursor);
  const evidenceSort = useInvestigationContextStore((store) => store.evidenceSort);
  const evidenceGroup = useInvestigationContextStore((store) => store.evidenceGroup);
  const evidenceDensity = useInvestigationContextStore((store) => store.evidenceDensity);
  const setQueueCursor = useInvestigationContextStore((store) => store.setQueueCursor);
  const setEvidence = useInvestigationContextStore((store) => store.setEvidence);
  const setEvidenceSort = useInvestigationContextStore((store) => store.setEvidenceSort);
  const setEvidenceGroup = useInvestigationContextStore((store) => store.setEvidenceGroup);
  const setEvidenceDensity = useInvestigationContextStore((store) => store.setEvidenceDensity);
  const pinEntity = useInvestigationContextStore((store) => store.pinEntity);
  const unpinEntity = useInvestigationContextStore((store) => store.unpinEntity);
  const resetFocus = useInvestigationContextStore((store) => store.resetFocus);

  const feedFindings = useFindings({ limit: 20, pollIntervalMs: 30_000 });
  const feedStorylines = useStorylines({ limit: 10, pollIntervalMs: 45_000 });
  const feedActions = useActions({ limit: 12, pollIntervalMs: 45_000 });
  const feedProviders = useProviders({ limit: 12, pollIntervalMs: 45_000 });
  const scopedFindings = useFindings({ provider: state.npi, limit: 50, pollIntervalMs: 30_000 });
  const scopedStorylines = useStorylines({ provider: state.npi, limit: 20, pollIntervalMs: 45_000 });
  const scopedActions = useActions({ entity: state.npi, limit: 20, pollIntervalMs: 45_000 });
  const providerDetail = useProviderDetail(state.npi, { paused: !state.npi, pollIntervalMs: 45_000 });
  const findingDetail = useFindingDetail(state.findingId, { paused: !state.findingId, pollIntervalMs: 30_000 });
  const storylineDetail = useStorylineDetail(state.storylineId, { paused: !state.storylineId, pollIntervalMs: 45_000 });
  const actionDetail = useActionDetail(state.actionId, { paused: !state.actionId, pollIntervalMs: 45_000 });
  const systemHealth = useSystemHealth(60_000);

  const providerPool = useMemo(() => dedupeById([
    ...(feedProviders.data?.providers ?? []),
    ...(providerFromDetail(providerDetail.data) ? [providerFromDetail(providerDetail.data)!] : []),
  ]), [feedProviders.data?.providers, providerDetail.data]);

  const selectedProvider = useMemo(
    () => providerPool.find((provider) => provider.npi === state.npi) ?? null,
    [providerPool, state.npi],
  );

  const findingPool = useMemo(() => dedupeById([
    ...(feedFindings.data?.findings ?? []),
    ...(scopedFindings.data?.findings ?? []),
  ]), [feedFindings.data?.findings, scopedFindings.data?.findings]);

  const storylinePool = useMemo(() => dedupeById([
    ...(feedStorylines.data?.storylines ?? []),
    ...(scopedStorylines.data?.storylines ?? []),
  ]), [feedStorylines.data?.storylines, scopedStorylines.data?.storylines]);

  const actionPool = useMemo(() => dedupeById([
    ...(feedActions.data?.actions ?? []),
    ...(scopedActions.data?.actions ?? []),
  ]), [feedActions.data?.actions, scopedActions.data?.actions]);

  const selectedFinding = useMemo(
    () => findingPool.find((finding) => finding.id === state.findingId) ?? null,
    [findingPool, state.findingId],
  );

  const selectedStoryline = useMemo(
    () => storylinePool.find((storyline) => storyline.id === state.storylineId)
      ?? (selectedFinding?.storylineId
        ? storylinePool.find((storyline) => storyline.id === selectedFinding.storylineId) ?? null
        : null),
    [selectedFinding?.storylineId, state.storylineId, storylinePool],
  );

  const selectedAction = useMemo(
    () => actionPool.find((action) => action.id === state.actionId) ?? null,
    [actionPool, state.actionId],
  );

  const queueItems = useMemo(
    () => buildQueueItems({
      findings: feedFindings.data?.findings ?? [],
      storylines: feedStorylines.data?.storylines ?? [],
      actions: feedActions.data?.actions ?? [],
      providers: feedProviders.data?.providers ?? [],
    }),
    [
      feedActions.data?.actions,
      feedFindings.data?.findings,
      feedProviders.data?.providers,
      feedStorylines.data?.storylines,
    ],
  );

  useEffect(() => {
    if (queueItems.length === 0) {
      return;
    }

    if (!queueCursor || !queueItems.some((item) => item.key === queueCursor)) {
      setQueueCursor(queueItems[0]?.key ?? null);
    }
  }, [queueCursor, queueItems, setQueueCursor]);

  const graphScopeNpi = state.npi ?? selectedFinding?.providerNpi ?? selectedStoryline?.providerNpi ?? selectedAction?.providerNpi ?? null;
  const graph = useGraph({
    npi: graphScopeNpi,
    layer: 'blended',
    limit: graphScopeNpi ? 160 : 220,
    pollIntervalMs: 45_000,
  });

  const relatedFindings = useMemo(
    () => findingPool.filter((finding) => (
      finding.id !== selectedFinding?.id
      && (
        (selectedProvider && finding.providerNpi === selectedProvider.npi)
        || (selectedStoryline && selectedStoryline.findingIds.includes(finding.id))
        || (selectedAction && selectedAction.sourceFindingIds.includes(finding.id))
      )
    )).slice(0, 6),
    [findingPool, selectedAction, selectedFinding?.id, selectedProvider, selectedStoryline],
  );

  const relatedStorylines = useMemo(
    () => storylinePool.filter((storyline) => (
      storyline.id !== selectedStoryline?.id
      && (
        (selectedProvider && storyline.providerNpi === selectedProvider.npi)
        || (selectedFinding?.storylineId && storyline.id === selectedFinding.storylineId)
      )
    )).slice(0, 4),
    [selectedFinding?.storylineId, selectedProvider, selectedStoryline?.id, storylinePool],
  );

  const relatedActions = useMemo(
    () => actionPool.filter((action) => (
      action.id !== selectedAction?.id
      && (
        (selectedProvider && action.providerNpi === selectedProvider.npi)
        || (selectedFinding && action.sourceFindingIds.includes(selectedFinding.id))
        || (selectedStoryline && selectedStoryline.findingIds.some((findingId) => action.sourceFindingIds.includes(findingId)))
      )
    )).slice(0, 6),
    [actionPool, selectedAction?.id, selectedFinding, selectedProvider, selectedStoryline],
  );

  const evidenceEntries = useMemo(() => {
    const entries: EvidenceEntry[] = [];

    if (findingDetail.data) {
      const rows = buildFindingEvidenceRows(
        findingDetail.data.finding.supportingEvidence,
        findingDetail.data.finding.confidence,
        systemHealth.data,
      );

      for (const row of rows) {
        entries.push({
          id: row.id,
          sourceName: row.sourceName,
          evidenceType: row.field,
          timestamp: row.retrievedAt,
          summary: row.value,
          fields: [
            { label: 'Field', value: row.field },
            { label: 'Value', value: row.value },
            { label: 'Quality', value: row.qualityRating },
            { label: 'Provenance', value: row.provenanceChain.join(' -> ') },
          ],
          confidence: row.confidence,
          relevance: row.corroborationCount > 0 ? Math.min(1, row.corroborationCount / 5) : null,
          originLabel: findingDetail.data.finding.title,
          originKind: 'finding',
        });
      }
    } else if (selectedFinding) {
      for (const evidence of selectedFinding.evidence) {
        entries.push({
          id: evidence.id,
          sourceName: evidence.source ?? 'Unknown source',
          evidenceType: evidence.type ?? evidence.label,
          timestamp: evidence.observedAt,
          summary: evidence.snippet ?? selectedFinding.summary,
          fields: [
            { label: 'Type', value: evidence.type ?? evidence.label },
            { label: 'Excerpt', value: evidence.snippet ?? selectedFinding.summary },
          ],
          confidence: evidence.confidence ?? selectedFinding.confidence,
          relevance: evidence.relevance ?? null,
          originLabel: selectedFinding.title,
          originKind: 'finding',
        });
      }
    }

    if (storylineDetail.data) {
      for (const [index, evidence] of storylineDetail.data.storyline.supportingEvidence.entries()) {
        entries.push({
          id: `storyline:${index}`,
          sourceName: evidence.source,
          evidenceType: 'Storyline evidence',
          timestamp: evidence.observedAt,
          summary: evidence.bullet,
          fields: [
            { label: 'Excerpt', value: evidence.bullet },
            ...(evidence.findingId ? [{ label: 'Finding', value: evidence.findingId }] : []),
            ...(evidence.artifactId ? [{ label: 'Artifact', value: evidence.artifactId }] : []),
          ],
          confidence: evidence.confidence,
          relevance: null,
          originLabel: storylineDetail.data.storyline.title,
          originKind: 'storyline',
        });
      }
    } else if (selectedStoryline) {
      for (const evidence of selectedStoryline.evidence) {
        entries.push({
          id: evidence.id,
          sourceName: evidence.source ?? evidence.label,
          evidenceType: evidence.type ?? 'Storyline evidence',
          timestamp: evidence.observedAt,
          summary: evidence.snippet ?? selectedStoryline.summary,
          fields: [
            { label: 'Excerpt', value: evidence.snippet ?? selectedStoryline.summary },
          ],
          confidence: evidence.confidence ?? selectedStoryline.confidence,
          relevance: evidence.relevance ?? null,
          originLabel: selectedStoryline.title,
          originKind: 'storyline',
        });
      }
    }

    if (actionDetail.data) {
      for (const [index, evidence] of actionDetail.data.action.evidence.entries()) {
        entries.push({
          id: `action:${index}`,
          sourceName: evidence.source ?? 'Action evidence',
          evidenceType: evidence.label,
          timestamp: actionDetail.data.action.updatedAt,
          summary: evidence.snippet ?? actionDetail.data.action.explanation,
          fields: [
            { label: 'Label', value: evidence.label },
            { label: 'Excerpt', value: evidence.snippet ?? actionDetail.data.action.explanation },
          ],
          confidence: actionDetail.data.action.confidence,
          relevance: null,
          originLabel: actionDetail.data.action.recommendedAction,
          originKind: 'action',
        });
      }
    } else if (selectedAction) {
      for (const evidence of selectedAction.evidence) {
        entries.push({
          id: evidence.id,
          sourceName: evidence.source ?? 'Action evidence',
          evidenceType: evidence.type ?? evidence.label,
          timestamp: selectedAction.createdAt,
          summary: evidence.snippet ?? selectedAction.explanation,
          fields: [
            { label: 'Label', value: evidence.label },
            { label: 'Excerpt', value: evidence.snippet ?? selectedAction.explanation },
          ],
          confidence: evidence.confidence ?? selectedAction.confidence,
          relevance: evidence.relevance ?? null,
          originLabel: selectedAction.title,
          originKind: 'action',
        });
      }
    }

    if (entries.length === 0 && selectedProvider) {
      for (const finding of scopedFindings.data?.findings ?? []) {
        for (const evidence of finding.evidence) {
          entries.push({
            id: `${finding.id}:${evidence.id}`,
            sourceName: evidence.source ?? selectedProvider.name,
            evidenceType: evidence.type ?? evidence.label,
            timestamp: evidence.observedAt ?? finding.updatedAt,
            summary: evidence.snippet ?? finding.summary,
            fields: [
              { label: 'Finding', value: finding.title },
              { label: 'Type', value: evidence.type ?? evidence.label },
            ],
            confidence: evidence.confidence ?? finding.confidence,
            relevance: evidence.relevance ?? null,
            originLabel: finding.title,
            originKind: 'finding',
          });
        }
      }
    }

    return dedupeById(entries);
  }, [
    actionDetail.data,
    findingDetail.data,
    scopedFindings.data?.findings,
    selectedAction,
    selectedFinding,
    selectedProvider,
    selectedStoryline,
    storylineDetail.data,
    systemHealth.data,
  ]);

  const copilotSeed = useMemo(() => {
    if (selectedAction) {
      return {
        query: `Explain the decision context for ${selectedAction.title} and summarize the strongest supporting evidence.`,
        token: Date.parse(selectedAction.createdAt),
      };
    }

    if (selectedFinding) {
      return {
        query: `Explain the operational impact of finding ${selectedFinding.title} and recommend the next investigation step.`,
        token: Date.parse(selectedFinding.updatedAt),
      };
    }

    if (selectedStoryline) {
      return {
        query: `Summarize the storyline ${selectedStoryline.title} and explain how it changes provider trust.`,
        token: Date.parse(selectedStoryline.lastActivityAt),
      };
    }

    if (selectedProvider) {
      return {
        query: `Summarize the current trust posture for ${selectedProvider.name} (${selectedProvider.npi}).`,
        token: Date.parse(selectedProvider.lastVerifiedAt ?? new Date().toISOString()),
      };
    }

    return null;
  }, [selectedAction, selectedFinding, selectedProvider, selectedStoryline]);

  const openProvider = useCallback((providerId: string) => {
    push({
      focus: 'provider',
      mode: 'investigate',
      npi: providerId,
      openPanels: ['provider', 'graph', 'evidence', 'copilot'],
      graphFocus: providerId,
    });
  }, [push]);

  const openFinding = useCallback((findingId: string, options: { providerId?: string | null; storylineId?: string | null } = {}) => {
    const finding = findingPool.find((entry) => entry.id === findingId) ?? null;
    push({
      focus: 'finding',
      mode: 'investigate',
      npi: options.providerId ?? finding?.providerNpi ?? state.npi,
      findingId,
      storylineId: options.storylineId ?? finding?.storylineId ?? state.storylineId,
      actionId: relatedActions.find((action) => action.sourceFindingIds.includes(findingId))?.id ?? null,
      openPanels: ['provider', 'finding', 'storyline', 'graph', 'evidence', 'copilot'],
      graphFocus: findingId,
    });
  }, [findingPool, push, relatedActions, state.npi, state.storylineId]);

  const openStoryline = useCallback((storylineId: string, options: { providerId?: string | null } = {}) => {
    const storyline = storylinePool.find((entry) => entry.id === storylineId) ?? null;
    push({
      focus: 'storyline',
      mode: 'investigate',
      npi: options.providerId ?? storyline?.providerNpi ?? state.npi,
      findingId: storyline?.findingIds[0] ?? null,
      storylineId,
      actionId: relatedActions.find((action) => storyline?.findingIds.some((findingId) => action.sourceFindingIds.includes(findingId)))?.id ?? null,
      openPanels: ['provider', 'finding', 'storyline', 'graph', 'evidence', 'copilot'],
      graphFocus: storylineId,
    });
  }, [push, relatedActions, state.npi, storylinePool]);

  const openAction = useCallback((actionId: string, options: { providerId?: string | null; findingId?: string | null } = {}) => {
    const action = actionPool.find((entry) => entry.id === actionId) ?? null;
    push({
      focus: 'action',
      mode: 'decide',
      npi: options.providerId ?? action?.providerNpi ?? state.npi,
      findingId: options.findingId ?? action?.sourceFindingIds[0] ?? state.findingId,
      storylineId: selectedStoryline?.id ?? state.storylineId,
      actionId,
      openPanels: ['provider', 'finding', 'storyline', 'action', 'graph', 'evidence', 'copilot'],
      graphFocus: action?.providerNpi ?? options.providerId ?? state.npi,
    });
  }, [actionPool, push, selectedStoryline?.id, state.findingId, state.npi, state.storylineId]);

  const openQueueItem = useCallback((item: QueueItem) => {
    if (item.kind === 'provider' && item.providerId) {
      openProvider(item.providerId);
      return;
    }
    if (item.kind === 'finding' && item.findingId) {
      openFinding(item.findingId, {
        providerId: item.providerId,
        storylineId: item.storylineId,
      });
      return;
    }
    if (item.kind === 'storyline' && item.storylineId) {
      openStoryline(item.storylineId, { providerId: item.providerId });
      return;
    }
    if (item.kind === 'action' && item.actionId) {
      openAction(item.actionId, {
        providerId: item.providerId,
        findingId: item.findingId,
      });
    }
  }, [openAction, openFinding, openProvider, openStoryline]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        window.dispatchEvent(new Event('vital:open-command-palette'));
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        resetFocus();
        return;
      }

      if (queueItems.length === 0) {
        return;
      }

      const currentIndex = Math.max(0, queueItems.findIndex((item) => item.key === queueCursor));

      if (event.key === 'j') {
        event.preventDefault();
        const next = queueItems[Math.min(queueItems.length - 1, currentIndex + 1)];
        if (next) {
          setQueueCursor(next.key);
        }
        return;
      }

      if (event.key === 'k') {
        event.preventDefault();
        const next = queueItems[Math.max(0, currentIndex - 1)];
        if (next) {
          setQueueCursor(next.key);
        }
        return;
      }

      if (event.key === 'Enter') {
        const next = queueItems[currentIndex];
        if (next) {
          event.preventDefault();
          openQueueItem(next);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openQueueItem, queueCursor, queueItems, resetFocus, setQueueCursor]);

  const pinnedKeys = useMemo(
    () => new Set(state.pinnedEntities.map((entity) => `${entity.type}:${entity.id}`)),
    [state.pinnedEntities],
  );

  return (
    <>
      <CommandPalette />

      <div className="flex min-h-screen flex-col bg-[var(--vt-bg)] text-[var(--vt-text-1)]">
        <header className="flex h-12 shrink-0 items-center border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-4">
          <div className="mr-6 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">VitalCV OS</span>
          </div>

          <div className="flex h-full items-stretch">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => push({ mode: tab.id, focus: tab.focus as IntelligenceFocus })}
                className={`border-b-2 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                  state.mode === tab.id
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {selectedProvider ? (
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-mono text-cyan-200">
                {selectedProvider.name} · {selectedProvider.trustScore}
              </span>
            ) : null}
            <div className="hidden items-center gap-2 text-[10px] text-[var(--vt-text-3)] lg:flex">
              <kbd className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-1.5 py-0.5">j/k</kbd>
              <span>queue</span>
              <kbd className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-1.5 py-0.5">enter</kbd>
              <span>open</span>
              <kbd className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-1.5 py-0.5">esc</kbd>
              <span>reset</span>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('vital:open-command-palette'))}
              className="flex items-center gap-1.5 rounded border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2.5 py-1 text-[10px] text-[var(--vt-text-2)]"
            >
              <Command className="h-3.5 w-3.5" />
              Cmd+K
            </button>
          </div>
        </header>

        <div className="grid flex-1 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
          <aside className="border-r border-[var(--vt-border)] bg-[var(--vt-surface)]/70">
            <div className="flex items-center justify-between border-b border-[var(--vt-border)] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Live queue</p>
                <p className="mt-1 text-xs text-[var(--vt-text-3)]">{queueItems.length} live objects</p>
              </div>
              <Network className="h-4 w-4 text-[var(--vt-text-3)]" />
            </div>
            <div className="space-y-3 overflow-y-auto p-4">
              {queueItems.map((item) => (
                <QueueCard
                  key={item.key}
                  item={item}
                  active={queueCursor === item.key}
                  selected={Boolean(
                    (item.findingId && item.findingId === state.findingId)
                    || (item.storylineId && item.storylineId === state.storylineId)
                    || (item.actionId && item.actionId === state.actionId)
                    || (item.providerId && item.providerId === state.npi)
                  )}
                  onHover={() => setQueueCursor(item.key)}
                  onOpen={() => openQueueItem(item)}
                />
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto bg-[var(--vt-bg)]/40 p-4">
            <div className="space-y-4">
              {selectedProvider ? (
                <CanvasDecisionBlock
                  eyebrow="Provider"
                  title={selectedProvider.name}
                  summary={selectedProvider.summary}
                  badgeLabel={`Trust ${selectedProvider.trustScore}`}
                  badgeTone="info"
                  metrics={[
                    { label: 'Trust', value: String(selectedProvider.trustScore) },
                    { label: 'Credentials', value: `${selectedProvider.activeCredentials}/${selectedProvider.credentialCount}` },
                    { label: 'Findings', value: String(scopedFindings.data?.total ?? providerDetail.data?.provider.findingCount ?? 0) },
                    { label: 'Storylines', value: String(scopedStorylines.data?.total ?? providerDetail.data?.provider.activeStorylineCount ?? 0) },
                  ]}
                  backlinks={[
                    { label: `${relatedFindings.length} linked findings`, onClick: () => push({ focus: 'findings' }) },
                    { label: `${relatedStorylines.length} linked storylines`, onClick: () => push({ focus: 'storylines' }) },
                    ...(relatedActions.length > 0 ? [{ label: `${relatedActions.length} linked actions`, onClick: () => push({ mode: 'decide', focus: 'actions' }) }] : []),
                  ]}
                  primaryAction={{
                    label: pinnedKeys.has(`provider:${selectedProvider.npi}`) ? 'Unpin provider' : 'Pin provider',
                    onClick: () => (
                      pinnedKeys.has(`provider:${selectedProvider.npi}`)
                        ? unpinEntity({ type: 'provider', id: selectedProvider.npi })
                        : pinEntity({ type: 'provider', id: selectedProvider.npi })
                    ),
                  }}
                />
              ) : null}

              {selectedFinding ? (
                <CanvasDecisionBlock
                  eyebrow="Finding"
                  title={selectedFinding.title}
                  summary={selectedFinding.explanation || selectedFinding.summary}
                  badgeLabel={selectedFinding.severity}
                  badgeTone={severityTone(selectedFinding.severity)}
                  metrics={[
                    { label: 'Priority', value: String(Math.round(selectedFinding.priorityScore)) },
                    { label: 'Confidence', value: `${Math.round(selectedFinding.confidence * 100)}%` },
                    { label: 'Evidence', value: String(evidenceEntries.filter((item) => item.originKind === 'finding').length) },
                    { label: 'Updated', value: formatRelativeTime(selectedFinding.updatedAt) },
                  ]}
                  backlinks={[
                    ...(selectedProvider ? [{ label: selectedProvider.name, onClick: () => openProvider(selectedProvider.npi) }] : []),
                    ...(selectedStoryline ? [{ label: selectedStoryline.title, onClick: () => openStoryline(selectedStoryline.id) }] : []),
                    ...relatedActions.slice(0, 2).map((action) => ({
                      label: action.title,
                      onClick: () => openAction(action.id, { providerId: action.providerNpi, findingId: action.sourceFindingIds[0] ?? selectedFinding.id }),
                    })),
                  ]}
                  primaryAction={{
                    label: pinnedKeys.has(`finding:${selectedFinding.id}`) ? 'Unpin finding' : 'Pin finding',
                    onClick: () => (
                      pinnedKeys.has(`finding:${selectedFinding.id}`)
                        ? unpinEntity({ type: 'finding', id: selectedFinding.id })
                        : pinEntity({ type: 'finding', id: selectedFinding.id })
                    ),
                  }}
                />
              ) : null}

              {selectedStoryline ? (
                <CanvasDecisionBlock
                  eyebrow="Storyline"
                  title={selectedStoryline.title}
                  summary={selectedStoryline.whyItMatters || selectedStoryline.summary}
                  badgeLabel={selectedStoryline.status}
                  badgeTone="info"
                  metrics={[
                    { label: 'Findings', value: String(selectedStoryline.findingIds.length) },
                    { label: 'Confidence', value: `${Math.round(selectedStoryline.confidence * 100)}%` },
                    { label: 'Progression', value: `${Math.round(selectedStoryline.progressionScore * 100)}%` },
                    { label: 'Updated', value: formatRelativeTime(selectedStoryline.lastActivityAt) },
                  ]}
                  backlinks={[
                    ...(selectedProvider ? [{ label: selectedProvider.name, onClick: () => openProvider(selectedProvider.npi) }] : []),
                    ...relatedFindings.slice(0, 3).map((finding) => ({
                      label: finding.title,
                      onClick: () => openFinding(finding.id, {
                        providerId: finding.providerNpi,
                        storylineId: selectedStoryline.id,
                      }),
                    })),
                  ]}
                  primaryAction={{
                    label: pinnedKeys.has(`storyline:${selectedStoryline.id}`) ? 'Unpin storyline' : 'Pin storyline',
                    onClick: () => (
                      pinnedKeys.has(`storyline:${selectedStoryline.id}`)
                        ? unpinEntity({ type: 'storyline', id: selectedStoryline.id })
                        : pinEntity({ type: 'storyline', id: selectedStoryline.id })
                    ),
                  }}
                />
              ) : null}

              {selectedAction ? (
                <CanvasDecisionBlock
                  eyebrow="Action"
                  title={selectedAction.title}
                  summary={selectedAction.explanation}
                  badgeLabel={selectedAction.priority}
                  badgeTone={severityTone(selectedAction.priority)}
                  metrics={[
                    { label: 'Confidence', value: `${Math.round(selectedAction.confidence * 100)}%` },
                    { label: 'Signals', value: String(selectedAction.sourceFindingIds.length) },
                    { label: 'Created', value: formatRelativeTime(selectedAction.createdAt) },
                    { label: 'Evidence', value: String(evidenceEntries.filter((item) => item.originKind === 'action').length) },
                  ]}
                  backlinks={[
                    ...(selectedProvider ? [{ label: selectedProvider.name, onClick: () => openProvider(selectedProvider.npi) }] : []),
                    ...selectedAction.sourceFindingIds.slice(0, 3).map((findingId) => ({
                      label: `Finding ${findingId}`,
                      onClick: () => openFinding(findingId, { providerId: selectedAction.providerNpi }),
                    })),
                  ]}
                  primaryAction={{
                    label: pinnedKeys.has(`action:${selectedAction.id}`) ? 'Unpin action' : 'Pin action',
                    onClick: () => (
                      pinnedKeys.has(`action:${selectedAction.id}`)
                        ? unpinEntity({ type: 'action', id: selectedAction.id })
                        : pinEntity({ type: 'action', id: selectedAction.id })
                    ),
                  }}
                />
              ) : null}

              <section className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Backlinks</p>
                    <h3 className="mt-1 text-base font-semibold text-[var(--vt-text-1)]">Related objects</h3>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-[var(--vt-text-3)]" />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Findings</p>
                    {relatedFindings.length > 0 ? relatedFindings.map((finding) => (
                      <BacklinkButton
                        key={finding.id}
                        label={finding.title}
                        onClick={() => openFinding(finding.id, {
                          providerId: finding.providerNpi,
                          storylineId: finding.storylineId,
                        })}
                      />
                    )) : <p className="text-sm text-[var(--vt-text-3)]">No linked findings</p>}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Storylines</p>
                    {relatedStorylines.length > 0 ? relatedStorylines.map((storyline) => (
                      <BacklinkButton
                        key={storyline.id}
                        label={storyline.title}
                        onClick={() => openStoryline(storyline.id, { providerId: storyline.providerNpi })}
                      />
                    )) : <p className="text-sm text-[var(--vt-text-3)]">No linked storylines</p>}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Actions</p>
                    {relatedActions.length > 0 ? relatedActions.map((action) => (
                      <BacklinkButton
                        key={action.id}
                        label={action.title}
                        onClick={() => openAction(action.id, {
                          providerId: action.providerNpi,
                          findingId: action.sourceFindingIds[0] ?? null,
                        })}
                      />
                    )) : <p className="text-sm text-[var(--vt-text-3)]">No linked actions</p>}
                  </div>
                </div>
              </section>

              {providerDetail.data ? (
                <section className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Provider context</p>
                      <h3 className="mt-1 text-base font-semibold text-[var(--vt-text-1)]">
                        {providerDetail.data.provider.fullName}
                      </h3>
                    </div>
                    <a
                      href={`/intelligence?focus=provider&id=${encodeURIComponent(providerDetail.data.provider.npi)}`}
                      className="text-xs text-cyan-300"
                    >
                      Canonical route
                    </a>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <MetricPill label="Trust" value={String(providerDetail.data.provider.trustScore)} />
                    <MetricPill label="Risk" value={String(providerDetail.data.provider.riskScore)} />
                    <MetricPill label="Credentials" value={String(providerDetail.data.provider.activeCredentialCount)} />
                    <MetricPill label="Active cases" value={String(providerDetail.data.provider.activeStorylineCount)} />
                  </div>
                </section>
              ) : null}
            </div>
          </main>

          <aside className="min-h-0 overflow-y-auto border-l border-[var(--vt-border)] bg-[var(--vt-surface)]/70 p-4">
            <div className="space-y-4">
              <GraphWorkbenchPanel
                graph={graph.data ?? null}
                providers={providerPool}
                selectedProvider={selectedProvider}
                selectedFindingId={state.findingId}
                selectedStorylineId={state.storylineId}
                openFullGraphHref={buildIntelligenceHref('graph', {
                  provider: graphScopeNpi,
                  findingId: state.findingId,
                  storylineId: state.storylineId,
                })}
                loading={graph.loading && !graph.data}
                error={graph.error}
                onRetry={graph.refresh}
                focusNodeId={selectedProvider?.npi ?? null}
                highlightNodeId={selectedProvider?.npi ?? null}
                onSelectProvider={(provider) => openProvider(provider.npi)}
                onSelectGraphNode={() => {}}
              />

              {graph.data && graph.data.nodes.length === 0 ? (
                <div className="rounded-sm border border-dashed border-[var(--vt-border)] px-4 py-3 text-sm text-[var(--vt-text-3)]">
                  Graph slice is warming from live relationships. No nodes have been materialized for the current scope yet.
                </div>
              ) : null}

              <EvidencePanel
                items={evidenceEntries}
                selectedEvidence={state.evidenceId}
                sort={evidenceSort}
                group={evidenceGroup}
                density={evidenceDensity}
                onSelect={setEvidence}
                onSort={setEvidenceSort}
                onGroup={setEvidenceGroup}
                onDensity={setEvidenceDensity}
              />

              <section className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Copilot</p>
                    <h3 className="mt-1 text-base font-semibold text-[var(--vt-text-1)]">Scoped reasoning</h3>
                  </div>
                  <Bot className="h-4 w-4 text-[var(--vt-text-3)]" />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--vt-text-2)]">
                  Copilot stays attached to the current provider, finding, storyline, and graph focus.
                </p>
                <div className="mt-4">
                  <CopilotPanel provider={selectedProvider} seed={copilotSeed} />
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
