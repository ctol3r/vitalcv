'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperationsShell } from '@/components/intelligence-ops/shell';
import { OpsBadge, OpsCard, SurfaceBanner } from '@/components/intelligence-ops/primitives';

// ── API Types ────────────────────────────────────────────────────────────────

interface InvestigatorCalibrationStats {
  investigatorId: string;
  totalResolved: number;
  truePositiveCount: number;
  falsePositiveCount: number;
  escalatedCount: number;
  inconclusiveCount: number;
  truePositiveRate: number;
  falsePositiveRate: number;
  inconclusiveRate: number;
  averageEvidenceQuality: number;
  topFalsePositiveReasons: Array<{ reason: string; count: number }>;
  calibrationScore: number;
  feedbackBias: number;
  lastUpdatedAt: string;
}

interface LearningLoopSummary {
  totalOutcomes: number;
  resolvedTodayCount: number;
  overallTruePositiveRate: number;
  overallFalsePositiveRate: number;
  worstPerformingInvestigators: string[];
  bestPerformingInvestigators: string[];
  generatedAt: string;
}

interface CalibrationResponse {
  stats: InvestigatorCalibrationStats[];
  summary: LearningLoopSummary;
  generatedAt: string;
}

interface OutcomeRecord {
  outcomeId: string;
  findingId: string;
  investigatorId: string;
  findingType: string;
  severity: string;
  outcome: string;
  evidenceQuality: string;
  falsePositiveReason?: string;
  analystNote?: string;
  resolvedAt: string;
  resolvedBy?: string;
}

interface OutcomesResponse {
  outcomes: OutcomeRecord[];
  total: number;
  generatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type SortKey =
  | 'investigatorId'
  | 'totalResolved'
  | 'truePositiveRate'
  | 'falsePositiveRate'
  | 'averageEvidenceQuality'
  | 'calibrationScore'
  | 'feedbackBias';
type SortDir = 'asc' | 'desc';

function accuracyTone(rate: number): 'success' | 'warning' | 'critical' | 'neutral' {
  if (rate >= 0.8) return 'success';
  if (rate >= 0.6) return 'warning';
  if (rate > 0) return 'critical';
  return 'neutral';
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function fmtBias(v: number): string {
  if (v > 0) return `+${v}`;
  return String(v);
}

function evidenceQualityLabel(value: number): string {
  if (value >= 0.85) return 'Strong';
  if (value >= 0.6) return 'Adequate';
  if (value > 0) return 'Weak';
  return 'Missing';
}

function bar(value: number, max: number, color: string) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${w}%` }} />
    </div>
  );
}

function outcomeLabel(outcome: string): string {
  return outcome.replace(/^RESOLVED_/, '').replace(/_/g, ' ');
}

function outcomeBadgeTone(outcome: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (outcome.includes('TRUE_POSITIVE')) return 'success';
  if (outcome.includes('FALSE_POSITIVE')) return 'critical';
  if (outcome === 'ESCALATED') return 'warning';
  return 'neutral';
}

function evidenceColor(q: string): string {
  switch (q) {
    case 'STRONG':   return 'bg-emerald-500';
    case 'ADEQUATE': return 'bg-sky-500';
    case 'WEAK':     return 'bg-amber-500';
    case 'MISSING':  return 'bg-red-500';
    default:         return 'bg-slate-500';
  }
}

// ── Components ───────────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  stats,
}: {
  summary: LearningLoopSummary;
  stats: InvestigatorCalibrationStats[];
}) {
  const totalResolved = stats.reduce((sum, item) => sum + item.totalResolved, 0);
  const weightedEvidenceQuality = totalResolved > 0
    ? stats.reduce((sum, item) => sum + (item.averageEvidenceQuality * item.totalResolved), 0) / totalResolved
    : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <OpsCard className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Total Outcomes</p>
        <p className="text-2xl font-semibold tabular-nums text-[var(--vt-text-1)]">{summary.totalOutcomes}</p>
        <p className="text-xs text-[var(--vt-text-3)]">{summary.resolvedTodayCount} today</p>
      </OpsCard>
      <OpsCard className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">True Positive Rate</p>
        <p className="text-2xl font-semibold tabular-nums text-emerald-400">{pct(summary.overallTruePositiveRate)}</p>
        <p className="text-xs text-[var(--vt-text-3)]">across all investigators</p>
      </OpsCard>
      <OpsCard className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">False Positive Rate</p>
        <p className="text-2xl font-semibold tabular-nums text-red-400">{pct(summary.overallFalsePositiveRate)}</p>
        <p className="text-xs text-[var(--vt-text-3)]">lower is better</p>
      </OpsCard>
      <OpsCard className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Evidence Quality</p>
        <p className="text-2xl font-semibold tabular-nums text-sky-300">{pct(weightedEvidenceQuality)}</p>
        <p className="text-xs text-[var(--vt-text-3)]">{evidenceQualityLabel(weightedEvidenceQuality)} on average</p>
      </OpsCard>
      <OpsCard className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Best Performer</p>
        <p className="truncate text-lg font-semibold text-[var(--vt-text-1)]">
          {summary.bestPerformingInvestigators[0]?.replace(/_/g, ' ') ?? '—'}
        </p>
        <p className="text-xs text-[var(--vt-text-3)]">highest calibration score</p>
      </OpsCard>
    </div>
  );
}

function AccuracyTable({
  stats,
  sortKey,
  sortDir,
  onSort,
}: {
  stats: InvestigatorCalibrationStats[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const sorted = [...stats].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function th(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <th
        className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs uppercase tracking-[0.1em] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
        onClick={() => onSort(key)}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <OpsCard className="overflow-x-auto">
      <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Investigator Accuracy</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--vt-border)]">
            {th('Investigator', 'investigatorId')}
            {th('Resolved', 'totalResolved')}
            {th('TP Rate', 'truePositiveRate')}
            {th('FP Rate', 'falsePositiveRate')}
            {th('Evidence', 'averageEvidenceQuality')}
            {th('Score', 'calibrationScore')}
            {th('Bias', 'feedbackBias')}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--vt-text-3)]">
                No calibration data yet. Record finding outcomes to populate this table.
              </td>
            </tr>
          ) : null}
          {sorted.map((s) => (
            <tr key={s.investigatorId} className="border-b border-[var(--vt-border)] last:border-0">
              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[var(--vt-text-1)]">
                {s.investigatorId.replace(/_/g, ' ')}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-[var(--vt-text-2)]">{s.totalResolved}</td>
              <td className="px-3 py-2.5">
                <OpsBadge label={pct(s.truePositiveRate)} tone={accuracyTone(s.truePositiveRate)} />
              </td>
              <td className="px-3 py-2.5">
                <OpsBadge
                  label={pct(s.falsePositiveRate)}
                  tone={s.falsePositiveRate > 0.4 ? 'critical' : s.falsePositiveRate > 0.2 ? 'warning' : 'success'}
                />
              </td>
              <td className="px-3 py-2.5">
                <div className="space-y-1">
                  <OpsBadge
                    label={`${evidenceQualityLabel(s.averageEvidenceQuality)} ${pct(s.averageEvidenceQuality)}`}
                    tone={s.averageEvidenceQuality >= 0.85 ? 'success' : s.averageEvidenceQuality >= 0.6 ? 'info' : s.averageEvidenceQuality > 0 ? 'warning' : 'neutral'}
                  />
                  <div className="w-20">
                    {bar(s.averageEvidenceQuality, 1, s.averageEvidenceQuality >= 0.85 ? 'bg-emerald-500' : s.averageEvidenceQuality >= 0.6 ? 'bg-sky-500' : s.averageEvidenceQuality > 0 ? 'bg-amber-500' : 'bg-slate-500')}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-[var(--vt-text-1)]">{s.calibrationScore}</span>
                  <div className="w-16">
                    {bar(s.calibrationScore, 100, s.calibrationScore >= 70 ? 'bg-emerald-500' : s.calibrationScore >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-[var(--vt-text-2)]">{fmtBias(s.feedbackBias)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </OpsCard>
  );
}

function OutcomeDistribution({ outcomes }: { outcomes: OutcomeRecord[] }) {
  const counts: Record<string, number> = {};
  for (const o of outcomes) {
    counts[o.outcome] = (counts[o.outcome] ?? 0) + 1;
  }

  const total = outcomes.length || 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const colorMap: Record<string, string> = {
    RESOLVED_TRUE_POSITIVE: 'bg-emerald-500',
    RESOLVED_FALSE_POSITIVE: 'bg-red-500',
    RESOLVED_INCONCLUSIVE: 'bg-slate-500',
    ESCALATED: 'bg-amber-500',
    MONITORING: 'bg-sky-500',
  };

  return (
    <OpsCard className="space-y-3">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Outcome Distribution</p>
      {outcomes.length === 0 ? (
        <p className="text-sm text-[var(--vt-text-3)]">No outcomes recorded yet.</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            {entries.map(([outcome, count]) => (
              <div
                key={outcome}
                className={`${colorMap[outcome] ?? 'bg-slate-400'} transition-all`}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${outcomeLabel(outcome)}: ${count}`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {entries.map(([outcome, count]) => (
              <div key={outcome} className="flex items-center gap-1.5 text-xs text-[var(--vt-text-2)]">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorMap[outcome] ?? 'bg-slate-400'}`} />
                {outcomeLabel(outcome)} <span className="tabular-nums text-[var(--vt-text-3)]">({count}, {pct(count / total)})</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-[var(--vt-border)] pt-3">
            {entries.map(([outcome, count]) => (
              <div key={outcome} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-[var(--vt-text-2)]">{outcomeLabel(outcome)}</span>
                <span className="tabular-nums text-[var(--vt-text-3)]">{count} / {pct(count / total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </OpsCard>
  );
}

function EvidenceQualityDistribution({ outcomes }: { outcomes: OutcomeRecord[] }) {
  const counts: Record<string, number> = { STRONG: 0, ADEQUATE: 0, WEAK: 0, MISSING: 0 };
  for (const o of outcomes) {
    if (o.evidenceQuality in counts) {
      counts[o.evidenceQuality]!++;
    }
  }

  const max = Math.max(...Object.values(counts), 1);

  return (
    <OpsCard className="space-y-3">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Evidence Quality</p>
      {outcomes.length === 0 ? (
        <p className="text-sm text-[var(--vt-text-3)]">No evidence quality data yet.</p>
      ) : (
        <div className="space-y-2">
          {(['STRONG', 'ADEQUATE', 'WEAK', 'MISSING'] as const).map((q) => (
            <div key={q} className="flex items-center gap-3">
              <span className="w-20 text-xs text-[var(--vt-text-2)]">{q}</span>
              <div className="flex-1">{bar(counts[q] ?? 0, max, evidenceColor(q))}</div>
              <span className="w-20 text-right text-xs tabular-nums text-[var(--vt-text-3)]">{counts[q]} / {pct((counts[q] ?? 0) / Math.max(outcomes.length, 1))}</span>
            </div>
          ))}
        </div>
      )}
    </OpsCard>
  );
}

function FalsePositiveSummary({ stats }: { stats: InvestigatorCalibrationStats[] }) {
  if (stats.length === 0) {
    return null;
  }

  const ranked = [...stats]
    .filter((item) => item.falsePositiveCount > 0)
    .sort((left, right) => (
      right.falsePositiveRate - left.falsePositiveRate
      || right.falsePositiveCount - left.falsePositiveCount
      || left.investigatorId.localeCompare(right.investigatorId)
    ));
  const flagged = stats.filter((item) => item.falsePositiveRate >= 0.2).length;
  const worst = ranked[0] ?? null;

  return (
    <OpsCard className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">False Positive Pressure</p>
        <p className="text-sm text-[var(--vt-text-2)]">Investigators trending toward false alarms need tighter evidence thresholds before launch.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--vt-text-3)]">Watchlist</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--vt-text-1)]">{flagged}</p>
          <p className="text-xs text-[var(--vt-text-3)]">investigator{flagged === 1 ? '' : 's'} at or above 20% FP rate</p>
        </div>
        <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--vt-text-3)]">Worst FP Rate</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-red-400">{worst ? pct(worst.falsePositiveRate) : '0%'}</p>
          <p className="text-xs text-[var(--vt-text-3)]">{worst ? worst.investigatorId.replace(/_/g, ' ') : 'No false positives recorded'}</p>
        </div>
        <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--vt-text-3)]">Top FP Count</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--vt-text-1)]">{worst?.falsePositiveCount ?? 0}</p>
          <p className="text-xs text-[var(--vt-text-3)]">cases needing threshold review</p>
        </div>
      </div>
      {ranked.length > 0 ? (
        <div className="space-y-2 border-t border-[var(--vt-border)] pt-3">
          {ranked.slice(0, 3).map((item) => (
            <div key={item.investigatorId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--vt-text-2)]">{item.investigatorId.replace(/_/g, ' ')}</span>
              <span className="tabular-nums text-[var(--vt-text-3)]">{item.falsePositiveCount} FP • {pct(item.falsePositiveRate)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--vt-text-3)]">No false positives have been recorded yet.</p>
      )}
    </OpsCard>
  );
}

function FalsePositiveReasons({ stats }: { stats: InvestigatorCalibrationStats[] }) {
  const allReasons = new Map<string, number>();
  for (const s of stats) {
    for (const r of s.topFalsePositiveReasons) {
      allReasons.set(r.reason, (allReasons.get(r.reason) ?? 0) + r.count);
    }
  }

  const sorted = [...allReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (sorted.length === 0) return null;

  const max = Math.max(...sorted.map(([, c]) => c), 1);

  return (
    <OpsCard className="space-y-3">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Top False Positive Reasons</p>
      <div className="space-y-2">
        {sorted.map(([reason, count]) => (
          <div key={reason} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--vt-text-2)]">{reason}</span>
            <div className="w-24">{bar(count, max, 'bg-red-500/70')}</div>
            <span className="w-6 text-right text-xs tabular-nums text-[var(--vt-text-3)]">{count}</span>
          </div>
        ))}
      </div>
    </OpsCard>
  );
}

function RecentOutcomes({ outcomes }: { outcomes: OutcomeRecord[] }) {
  if (outcomes.length === 0) return null;

  return (
    <OpsCard className="space-y-3">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Recent Outcomes</p>
      <div className="space-y-2">
        {outcomes.slice(0, 10).map((o) => (
          <div key={o.outcomeId} className="flex items-center gap-2 text-xs">
            <OpsBadge label={outcomeLabel(o.outcome)} tone={outcomeBadgeTone(o.outcome)} />
            <span className="truncate text-[var(--vt-text-2)]">{o.investigatorId.replace(/_/g, ' ')}</span>
            <span className={`shrink-0 rounded px-1 py-0.5 ${evidenceColor(o.evidenceQuality)} text-[10px] font-medium text-white`}>
              {o.evidenceQuality}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-[var(--vt-text-3)]">
              {o.resolvedAt.slice(0, 10)}
            </span>
          </div>
        ))}
      </div>
    </OpsCard>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function CalibrationDashboard() {
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('calibrationScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calRes, outRes] = await Promise.all([
        fetch('/api/findings/calibration'),
        fetch('/api/findings/outcomes?limit=100'),
      ]);
      const calData = await calRes.json().catch(() => null) as CalibrationResponse | null;
      const outData = await outRes.json().catch(() => null) as OutcomesResponse | null;
      if (!calRes.ok) throw new Error('Calibration data unavailable');
      setCalibration(calData);
      setOutcomes(outData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calibration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const stats = calibration?.stats ?? [];
  const summary = calibration?.summary ?? null;
  const outcomeList = outcomes?.outcomes ?? [];

  return (
    <OperationsShell
      activeHref="/intelligence"
      activeNavKey="calibration"
      title="Investigator Calibration"
      description="Learning loop metrics: investigator accuracy, false positive rates, evidence quality, and resolution outcomes. Record finding outcomes to calibrate investigators over time."
      breadcrumbs={[{ label: 'Calibration' }]}
      banner={error ? (
        <SurfaceBanner tone="warning">{error}</SurfaceBanner>
      ) : !loading && stats.length === 0 ? (
        <SurfaceBanner tone="info">
          No calibration data yet. Open a finding in the <a href="/investigations" className="underline font-medium">Investigation Workbench</a>, review the evidence, and record an outcome (true positive, false positive, or inconclusive). Calibration metrics populate as you resolve findings.
        </SurfaceBanner>
      ) : null}
    >
      {loading ? (
        <OpsCard>
          <p className="text-sm text-[var(--vt-text-3)]">Loading calibration data…</p>
        </OpsCard>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          {summary ? <SummaryCards summary={summary} stats={stats} /> : null}

          {/* Accuracy table */}
          <AccuracyTable stats={stats} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />

          {/* Charts row */}
          <div className="grid gap-4 xl:grid-cols-3">
            <OutcomeDistribution outcomes={outcomeList} />
            <FalsePositiveSummary stats={stats} />
            <EvidenceQualityDistribution outcomes={outcomeList} />
          </div>

          {/* FP reasons + recent outcomes */}
          <div className="grid gap-4 xl:grid-cols-2">
            <FalsePositiveReasons stats={stats} />
            <RecentOutcomes outcomes={outcomeList} />
          </div>
        </div>
      )}
    </OperationsShell>
  );
}
