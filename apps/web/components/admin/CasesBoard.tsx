'use client';

import React, { useMemo, useState } from 'react';

// ── Types (mirrors caseService.ts output shape) ───────────────────────────────

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';
export type LaneProgress = 'complete' | 'pending' | 'missing' | 'in_progress';
export type SortKey = 'priority' | 'delay' | 'roi' | 'progress';

export interface ClinicalCase {
  entityId: string;
  npi: string;
  clinicianName: string;
  priority: CasePriority;
  progressPercent: number;
  estimatedCompletion: string;
  progress: {
    identity: LaneProgress;
    sanctions: LaneProgress;
    licensure: LaneProgress;
    enrollment: LaneProgress;
  };
  blockers: Array<{
    id: string;
    label: string;
    estimatedDays: number;
    severity: string;
    owner: string;
  }>;
  actions: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
    estimatedDays: number;
    owner: string;
  }>;
  orchestrationPlan: {
    criticalPathDays: number;
    parallelSavingsDays: number;
    totalBlockers: number;
    waves: Array<{ waveIndex: number; nodes: Array<{ id: string; label: string }> }>;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<CasePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const LANE_COLORS: Record<LaneProgress, string> = {
  complete: 'bg-emerald-500',
  in_progress: 'bg-blue-400',
  pending: 'bg-yellow-500',
  missing: 'bg-zinc-700',
};

function LaneDot({ status }: { status: LaneProgress }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${LANE_COLORS[status]}`}
      title={status}
    />
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[priority]}`}
    >
      {priority}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{percent}%</span>
    </div>
  );
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortCases(cases: ClinicalCase[], sort: SortKey): ClinicalCase[] {
  return [...cases].sort((a, b) => {
    switch (sort) {
      case 'delay':
        return b.orchestrationPlan.criticalPathDays - a.orchestrationPlan.criticalPathDays;
      case 'roi':
        return b.orchestrationPlan.parallelSavingsDays - a.orchestrationPlan.parallelSavingsDays;
      case 'progress':
        return a.progressPercent - b.progressPercent;
      case 'priority':
      default:
        return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    }
  });
}

// ── Main component ────────────────────────────────────────────────────────────

interface CasesBoardProps {
  initialCases: ClinicalCase[];
}

export function CasesBoard({ initialCases }: CasesBoardProps) {
  const [sort, setSort] = useState<SortKey>('priority');
  const [priorityFilter, setPriorityFilter] = useState<CasePriority[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (priorityFilter.length === 0) {
      return initialCases;
    }
    return initialCases.filter((c) => priorityFilter.includes(c.priority));
  }, [initialCases, priorityFilter]);

  const sorted = useMemo(() => sortCases(filtered, sort), [filtered, sort]);

  function toggleSelected(entityId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((c) => c.entityId)));
    }
  }

  function togglePriorityFilter(p: CasePriority) {
    setPriorityFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function handleBulkStart() {
    if (selected.size === 0 || bulkLoading) {
      return;
    }
    setBulkLoading(true);
    const selectedCases = sorted.filter((c) => selected.has(c.entityId));
    await Promise.allSettled(
      selectedCases.flatMap((c) =>
        c.actions
          .filter((a) => a.status === 'pending')
          .slice(0, 1)
          .map((a) =>
            fetch(`/api/cases/${c.entityId}/action/${a.id}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ note: 'Bulk start from admin cases board' }),
            }),
          ),
      ),
    );
    setBulkLoading(false);
    setSelected(new Set());
  }

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'priority', label: 'Priority' },
    { value: 'delay', label: 'Delay (days)' },
    { value: 'roi', label: 'Parallel ROI' },
    { value: 'progress', label: 'Progress' },
  ];

  const PRIORITY_OPTIONS: CasePriority[] = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sort
          </span>
          <div className="flex gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  sort === opt.value
                    ? 'border-white/20 bg-white/10 text-foreground'
                    : 'border-white/6 bg-transparent text-muted-foreground hover:border-white/12 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Filter
          </span>
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => togglePriorityFilter(p)}
                className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  priorityFilter.includes(p)
                    ? PRIORITY_COLORS[p]
                    : 'border-white/6 bg-transparent text-muted-foreground hover:border-white/12'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <button
            onClick={handleBulkStart}
            disabled={bulkLoading}
            className="ml-auto rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {bulkLoading ? 'Starting…' : `Start next action — ${selected.size} case${selected.size > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{sorted.length} case{sorted.length !== 1 ? 's' : ''}</span>
        {priorityFilter.length > 0 && (
          <button
            onClick={() => setPriorityFilter([])}
            className="text-foreground/50 hover:text-foreground underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6">
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === sorted.length && sorted.length > 0}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded accent-emerald-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Clinician
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Lanes
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                ETA
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Critical path
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Blockers
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No cases found.
                </td>
              </tr>
            )}
            {sorted.map((c, i) => (
              <React.Fragment key={c.entityId}>
                <tr
                  className={`border-b border-white/4 transition-colors hover:bg-white/[0.03] cursor-pointer ${
                    selected.has(c.entityId) ? 'bg-white/[0.04]' : ''
                  } ${i === sorted.length - 1 ? 'border-b-0' : ''}`}
                  onClick={() => setExpandedId(expandedId === c.entityId ? null : c.entityId)}
                >
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.entityId)}
                      onChange={() => toggleSelected(c.entityId)}
                      className="h-3.5 w-3.5 rounded accent-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{c.clinicianName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.npi}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <LaneDot status={c.progress.identity} />
                      <LaneDot status={c.progress.sanctions} />
                      <LaneDot status={c.progress.licensure} />
                      <LaneDot status={c.progress.enrollment} />
                    </div>
                    <div className="mt-0.5 text-[9px] text-muted-foreground/50">id · sanc · lic · enr</div>
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar percent={c.progressPercent} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.estimatedCompletion}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.orchestrationPlan.criticalPathDays > 0
                      ? `${c.orchestrationPlan.criticalPathDays}d`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.orchestrationPlan.totalBlockers > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {c.orchestrationPlan.totalBlockers} blocker{c.orchestrationPlan.totalBlockers !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400">Clear</span>
                    )}
                  </td>
                </tr>

                {/* Expanded detail row */}
                {expandedId === c.entityId && (
                  <tr className="border-b border-white/4">
                    <td colSpan={8} className="px-4 pb-4 pt-0">
                      <div className="rounded-xl border border-white/8 bg-black/15 p-4 space-y-4">
                        {/* Orchestration waves */}
                        {c.orchestrationPlan.waves.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
                              Execution waves
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {c.orchestrationPlan.waves.map((wave) => (
                                <div
                                  key={wave.waveIndex}
                                  className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 min-w-[120px]"
                                >
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">
                                    Wave {wave.waveIndex + 1}
                                  </p>
                                  {wave.nodes.map((n) => (
                                    <p key={n.id} className="text-xs text-foreground/70">
                                      {n.label}
                                    </p>
                                  ))}
                                </div>
                              ))}
                            </div>
                            {c.orchestrationPlan.parallelSavingsDays > 0 && (
                              <p className="mt-2 text-[10px] text-emerald-400/70">
                                Running in parallel saves {c.orchestrationPlan.parallelSavingsDays} days vs serial execution.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Blockers list */}
                        {c.blockers.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
                              Blockers
                            </p>
                            <div className="space-y-2">
                              {c.blockers.map((b) => (
                                <div key={b.id} className="flex items-start gap-3">
                                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/40 w-12 shrink-0">
                                    {b.owner}
                                  </span>
                                  <div>
                                    <p className="text-xs font-medium text-foreground">{b.label}</p>
                                    {b.estimatedDays > 0 && (
                                      <p className="text-[10px] text-muted-foreground">~{b.estimatedDays} days</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {c.blockers.length === 0 && (
                          <p className="text-xs text-emerald-400">
                            No blockers — this clinician is cleared to move forward.
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
