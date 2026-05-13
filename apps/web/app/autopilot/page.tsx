import * as React from 'react';
import type { Metadata } from 'next';

import {
  ACTION_META,
  DRIFT_META,
  KIND_META,
  PORTABILITY_META,
  SEVERITY_META,
  computeCompositeTrustScore,
  computeRenewalCounts,
  demoAutopilot,
  type AutopilotClinician,
  type DriftField,
  type NbaEntry,
  type PortabilityEntry,
  type RenewalEntry,
  type TrustFactor,
} from '@/lib/autopilot/autopilotData';

export const metadata: Metadata = {
  title: 'Career Autopilot · Demo · VitalCV',
  description:
    'Demo render of the clinician-side Career Autopilot dashboard — renewal radar, portability map, next-best actions, drift monitor, and trust score.',
};

const TONE_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  slate: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
};

export default function AutopilotPage() {
  const a = demoAutopilot();
  const compositeScore = computeCompositeTrustScore(a.trustFactors);
  const counts = computeRenewalCounts(a.renewals);

  return (
    <main
      className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="autopilot-page"
      data-is-demo={String(a.clinician.isDemo)}
      data-trust-level={a.clinician.trustLevel}
      data-composite-trust-score={String(compositeScore)}
    >
      <Header clinician={a.clinician} />

      <p
        className="mt-4 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800"
        data-testid="autopilot-demo-banner"
      >
        Demo autopilot — illustrative only, not a real clinician&rsquo;s state
      </p>

      <TrustScorePanel
        clinician={a.clinician}
        factors={a.trustFactors}
        compositeScore={compositeScore}
      />

      <RenewalRadar renewals={a.renewals} counts={counts} />

      <NbaQueue items={a.nba} />

      <PortabilityMap entries={a.portability} />

      <DriftMonitor drift={a.drift} />
    </main>
  );
}

function Header({ clinician }: { clinician: AutopilotClinician }) {
  return (
    <header className="border-b border-border pb-3" data-testid="autopilot-header">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Career Autopilot
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
        {clinician.name}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        NPI {clinician.npi} · Home {clinician.homeState} · {clinician.primaryFacility}
      </p>
      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Monitoring since {clinician.monitoringSince} · Last full sync {clinician.lastFullSync} · {clinician.enrollmentsActive} active enrollments
      </p>
    </header>
  );
}

function TrustScorePanel({
  clinician,
  factors,
  compositeScore,
}: {
  clinician: AutopilotClinician;
  factors: ReadonlyArray<TrustFactor>;
  compositeScore: number;
}) {
  return (
    <section
      aria-labelledby="trust-heading"
      className="mt-6 rounded-md border border-border bg-card p-5"
      data-testid="autopilot-trust-panel"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="trust-heading" className="text-base font-semibold sm:text-lg">
          Trust score
        </h2>
        <p
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
          data-testid="trust-tier-label"
        >
          Tier {clinician.trustLevel}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Weighted composite of source-check freshness, sanctions monitoring,
        attestation currency, malpractice coverage, CME pace, and profile drift.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ScoreCell label="Composite" value={`${(compositeScore * 100).toFixed(0)}%`} sub="Weighted" testId="trust-score-composite" highlight />
        <ScoreCell label="Headline (snapshot)" value={`${(clinician.trustScore * 100).toFixed(0)}%`} sub="As of last full sync" testId="trust-score-headline" />
        <ScoreCell label="Factors" value={String(factors.length)} sub="Composite inputs" testId="trust-score-factor-count" />
      </div>

      <ol className="mt-4 space-y-2">
        {factors.map((f, i) => (
          <li
            key={`${f.label}-${i}`}
            className="rounded border border-border/60 bg-background/40 p-3"
            data-testid="trust-factor"
            data-factor-weight={String(f.weight)}
            data-factor-score={String(f.score)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{f.label}</p>
              <p className="text-[10px] font-mono text-muted-foreground tabular-nums">
                weight {(f.weight * 100).toFixed(0)}% · score {(f.score * 100).toFixed(0)}%
              </p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{f.note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ScoreCell({
  label,
  value,
  sub,
  testId,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  testId: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-md border p-3',
        highlight ? 'border-foreground/30 bg-muted/20' : 'border-border',
      ].join(' ')}
      data-testid={testId}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function RenewalRadar({
  renewals,
  counts,
}: {
  renewals: ReadonlyArray<RenewalEntry>;
  counts: ReturnType<typeof computeRenewalCounts>;
}) {
  // Sort by daysToExpire ascending so most-urgent rows are first.
  const sorted = [...renewals].sort((a, b) => a.daysToExpire - b.daysToExpire);
  return (
    <section
      aria-labelledby="renewal-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="autopilot-renewal-radar"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="renewal-heading" className="text-base font-semibold sm:text-lg">
          Renewal radar
        </h2>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {counts.urgent} urgent · {counts.expiring} expiring · {counts.renewSelf} renew · {counts.monitoring} monitoring
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every credential plotted on a 0–540 day horizon. Authority fields are
        vendor-neutral in the demo; real vendor integrations are out of scope.
      </p>
      <ul
        className="mt-4 space-y-2"
        data-testid="autopilot-renewal-list"
      >
        {sorted.map((r) => {
          const meta = ACTION_META[r.action];
          const kind = KIND_META[r.kind];
          return (
            <li
              key={r.id}
              className="rounded border border-border/60 bg-background/40 p-3"
              data-renewal-id={r.id}
              data-renewal-kind={r.kind}
              data-renewal-action={r.action}
              data-days-to-expire={String(r.daysToExpire)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-[10px] font-mono text-muted-foreground/70 mr-2">
                    {kind.glyph}
                  </span>
                  {r.label}
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Expires {r.expires} · {r.daysToExpire}d · {r.protocol}
              </p>
              <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                authority: {r.authority}
                {r.fee && r.fee !== 'no fee' && ` · fee ${r.fee}`}
                {r.cmeRequired !== null && r.cmeOnFile !== null && ` · ${r.cmeOnFile}/${r.cmeRequired} CME`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NbaQueue({ items }: { items: ReadonlyArray<NbaEntry> }) {
  return (
    <section
      aria-labelledby="nba-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="autopilot-nba-queue"
    >
      <h2 id="nba-heading" className="text-base font-semibold sm:text-lg">
        Next-best actions
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Concrete, ranked. CTAs are placeholders in Phase 1 — accept-into-action
        wiring is a follow-up.
      </p>
      <ol className="mt-4 space-y-3" data-testid="autopilot-nba-list">
        {items.map((n) => {
          const meta = SEVERITY_META[n.severity];
          return (
            <li
              key={n.id}
              className="rounded border border-border/60 bg-background/40 p-3"
              data-nba-id={n.id}
              data-nba-severity={n.severity}
              data-nba-rank={String(n.rank)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-[10px] font-mono text-muted-foreground/70 mr-2">
                    #{n.rank}
                  </span>
                  {n.title}
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{n.subtitle}</p>
              <p className="mt-1 text-xs text-foreground">{n.impact}</p>
              <p className="mt-1 text-[10px] font-mono text-muted-foreground/70">
                {n.receipt}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Action wiring — Phase 2"
                  className="inline-flex items-center rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-background opacity-50 cursor-not-allowed"
                  data-testid="nba-cta-primary"
                  data-disabled-reason="phase-2-pending"
                >
                  {n.ctaLabel}
                </button>
                {n.ctaSecondary && (
                  <button
                    type="button"
                    disabled
                    title="Action wiring — Phase 2"
                    className="inline-flex items-center rounded border border-border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider opacity-50 cursor-not-allowed"
                    data-testid="nba-cta-secondary"
                  >
                    {n.ctaSecondary}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PortabilityMap({ entries }: { entries: ReadonlyArray<PortabilityEntry> }) {
  return (
    <section
      aria-labelledby="portability-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="autopilot-portability-map"
    >
      <h2 id="portability-heading" className="text-base font-semibold sm:text-lg">
        Portability map
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        States where the clinician is licensed, compact-eligible, or has
        dormant credentials.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="autopilot-portability-list">
        {entries.map((p) => {
          const meta = PORTABILITY_META[p.status];
          return (
            <li
              key={p.state}
              className="rounded border border-border/60 bg-background/40 p-3"
              data-state-code={p.state}
              data-portability-status={p.status}
              data-primary={String(p.primary)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-[10px] font-mono text-muted-foreground/70 mr-2">
                    {p.state}
                  </span>
                  {p.name}
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.since ? `Since ${p.since}` : 'Not yet active'} · {p.payers} payer{p.payers === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{p.note}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DriftMonitor({ drift }: { drift: ReadonlyArray<DriftField> }) {
  return (
    <section
      aria-labelledby="drift-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="autopilot-drift-monitor"
    >
      <h2 id="drift-heading" className="text-base font-semibold sm:text-lg">
        Drift monitor
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        For each canonical profile field, when was the last primary-source
        check vs. the last attestation? A field with a primary-source check
        is treated as fresh; without one it is divergent.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs" data-testid="autopilot-drift-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">Field</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Last source check</th>
              <th className="px-2 py-1.5">Last attested</th>
              <th className="px-2 py-1.5">Authority</th>
            </tr>
          </thead>
          <tbody>
            {drift.map((d) => {
              const meta = DRIFT_META[d.status];
              return (
                <tr
                  key={d.id}
                  className="border-b border-border/50"
                  data-drift-field={d.id}
                  data-drift-status={d.status}
                >
                  <td className="px-2 py-1.5">{d.label}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{d.verifiedAt ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{d.attestedAt}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{d.authority}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
