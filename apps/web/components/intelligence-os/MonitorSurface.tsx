'use client';

import { useMemo } from 'react';
import { useFindings } from '@/hooks/useFindings';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { CanvasDecisionBlock } from '@/components/intelligence-ops/canvas-decision-block';
import type { WorkspaceState } from '@/lib/intelligence/workspace-store';
import { formatRelativeTime } from '@/lib/intelligence/time';
import { Tooltip } from '@/components/ui/lab/Tooltip';

// ── Types ─────────────────────────────────────────────────────────────────────

type ObjectKind = 'signal' | 'case' | 'entity';

export interface UnifiedItem {
  id: string;
  kind: ObjectKind;
  title: string;
  summary: string;
  severity: string;
  confidence: number;
  updatedAt: string;
  npi: string | null;
  providerLabel: string | null;
  storylineId: string | null;
  storylineTitle: string | null;
  findingId: string | null;
  findingType: string | null;
  priorityScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_RAIL: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-400',
  medium: 'bg-blue-400',
  low: 'bg-emerald-400',
  info: 'bg-[var(--vt-border)]',
};

const KIND_LABEL: Record<ObjectKind, string> = {
  signal: 'SIGNAL',
  case: 'CASE',
  entity: 'ENTITY',
};

const KIND_COLORS: Record<ObjectKind, string> = {
  signal: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  case: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  entity: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
};

function severityRail(severity: string) {
  return SEVERITY_RAIL[severity?.toLowerCase()] ?? SEVERITY_RAIL.info;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="flex overflow-hidden rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-[3px] shrink-0 bg-[var(--vt-border)]" />
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-14 rounded bg-[var(--vt-surface-2)]" />
          <div className="h-3 w-20 rounded bg-[var(--vt-surface-2)]" />
        </div>
        <div className="h-4 w-3/4 rounded bg-[var(--vt-surface-2)]" />
        <div className="h-3 w-full rounded bg-[var(--vt-surface-2)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--vt-surface-2)]" />
      </div>
    </div>
  );
}

// ── Backlink chip ─────────────────────────────────────────────────────────────

function Backlink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-0.5 text-[10px] text-[var(--vt-text-3)] transition hover:border-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]"
    >
      {label} ↗
    </button>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  active,
  hasActiveSelection,
  onSelect,
  onNavigate,
}: {
  item: UnifiedItem;
  active: boolean;
  hasActiveSelection: boolean;
  onSelect: (item: UnifiedItem) => void;
  onNavigate: (next: Partial<WorkspaceState>) => void;
}) {
  if (active) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CanvasDecisionBlock
          eyebrow={KIND_LABEL[item.kind]}
          title={item.title}
          summary={item.summary}
          badgeLabel={item.findingType ? item.findingType.replace(/_/g, ' ') : null}
          badgeTone={
            item.severity === 'critical' ? 'critical' :
            item.severity === 'high' ? 'warning' :
            item.severity === 'medium' ? 'info' : 'neutral'
          }
          metrics={[
            { label: 'Priority', value: Math.round(item.priorityScore).toString() },
            { label: 'Confidence', value: `${Math.round(item.confidence * 100)}%` }
          ]}
          primaryAction={{
            label: 'Investigate Deeply',
            onClick: () => {
              if (item.kind === 'signal') {
                onNavigate({
                  mode: 'investigate',
                  npi: item.npi,
                  findingId: item.findingId,
                  storylineId: item.storylineId,
                  openPanels: item.storylineId ? ['provider', 'finding', 'storyline'] : ['provider', 'finding'],
                });
              } else if (item.kind === 'case') {
                onNavigate({
                  mode: 'investigate',
                  npi: item.npi,
                  findingId: null,
                  storylineId: item.storylineId,
                  openPanels: ['provider', 'storyline'],
                });
              } else {
                onNavigate({
                  mode: 'investigate',
                  npi: item.npi,
                  findingId: null,
                  storylineId: null,
                  openPanels: ['provider'],
                });
              }
            }
          }}
          secondaryActions={[
            { label: 'Dismiss', tone: 'neutral' },
            { label: 'Escalate to Case', tone: 'critical' }
          ]}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group relative w-full flex overflow-hidden rounded-[4px] border text-left transition-all duration-300 ${
        active 
          ? 'border-[var(--vt-accent)] bg-[var(--vt-surface)] shadow-[0_0_12px_-3px_rgba(59,130,246,0.3)] z-10 scale-[1.01]'
          : hasActiveSelection
            ? 'border-[var(--vt-border)]/50 bg-[var(--vt-surface-dim)] opacity-60 hover:opacity-100 hover:border-[var(--vt-border)] hover:bg-[var(--vt-surface)]'
            : 'border-[var(--vt-border)] bg-[var(--vt-surface)] hover:border-[var(--vt-text-3)] hover:shadow-md hover:-translate-y-[1px]'
      }`}
    >
      {/* severity rail */}
      <div className={`w-[3px] shrink-0 ${severityRail(item.severity)}`} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Kind badge + severity + time */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-[3px] border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${KIND_COLORS[item.kind]}`}>
            {KIND_LABEL[item.kind]}
          </span>
          {item.findingType && (
            <span className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">
              {item.findingType.replace(/_/g, ' ')}
            </span>
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${
            item.severity === 'critical' ? 'text-red-400' :
            item.severity === 'high' ? 'text-amber-400' :
            item.severity === 'medium' ? 'text-blue-400' :
            'text-[var(--vt-text-3)]'
          }`}>
            {item.severity}
          </span>
          <span className="ml-auto text-[10px] text-[var(--vt-text-3)]">
            {formatRelativeTime(item.updatedAt)}
          </span>
        </div>

        {/* Title */}
        <Tooltip
          title={item.title}
          trustScore={Math.round(item.confidence)}
          lastSignal={formatRelativeTime(item.updatedAt)}
          linkedCounts={[
            { label: 'Priority Score', count: Math.round(item.priorityScore) },
          ]}
          reason={item.summary}
          side="top"
          delay={300}
        >
          <p className="text-sm font-medium leading-snug text-[var(--vt-text-1)] hover:text-[var(--vt-accent)] transition-colors">{item.title}</p>
        </Tooltip>

        {/* Summary */}
        <p className="line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)]">{item.summary}</p>

        {/* Backlinks */}
        <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {item.npi && (
            <Backlink
              label={item.providerLabel ?? `NPI ${item.npi}`}
              onClick={() => onNavigate({
                mode: 'investigate',
                npi: item.npi,
                findingId: item.findingId,
                storylineId: item.storylineId,
                openPanels:
                  item.kind === 'entity'
                    ? ['provider']
                    : item.kind === 'case'
                      ? ['provider', 'storyline']
                      : item.storylineId
                        ? ['provider', 'finding', 'storyline']
                        : ['provider', 'finding'],
              })}
            />
          )}
          {item.storylineId && item.kind !== 'case' && (
            <Backlink
              label={item.storylineTitle ?? 'Open case'}
              onClick={() => onNavigate({
                mode: 'investigate',
                npi: item.npi,
                findingId: item.findingId,
                storylineId: item.storylineId,
                openPanels: ['provider', 'finding', 'storyline'],
              })}
            />
          )}
          {item.kind === 'entity' && item.npi && (
            <Backlink
              label="View signals"
              onClick={() => onNavigate({ mode: 'investigate', npi: item.npi, findingId: null, storylineId: null, openPanels: ['provider'] })}
            />
          )}

          {/* Confidence */}
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-[var(--vt-text-3)]">
            <span className="h-1 w-12 overflow-hidden rounded-[1px] bg-[var(--vt-surface-2)]">
              <span
                className="block h-full bg-cyan-400/60"
                style={{ width: `${Math.round(item.confidence * 100)}%` }}
              />
            </span>
            {Math.round(item.confidence * 100)}%
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Monitor surface ───────────────────────────────────────────────────────────

interface MonitorSurfaceProps {
  state: WorkspaceState;
  onSelect: (item: UnifiedItem) => void;
  onNavigate: (next: Partial<WorkspaceState>) => void;
}

export function MonitorSurface({ state, onSelect, onNavigate }: MonitorSurfaceProps) {
  const findings = useFindings({ limit: 20, pollIntervalMs: 30_000 });
  const storylines = useStorylines({ limit: 8, pollIntervalMs: 60_000 });
  const providers = useProviders({ limit: 6, pollIntervalMs: 60_000 });

  const items = useMemo<UnifiedItem[]>(() => {
    const out: UnifiedItem[] = [];

    for (const f of findings.data?.findings ?? []) {
      out.push({
        id: f.id,
        kind: 'signal',
        title: f.title,
        summary: f.summary,
        severity: f.severity,
        confidence: f.confidence,
        updatedAt: f.updatedAt,
        npi: f.providerNpi,
        providerLabel: f.providerLabel,
        storylineId: f.storylineId,
        storylineTitle: f.storylineTitle,
        findingId: f.id,
        findingType: f.findingType,
        priorityScore: f.priorityScore,
      });
    }

    for (const s of storylines.data?.storylines ?? []) {
      out.push({
        id: `case:${s.id}`,
        kind: 'case',
        title: s.title,
        summary: s.whyItMatters || s.summary,
        severity: s.severity,
        confidence: s.confidence,
        updatedAt: s.lastActivityAt,
        npi: s.providerNpi,
        providerLabel: null,
        storylineId: s.id,
        storylineTitle: s.title,
        findingId: null,
        findingType: s.storylineType,
        priorityScore: s.progressionScore * 100,
      });
    }

    for (const p of providers.data?.providers ?? []) {
      if (p.trustScore < 70 || p.risk !== 'neutral') {
        out.push({
          id: `entity:${p.npi}`,
          kind: 'entity',
          title: p.name,
          summary: p.summary || `Trust score: ${p.trustScore} · ${p.credentialHealth}`,
          severity: p.risk === 'critical' ? 'critical' : p.risk === 'degraded' ? 'high' : 'medium',
          confidence: p.trustScore / 100,
          updatedAt: p.lastVerifiedAt ?? new Date().toISOString(),
          npi: p.npi,
          providerLabel: p.name,
          storylineId: null,
          storylineTitle: null,
          findingId: null,
          findingType: null,
          priorityScore: 100 - p.trustScore,
        });
      }
    }

    return out.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [findings.data, storylines.data, providers.data]);

  const loading = findings.loading && !findings.data;
  const hasActiveSelection = items.some(item => 
    (item.findingId && item.findingId === state.findingId) ||
    (item.storylineId && item.kind === 'case' && item.storylineId === state.storylineId) ||
    (item.kind === 'entity' && item.npi === state.npi)
  );

  return (
    <div className="flex h-full flex-col bg-[var(--vt-bg)]/40 backdrop-blur-sm relative z-10 w-[500px] border-r border-[var(--vt-border)]/50 shadow-2xl">
      {/* Surface header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)]/80 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
            Signal Queue
          </p>
          {!loading && (
            <span className="text-[10px] font-mono text-[var(--vt-text-3)]">
              {items.length} objects
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--vt-text-3)]">
          <span>ranked by priority</span>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-1.5 py-0.5">j</kbd>
            <kbd className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-1.5 py-0.5">k</kbd>
            <span>navigate</span>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {loading
          ? [...Array(6)].map((_, i) => <SkeletonRow key={i} delay={i * 60} />)
          : items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                hasActiveSelection={hasActiveSelection}
                active={
                  (item.findingId && item.findingId === state.findingId) ||
                  (item.storylineId && item.kind === 'case' && item.storylineId === state.storylineId) ||
                  (item.kind === 'entity' && item.npi === state.npi)
                    ? true
                    : false
                }
                onSelect={onSelect}
                onNavigate={onNavigate}
              />
            ))}
      </div>
    </div>
  );
}
