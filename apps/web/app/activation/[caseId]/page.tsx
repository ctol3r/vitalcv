import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  ONBOARD_STATUS_META,
  PAYER_STATUS_META,
  PRIV_STATUS_META,
  computeActivationCounts,
  criticalPathCompletion,
  demoCase,
  type ActivationCase,
  type CriticalPathStage,
  type Handoff,
  type OnboardingTask,
  type Payer,
  type Privilege,
} from '@/lib/activation/activationData';

export const metadata: Metadata = {
  title: 'Start-Activation Console · Demo · VitalCV',
  description:
    'Demo render of a single credentialing activation case with critical path, privileges, payer enrollment, onboarding tasks, and handoff timeline.',
};

interface PageProps {
  params: Promise<{ caseId: string }>;
}

const TONE_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  slate: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
  purple: 'border-purple-500/30 bg-purple-500/10 text-purple-700',
};

const DEMO_CASE_SLUG = 'demo-001';

export default async function ActivationCasePage({ params }: PageProps) {
  // Only the designated demo slug renders. Any other caseId is a 404:
  // a real case id in the URL must never display fabricated case data.
  const { caseId } = await params;
  if (caseId !== DEMO_CASE_SLUG) {
    notFound();
  }
  const c = demoCase();
  const counts = computeActivationCounts(c);
  const completion = criticalPathCompletion(c);

  return (
    <main
      className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="activation-page"
      data-case-id={c.meta.id}
      data-is-demo={String(c.meta.isDemo)}
      data-completion-pct={String(Math.round(completion * 100))}
    >
      <CaseHeader c={c} />

      <p
        className="mt-4 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800"
        data-testid="activation-demo-banner"
      >
        Demo case — illustrative only, not a real clinician&rsquo;s activation
      </p>

      <BurnDownCard c={c} />

      <CriticalPathSection stages={c.criticalPath} />

      <CountsStrip counts={counts} />

      <PrivilegesSection privileges={c.privileges} />

      <PayerMatrixSection payers={c.payers} />

      <OnboardingSection tasks={c.onboardingTasks} />

      <HandoffsSection handoffs={c.handoffs} />
    </main>
  );
}

function CaseHeader({ c }: { c: ActivationCase }) {
  return (
    <header className="border-b border-border pb-3" data-testid="activation-header">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Start-Activation
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
        {c.meta.clinician}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {c.meta.facility} · NPI {c.meta.npi} · target start {c.meta.startDateLabel}
      </p>
      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Accepted {c.meta.acceptedAt} · {c.meta.daysSinceAccept} days since accept
      </p>
    </header>
  );
}

function BurnDownCard({ c }: { c: ActivationCase }) {
  const dts = c.meta.dtsEstimate;
  const trend = c.meta.dtsTrend;
  return (
    <section
      aria-labelledby="burndown-heading"
      className="mt-6 rounded-md border border-border bg-card p-5"
      data-testid="activation-burndown"
      data-dts-p10={String(dts.p10)}
      data-dts-p50={String(dts.p50)}
      data-dts-p90={String(dts.p90)}
    >
      <h2 id="burndown-heading" className="text-base font-semibold sm:text-lg">
        Days-to-start burn-down
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Predictive range, never a single point. Baseline is the facility
        historical median.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <DtsCell label="P10 (best)" value={`${dts.p10}d`} />
        <DtsCell label="P50 (current)" value={`${dts.p50}d`} highlight />
        <DtsCell label="P90 (worst)" value={`${dts.p90}d`} />
        <DtsCell label="Baseline" value={`${dts.baseline}d`} sub="historical median" />
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          P50 trend (last {trend.length} days)
        </p>
        <ol
          className="mt-2 flex items-end gap-1"
          data-testid="activation-burndown-trend"
        >
          {trend.map((d, i) => {
            const max = Math.max(...trend);
            const h = Math.max(8, Math.round((d / max) * 60));
            return (
              <li
                key={i}
                className="flex-1 rounded-sm bg-foreground/70"
                style={{ height: `${h}px` }}
                title={`Day ${i + 1}: ${d}d`}
                data-trend-day={String(i + 1)}
                data-trend-value={String(d)}
              >
                <span className="sr-only">Day {i + 1}: {d} days</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function DtsCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-md border p-3',
        highlight ? 'border-foreground/30 bg-muted/20' : 'border-border',
      ].join(' ')}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CriticalPathSection({ stages }: { stages: ReadonlyArray<CriticalPathStage> }) {
  return (
    <section
      aria-labelledby="critical-path-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="activation-critical-path"
    >
      <h2 id="critical-path-heading" className="text-base font-semibold sm:text-lg">
        Critical path
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((s) => (
          <li
            key={s.id}
            className={[
              'rounded-md border p-3',
              s.state === 'done' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border',
            ].join(' ')}
            data-stage-id={s.id}
            data-stage-state={s.state}
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
            <p className="mt-2 text-[11px]">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Owner:
              </span>{' '}
              {s.owner}
            </p>
            {s.state === 'done' && s.completedAt && (
              <p className="mt-1 text-[10px] text-emerald-700">
                Done · {s.completedAt}
              </p>
            )}
            {s.state === 'in_progress' && (
              <p className="mt-1 text-[10px] text-amber-700">
                {Math.round((s.progress ?? 0) * 100)}% · ETA {s.eta}
              </p>
            )}
            {s.state === 'pending' && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Pending · ETA {s.eta}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CountsStrip({ counts }: { counts: ReturnType<typeof computeActivationCounts> }) {
  return (
    <section
      aria-labelledby="counts-heading"
      className="mt-6 grid grid-cols-3 gap-3"
      data-testid="activation-counts-strip"
    >
      <h2 id="counts-heading" className="sr-only">
        Track counts
      </h2>
      <CountCell
        title="Privileges"
        primary={`${counts.privileges.granted}/${counts.privileges.total}`}
        sub={`${counts.privileges.inFlight} in flight`}
        testId="count-privileges"
      />
      <CountCell
        title="Payers"
        primary={`${counts.payers.enrolled}/${counts.payers.total}`}
        sub={`${counts.payers.rejected} rejected · action`}
        testId="count-payers"
      />
      <CountCell
        title="Onboarding"
        primary={`${counts.onboarding.done}/${counts.onboarding.total}`}
        sub={`${counts.onboarding.inFlight} in progress`}
        testId="count-onboarding"
      />
    </section>
  );
}

function CountCell({ title, primary, sub, testId }: { title: string; primary: string; sub: string; testId: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3" data-testid={testId}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
        {primary}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function PrivilegesSection({ privileges }: { privileges: ReadonlyArray<Privilege> }) {
  return (
    <section
      aria-labelledby="priv-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="activation-privileges"
    >
      <h2 id="priv-heading" className="text-base font-semibold sm:text-lg">
        Privileges
      </h2>
      <ul className="mt-4 space-y-2">
        {privileges.map((p) => {
          const meta = PRIV_STATUS_META[p.status];
          return (
            <li
              key={p.id}
              className="rounded border border-border/60 bg-background/40 p-3"
              data-priv-id={p.id}
              data-priv-status={p.status}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.category} · {p.bylaws} · {p.fppe}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.counter.current}/{p.counter.required} {p.counter.unit}
                {p.proctor !== '—' && ` · proctor ${p.proctor}`}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{p.note}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PayerMatrixSection({ payers }: { payers: ReadonlyArray<Payer> }) {
  return (
    <section
      aria-labelledby="payer-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="activation-payers"
    >
      <h2 id="payer-heading" className="text-base font-semibold sm:text-lg">
        Payer enrollment matrix
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Federal / state / commercial enrollment status per payer. Real
        integrations are vendor-gated; the demo shows the tracking shape.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs" data-testid="activation-payer-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">Payer</th>
              <th className="px-2 py-1.5">Kind</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Submitted</th>
              <th className="px-2 py-1.5">Effective</th>
            </tr>
          </thead>
          <tbody>
            {payers.map((p) => {
              const meta = PAYER_STATUS_META[p.status];
              return (
                <tr
                  key={p.id}
                  className="border-b border-border/50"
                  data-payer-id={p.id}
                  data-payer-status={p.status}
                  data-actionable={String(p.actionable ?? false)}
                >
                  <td className="px-2 py-1.5">{p.name}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{p.kind}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {p.submittedAt ?? '—'}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {p.effectiveAt ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OnboardingSection({ tasks }: { tasks: ReadonlyArray<OnboardingTask> }) {
  return (
    <section
      aria-labelledby="onb-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="activation-onboarding"
    >
      <h2 id="onb-heading" className="text-base font-semibold sm:text-lg">
        Onboarding tasks
      </h2>
      <ul className="mt-4 space-y-2">
        {tasks.map((t) => {
          const meta = ONBOARD_STATUS_META[t.state];
          return (
            <li
              key={t.id}
              className="rounded border border-border/60 bg-background/40 p-3"
              data-task-id={t.id}
              data-task-state={t.state}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-foreground">{t.label}</p>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Owner: {t.owner} · due {t.dueAt}
                {t.completedAt && ` · completed ${t.completedAt}`}
                {t.subprogress && ` · ${t.subprogress.collected}/${t.subprogress.required}`}
              </p>
              <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                {t.standard}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HandoffsSection({ handoffs }: { handoffs: ReadonlyArray<Handoff> }) {
  return (
    <section
      aria-labelledby="handoff-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="activation-handoffs"
    >
      <h2 id="handoff-heading" className="text-base font-semibold sm:text-lg">
        Owner handoff timeline
      </h2>
      <ol className="mt-4 space-y-3">
        {handoffs.map((h, i) => (
          <li
            key={`${h.at}-${i}`}
            className={[
              'rounded border p-3',
              h.isCurrent ? 'border-foreground/30 bg-muted/20' : 'border-border/60',
            ].join(' ')}
            data-handoff-current={String(Boolean(h.isCurrent))}
          >
            <p className="text-xs text-foreground">
              <span className="font-mono">{h.from.name}</span> ({h.from.role}) →{' '}
              <span className="font-mono">{h.to.name}</span> ({h.to.role})
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {h.at} · {h.artifact}
            </p>
            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
              receipt {h.receipt}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
