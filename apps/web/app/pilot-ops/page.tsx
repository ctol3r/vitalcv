/**
 * /pilot-ops — Pilot Operations KPI Dashboard
 *
 * Internal-only operator surface showing the 7 Interview-to-Start Velocity KPIs.
 * Reads from /api/internal/pilot/kpis (monitoring-secret gated).
 *
 * SAFE: read-only. Does not mutate trust state, claims, or source truth.
 *
 * Access: set NEXT_PUBLIC_MONITORING_SECRET or pass ?secret= in the URL.
 * In production, protect this route at the infra level (Vercel password, IP allowlist, etc.).
 */

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ScopeFilterForm, StartOutcomeForm } from './PilotOpsForms';
import type { PilotFilter, PilotKpiSnapshot } from '@/lib/pilot/pilotKpiTypes';
import {
  buildBackendPilotKpiParams,
  buildPilotExportHref,
  buildPilotOpsHref,
  readPilotFilterFromPageSearchParams,
} from '@/lib/pilot/pilotKpiQuery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pilot Ops — VitalCV',
  description: 'Internal pilot KPI dashboard. Not public.',
  robots: { index: false, follow: false },
};

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const MONITORING_SECRET = process.env.MONITORING_SECRET ?? '';
const LAUNCH_GATE_ITEMS = [
  'Truthful Public Copy',
  'Canonical Wedge Routes',
  'Packet/Export Trustability',
  'Employer Decision Persistence',
  'Blocker Resolution Metrics',
  'Start Outcome Capture',
  'Source-Health Visibility',
] as const;

const EMPTY_READINESS_DISTRIBUTION: PilotKpiSnapshot['readinessDistribution'] = {
  ready: 0,
  partial: 0,
  blocked: 0,
  total: 0,
  noScore: 0,
};

const EMPTY_PROOF_SUMMARY: PilotKpiSnapshot['proofSummary'] = {
  totalCases: 0,
  startedCases: 0,
  notStartedCases: 0,
  pendingCases: 0,
  casesWithBaseline: 0,
  casesWithMeasuredDelta: 0,
  usableProofCases: 0,
  avgMeasuredDeltaDays: null,
  medianMeasuredDeltaDays: null,
  automaticProofArtifactReady: false,
};

async function fetchKpis(days: number, filter: PilotFilter): Promise<PilotKpiSnapshot | null> {
  if (!MONITORING_SECRET) return null;
  try {
    const params = buildBackendPilotKpiParams(days, filter);

    const res = await fetch(
      `${B}/api/internal/pilot/kpis?${params.toString()}`,
      {
        headers: { 'x-monitoring-secret': MONITORING_SECRET },
        cache:   'no-store',
      },
    );
    if (!res.ok) return null;
    const payload = await res.json() as Partial<PilotKpiSnapshot>;

    return {
      ...payload,
      readinessDistribution: payload.readinessDistribution ?? EMPTY_READINESS_DISTRIBUTION,
      proofCases: payload.proofCases ?? [],
      proofSummary: payload.proofSummary ?? EMPTY_PROOF_SUMMARY,
    } as PilotKpiSnapshot;
  } catch { return null; }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
}) {
  const toneClass: Record<string, string> = {
    green:   'text-emerald-300',
    amber:   'text-amber-300',
    red:     'text-red-400',
    blue:    'text-sky-300',
    neutral: 'text-white',
  };
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneClass[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mt-10 mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/25">{title}</p>
      {sub && <p className="mt-1 text-xs text-white/20">{sub}</p>}
    </div>
  );
}

function velocityLabel(days: number | null, sampleSize: number): string {
  if (sampleSize === 0) return '— (no data yet)';
  if (days === null) return '— (insufficient)';
  return `${days}d`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function PilotOpsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    secret?: string;
    org?: string;
    pilotId?: string;
    lane?: string;
    geo?: string;
  }>;
}) {
  const {
    days: daysParam,
    org: orgParam,
    pilotId: pilotIdParam,
    lane: laneParam,
    geo: geoParam,
  } = await searchParams;
  const days = Math.min(parseInt(daysParam ?? '90', 10) || 90, 365);
  const filter: PilotFilter = readPilotFilterFromPageSearchParams({
    org: orgParam,
    pilotId: pilotIdParam,
    lane: laneParam,
    geo: geoParam,
  });

  const kpi = await fetchKpis(days, filter);

  if (!MONITORING_SECRET) {
    return (
      <main className="min-h-screen bg-[#080e1a] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-amber-400 font-semibold text-sm">MONITORING_SECRET not set</p>
          <p className="text-white/40 text-xs mt-2">
            Set MONITORING_SECRET in your environment variables to access this page.
          </p>
        </div>
      </main>
    );
  }

  if (!kpi) {
    return (
      <main className="min-h-screen bg-[#080e1a] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-red-400 font-semibold text-sm">KPI data unavailable</p>
          <p className="text-white/40 text-xs mt-2">
            Backend unreachable or monitoring secret mismatch.
            Check BACKEND_URL and MONITORING_SECRET.
          </p>
        </div>
      </main>
    );
  }

  const exportUrl = buildPilotExportHref('/api/pilot-kpi-export', days, filter);
  const jsonExportUrl = buildPilotExportHref('/api/pilot-kpi-json', days, filter);
  const notStartedCount = Math.max(0, kpi.reviewsOpened.distinctEntities - kpi.startOutcomes.distinctEntities);
  const appliedScope = [
    { label: 'Org', value: kpi.appliedFilter.orgContextId },
    { label: 'Pilot', value: kpi.appliedFilter.pilotId },
    { label: 'Lane', value: kpi.appliedFilter.workflowLane },
    { label: 'Geography', value: kpi.appliedFilter.geographyTag },
  ].filter((entry): entry is { label: string; value: string } => typeof entry.value === 'string' && entry.value.length > 0);

  return (
    <main className="min-h-screen bg-[#080e1a] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/25">VitalCV — Internal</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Pilot Operations KPIs</h1>
            <p className="mt-1 text-sm text-white/35">
              Interview-to-Start Velocity · {days}-day window · Generated {new Date(kpi.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {(['30', '60', '90'] as const).map((d) => (
              <Link
                key={d}
                href={buildPilotOpsHref(Number(d), filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  String(days) === d
                    ? 'bg-white/10 text-white'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {d}d
              </Link>
            ))}
            <a
              href={exportUrl}
              className="ml-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition"
            >
              ↓ CSV
            </a>
            <a
              href={jsonExportUrl}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition"
            >
              ↓ JSON
            </a>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">Scope Filters</p>
          <p className="mt-1 text-xs text-white/30">
            Narrow the KPI window to a single org context, pilot, workflow lane, or geography.
          </p>
          <ScopeFilterForm
            days={days}
            initialOrg={filter.orgContextId ?? ''}
            initialPilotId={filter.pilotId ?? ''}
            initialLane={filter.workflowLane ?? ''}
            initialGeo={filter.geographyTag ?? ''}
          />
        </div>

        {appliedScope.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
            <span className="font-semibold uppercase tracking-[0.16em] text-white/30">Applied Scope</span>
            {appliedScope.map((entry) => (
              <span key={entry.label} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/65">
                {entry.label}: <span className="font-mono text-white/85">{entry.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Launch Gate Checklist */}
        <div className="mb-6 rounded-xl border border-blue-400/20 bg-blue-400/5 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Launch Gate Readiness</p>
              <p className="mt-1 text-xs text-blue-200/60">
                Strict requirements before running a live pilot. No theater.
              </p>
            </div>
            <div className="text-right text-[10px] uppercase tracking-[0.14em] text-blue-300/45">
              Source of truth
              <div className="mt-1 font-mono normal-case tracking-normal text-blue-100/55">
                docs/specs/vitalcv-launch-gate.md
              </div>
            </div>
          </div>
          <p className="mb-4 text-[11px] text-blue-100/60">
            Read-only gate criteria. Completion is proven in the linked spec and event data, not toggled on this page.
          </p>
          <ul className="grid grid-cols-1 gap-3 text-[11px] text-blue-100/70 sm:grid-cols-2 lg:grid-cols-4">
            {LAUNCH_GATE_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-lg border border-blue-300/12 bg-blue-300/[0.03] px-3 py-2"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300/70" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Gaps banner */}
        {kpi.gaps.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
            <p className="text-xs font-semibold text-amber-300 mb-2">
              ⚠ {kpi.gaps.length} missing event {kpi.gaps.length === 1 ? 'source' : 'sources'} — some KPIs will show "no data yet"
            </p>
            <ul className="space-y-1">
              {kpi.gaps.map((g, i) => (
                <li key={i} className="text-[11px] text-amber-200/60">{g}</li>
              ))}
            </ul>
          </div>
        )}

        {/* KPI 1+2+3 — Funnel */}
        <SectionHeader title="Trust Wedge Funnel" sub="End-to-end: packet → review → decision → start" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiTile
            label="Packets Shared"
            value={kpi.packetShares.total}
            sub={`${kpi.packetShares.distinctEntities} clinicians · ${kpi.packetShares.distinctOrgs} orgs`}
            tone="blue"
          />
          <KpiTile
            label="Employer Reviews Opened"
            value={kpi.reviewsOpened.total}
            sub={`${kpi.reviewsOpened.distinctEntities} distinct clinicians reviewed`}
            tone={kpi.reviewsOpened.total > 0 ? 'green' : 'neutral'}
          />
          <KpiTile
            label="Decisions Made"
            value={kpi.decisions.total}
            sub={`${kpi.decisions.proceedCount} proceed · ${kpi.decisions.refreshCount} refresh`}
            tone={kpi.decisions.total > 0 ? 'green' : 'neutral'}
          />
          <KpiTile
            label="Actual Starts"
            value={kpi.startOutcomes.totalStarts}
            sub={`${kpi.startOutcomes.distinctEntities} clinicians started`}
            tone={kpi.startOutcomes.totalStarts > 0 ? 'green' : 'neutral'}
          />
          <KpiTile
            label="Not Yet Started"
            value={notStartedCount}
            sub="clinicians reviewed but not started"
            tone={notStartedCount > 0 ? 'amber' : 'neutral'}
          />
        </div>

        {/* Decision breakdown */}
        <SectionHeader title="Decisions by Type" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <KpiTile label="Proceed" value={kpi.decisions.proceedCount} tone="green" />
          <KpiTile label="Request Refresh" value={kpi.decisions.refreshCount} tone="amber" />
          <KpiTile label="Route to Review" value={kpi.decisions.routeCount} tone="amber" />
          <KpiTile label="Reject" value={kpi.decisions.rejectCount} tone="red" />
          <KpiTile label="Hold" value={kpi.decisions.holdCount} tone="neutral" />
        </div>

        {/* KPI 4–6 — Velocity */}
        <SectionHeader
          title="Interview-to-Start Velocity"
          sub="Median days between trust wedge events. Requires data in all event tables."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile
            label="First Review → Decision"
            value={velocityLabel(kpi.velocity.medianDaysFirstReviewToDecision, kpi.velocity.sampleSizes.reviewToDecision)}
            sub={`n=${kpi.velocity.sampleSizes.reviewToDecision}`}
            tone={kpi.velocity.medianDaysFirstReviewToDecision !== null ? 'blue' : 'neutral'}
          />
          <KpiTile
            label="First Review → Ready (L2+)"
            value={velocityLabel(kpi.velocity.medianDaysFirstReviewToReady, kpi.velocity.sampleSizes.reviewToReady)}
            sub={`n=${kpi.velocity.sampleSizes.reviewToReady}`}
            tone={kpi.velocity.medianDaysFirstReviewToReady !== null ? 'blue' : 'neutral'}
          />
          <KpiTile
            label="First Review → Start"
            value={velocityLabel(kpi.velocity.medianDaysFirstReviewToStart, kpi.velocity.sampleSizes.reviewToStart)}
            sub={`n=${kpi.velocity.sampleSizes.reviewToStart}`}
            tone={kpi.velocity.medianDaysFirstReviewToStart !== null ? 'green' : 'neutral'}
          />
          <KpiTile
            label="Readiness at Start"
            value={kpi.startOutcomes.readinessAtStart.avgScore !== null
              ? `${kpi.startOutcomes.readinessAtStart.avgScore}/100`
              : '—'}
            sub="avg readiness score"
            tone="neutral"
          />
        </div>

        {/* KPI 7 — Blockers */}
        <SectionHeader title="Blocker Resolution" sub="Categories, open count, avg resolution time" />
        {kpi.blockers.length === 0 ? (
          <p className="text-sm text-white/25 mt-2">
            No blocker events yet. Wire syncBlockerEvents() at readiness recompute to populate.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/6 bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">
                  <th className="px-4 py-3">Blocker Code</th>
                  <th className="px-4 py-3">Open</th>
                  <th className="px-4 py-3">Resolved</th>
                  <th className="px-4 py-3">Avg Days</th>
                  <th className="px-4 py-3">Median Days</th>
                </tr>
              </thead>
              <tbody>
                {kpi.blockers.map((b) => (
                  <tr key={b.code} className="border-b border-white/4 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-white/70">{b.code}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-300">
                      {b.openCount > 0 ? b.openCount : <span className="text-white/20">0</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-emerald-300">
                      {b.resolvedCount > 0 ? b.resolvedCount : <span className="text-white/20">0</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/60">
                      {b.avgResolutionDays !== null ? `${b.avgResolutionDays}d` : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/60">
                      {b.medianResolutionDays !== null ? `${b.medianResolutionDays}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Readiness distribution */}
        <SectionHeader
          title="Readiness Distribution"
          sub="READY/PARTIAL/BLOCKED counts based on latest advisory score per reviewed clinician"
        />
        {kpi.readinessDistribution.total === 0 ? (
          <p className="text-sm text-white/25 mt-2">
            No reviewed clinicians yet — readiness distribution will populate once employer reviews fire.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiTile
              label="READY (≥60)"
              value={kpi.readinessDistribution.ready}
              sub="clinicians ready to start"
              tone="green"
            />
            <KpiTile
              label="PARTIAL (30–59)"
              value={kpi.readinessDistribution.partial}
              sub="some gaps remain"
              tone="amber"
            />
            <KpiTile
              label="BLOCKED (<30)"
              value={kpi.readinessDistribution.blocked}
              sub="hard blockers present"
              tone="red"
            />
            <KpiTile
              label="No Score"
              value={kpi.readinessDistribution.noScore}
              sub="pre-date score capture"
              tone="neutral"
            />
            <KpiTile
              label="Total Reviewed"
              value={kpi.readinessDistribution.total}
              sub="distinct clinicians seen"
              tone="blue"
            />
          </div>
        )}

        {/* Event chain health */}
        <SectionHeader title="Event Chain Health" sub="Confirms all capture points are firing" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 text-xs font-mono">
          {(Object.entries(kpi.eventChain) as [string, number][]).map(([key, count]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <span className="text-white/35 text-[10px]">{key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}</span>
              <span className={count > 0 ? 'text-emerald-400' : 'text-white/20'}>{count}</span>
            </div>
          ))}
        </div>

        <SectionHeader title="Start Outcome Capture" sub="Record confirmed starts from the browser during a live pilot." />
        <StartOutcomeForm filter={filter} />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/6 flex flex-wrap gap-4 text-xs text-white/20">
          <Link href="/" className="hover:text-white/50 transition">Home</Link>
          <Link href="/mission-ops" className="hover:text-white/50 transition">Mission Ops</Link>
          <a href={exportUrl} className="hover:text-white/50 transition">Download CSV</a>
          <span className="ml-auto">INTERNAL — not for public distribution</span>
        </div>

      </div>
    </main>
  );
}
