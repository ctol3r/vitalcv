import * as React from 'react';
import type { Metadata } from 'next';

import {
  autoResolvePct,
  complianceAlignmentPct,
  demoCohort,
  dtsCompressionPct,
  latestDts,
  type BlockerFunnelStage,
  type ComplianceGridRow,
  type DtsTimelineEntry,
  type FinancialImpact,
  type RoiMeta,
} from '@/lib/roi/roiData';

export const metadata: Metadata = {
  title: 'Executive ROI · Demo · VitalCV',
  description:
    'Demo cohort showing days-to-start compression, blocker funnel, compliance alignment, and financial impact methodology.',
};

export default function RoiDashboardPage() {
  const cohort = demoCohort();
  const dtsCompress = dtsCompressionPct(cohort.dtsTimeline);
  const autoPct = autoResolvePct(cohort.blockerFunnel);
  const compliancePct = complianceAlignmentPct(cohort.complianceGrid);
  const last = latestDts(cohort.dtsTimeline);

  return (
    <main
      className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="roi-dashboard-page"
      data-is-demo={String(cohort.meta.isDemo)}
      data-cohort-size={String(cohort.meta.cohortSize)}
    >
      <RoiHeader meta={cohort.meta} />

      <p
        className="mt-4 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800"
        data-testid="roi-demo-banner"
      >
        Demo cohort — illustrative only, not a real customer outcome
      </p>

      <KpiStrip
        currentDts={last?.cohortP50 ?? null}
        baseline={last?.baseline ?? null}
        dtsCompressionPct={dtsCompress}
        autoResolvePct={autoPct}
        compliancePct={compliancePct}
        capturedRevenueLabel={cohort.financialImpact.capturedRevenueLabel}
      />

      <DtsSection timeline={cohort.dtsTimeline} />

      <BlockerFunnelSection funnel={cohort.blockerFunnel} />

      <ComplianceGridSection grid={cohort.complianceGrid} alignmentPct={compliancePct} />

      <FinancialImpactSection impact={cohort.financialImpact} />
    </main>
  );
}

function RoiHeader({ meta }: { meta: RoiMeta }) {
  return (
    <header className="border-b border-border pb-3" data-testid="roi-header">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Executive ROI
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
        {meta.org}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {meta.cohortSize} active files · {meta.facilities} facilities · {meta.reportPeriod}
      </p>
      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Generated {meta.generatedAt} · {meta.trailing} · vs {meta.comparator}
      </p>
    </header>
  );
}

interface KpiStripProps {
  currentDts: number | null;
  baseline: number | null;
  dtsCompressionPct: number | null;
  autoResolvePct: number | null;
  compliancePct: number;
  capturedRevenueLabel: string;
}

function KpiStrip({
  currentDts,
  baseline,
  dtsCompressionPct: compressPct,
  autoResolvePct: autoPct,
  compliancePct,
  capturedRevenueLabel,
}: KpiStripProps) {
  return (
    <section
      aria-labelledby="kpi-heading"
      className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      data-testid="roi-kpi-strip"
    >
      <h2 id="kpi-heading" className="sr-only">
        Headline metrics
      </h2>
      <Kpi
        label="DTS · cohort P50"
        value={currentDts !== null ? `${currentDts}d` : '—'}
        sub={
          baseline !== null && compressPct !== null
            ? `${compressPct}% under ${baseline}d baseline`
            : '—'
        }
        testId="kpi-dts"
        dataAttr={{ 'data-dts-current': String(currentDts ?? '') }}
      />
      <Kpi
        label="Blockers auto-resolved"
        value={autoPct !== null ? `${autoPct}%` : '—'}
        sub="No reviewer touch"
        testId="kpi-auto"
        dataAttr={{ 'data-auto-pct': String(autoPct ?? '') }}
      />
      <Kpi
        label="Compliance aligned"
        value={`${compliancePct}%`}
        sub="NCQA / TJC / CMS"
        testId="kpi-compliance"
        dataAttr={{ 'data-compliance-pct': String(compliancePct) }}
      />
      <Kpi
        label="Captured revenue"
        value={capturedRevenueLabel}
        sub="±18% range applied"
        testId="kpi-capture"
        dataAttr={{}}
      />
    </section>
  );
}

interface KpiProps {
  label: string;
  value: string;
  sub: string;
  testId: string;
  dataAttr: Record<string, string>;
}

function Kpi({ label, value, sub, testId, dataAttr }: KpiProps) {
  return (
    <div
      className="rounded-md border border-border bg-card p-4"
      data-testid={testId}
      {...dataAttr}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function DtsSection({ timeline }: { timeline: ReadonlyArray<DtsTimelineEntry> }) {
  return (
    <section
      aria-labelledby="dts-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="roi-dts-section"
    >
      <h2 id="dts-heading" className="text-base font-semibold sm:text-lg">
        Days-to-start (DTS) compression
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cohort P50 with P10 / P90 confidence band, per quarter, vs the
        pre-rollout baseline of 47 days. Phase 1 renders the table; the
        sparkline / SVG chart lands in Phase 2.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs" data-testid="roi-dts-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">Period</th>
              <th className="px-2 py-1.5 text-right">P10</th>
              <th className="px-2 py-1.5 text-right">P50</th>
              <th className="px-2 py-1.5 text-right">P90</th>
              <th className="px-2 py-1.5 text-right">n</th>
              <th className="px-2 py-1.5">Label</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((row) => (
              <tr
                key={row.period}
                className="border-b border-border/50"
                data-period={row.period}
              >
                <td className="px-2 py-1.5 font-mono">{row.period}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.cohortP10}d</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{row.cohortP50}d</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.cohortP90}d</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.n}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{row.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BlockerFunnelSection({ funnel }: { funnel: ReadonlyArray<BlockerFunnelStage> }) {
  return (
    <section
      aria-labelledby="funnel-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="roi-funnel-section"
    >
      <h2 id="funnel-heading" className="text-base font-semibold sm:text-lg">
        Blocker resolution funnel
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Where credentialing blockers land in the cohort, from auto-resolved
        through Credentials Committee escalation.
      </p>
      <ul className="mt-4 space-y-2">
        {funnel.map((stage) => (
          <li
            key={stage.id}
            className="rounded border border-border/60 bg-background/40 p-3"
            data-stage-id={stage.id}
            data-stage-count={String(stage.count)}
            data-stage-pct={String(stage.pct)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{stage.label}</p>
              <p className="text-sm font-mono tabular-nums text-foreground">
                {stage.count.toLocaleString()}
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {(stage.pct * 100).toFixed(1)}%
                </span>
              </p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{stage.sub}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComplianceGridSection({
  grid,
  alignmentPct,
}: {
  grid: ReadonlyArray<ComplianceGridRow>;
  alignmentPct: number;
}) {
  return (
    <section
      aria-labelledby="compliance-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="roi-compliance-section"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="compliance-heading" className="text-base font-semibold sm:text-lg">
          Compliance alignment grid
        </h2>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {alignmentPct}% aligned
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Demo cohort mapped against NCQA CR-3 / CR-7, TJC MS.06 / MS.08, and
        CMS CoP §482.22.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs" data-testid="roi-compliance-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">Authority</th>
              <th className="px-2 py-1.5">Standard</th>
              <th className="px-2 py-1.5">Topic</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Cohort</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, i) => (
              <tr
                key={`${row.authority}-${row.std}-${i}`}
                className="border-b border-border/50"
                data-authority={row.authority}
                data-status={row.status}
              >
                <td className="px-2 py-1.5 font-mono">{row.authority}</td>
                <td className="px-2 py-1.5 font-mono">{row.std}</td>
                <td className="px-2 py-1.5">{row.topic}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={[
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                      row.status === 'aligned'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : row.status === 'gap'
                        ? 'border-red-500/30 bg-red-500/10 text-red-700'
                        : 'border-slate-400/40 bg-slate-500/10 text-slate-600',
                    ].join(' ')}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-mono tabular-nums">{row.cohort}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinancialImpactSection({ impact }: { impact: FinancialImpact }) {
  return (
    <section
      aria-labelledby="impact-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="roi-financial-section"
    >
      <h2 id="impact-heading" className="text-base font-semibold sm:text-lg">
        Financial impact
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Methodology is shown verbatim; a ±18% confidence range is applied to
        the captured-revenue figure.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ImpactStat label="Captured revenue" value={impact.capturedRevenueLabel} sub={`Range $${(impact.rangeLow / 1e6).toFixed(2)}M – $${(impact.rangeHigh / 1e6).toFixed(2)}M`} />
        <ImpactStat label="Net of platform cost" value={impact.netImpactLabel} sub={`Platform cost $${(impact.platformCost / 1e3).toFixed(0)}k`} />
        <ImpactStat label="Payback" value={`${impact.paybackDays} days`} sub={impact.comparator} />
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Methodology
      </h3>
      <ol className="mt-2 space-y-2 text-xs">
        {impact.methodology.map((step, i) => (
          <li key={i} className="rounded border border-border/60 bg-background/40 p-3">
            <p className="font-medium text-foreground">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-2">
                {String(i + 1).padStart(2, '0')}
              </span>
              {step.k}: <span className="font-mono tabular-nums">{step.v}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{step.sub}</p>
          </li>
        ))}
      </ol>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        By facility
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs" data-testid="roi-by-facility-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">Facility</th>
              <th className="px-2 py-1.5 text-right">Files</th>
              <th className="px-2 py-1.5 text-right">Days saved</th>
              <th className="px-2 py-1.5 text-right">Capture</th>
            </tr>
          </thead>
          <tbody>
            {impact.byFacility.map((row) => (
              <tr key={row.facility} className="border-b border-border/50" data-facility={row.facility}>
                <td className="px-2 py-1.5">{row.facility}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.files}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.days.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">${row.capture.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImpactStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
