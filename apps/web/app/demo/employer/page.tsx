import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { RoiCalculator } from '@/components/demo/RoiCalculator';
import { EquityRetentionBlock } from '@/components/demo/EquityRetentionBlock';
import {
  DEMO_EMPLOYER_APPLICATIONS,
  STATE_LABEL,
  type DemoEmployerApplication,
} from '../_seed';

export const metadata: Metadata = {
  title: 'Employer demo · VitalCV',
  description:
    'How an employer reviewer sees source-backed readiness across three review states, plus an illustrative ROI calculator and equity-retention research signals. Fixture data — illustrative.',
};

function stateTone(state: DemoEmployerApplication['state']): string {
  switch (state) {
    case 'move_forward':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'review_recommended':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'waiting_on_sources':
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function EmployerDemoPage() {
  const apps = DEMO_EMPLOYER_APPLICATIONS;
  const counts = {
    move_forward: apps.filter((a) => a.state === 'move_forward').length,
    review_recommended: apps.filter((a) => a.state === 'review_recommended').length,
    waiting_on_sources: apps.filter((a) => a.state === 'waiting_on_sources').length,
  };

  return (
    <main className="bg-background min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Employer demo · Illustrative
          </p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Accept as credentialing head start.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Three applications across the three review states a reviewer
            actually sees. Source-backed highlights, honest cautions, no
            re-submission paperwork. The reviewer picks the next action;
            VitalCV does not make the credentialing decision.
          </p>
          <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Boundary:</span>{' '}
            VitalCV supports review decisions; it does not replace hospital
            credentialing committees.
          </p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
        {/* Summary chips */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Move forward
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {counts.move_forward}
            </p>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
              Review recommended
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {counts.review_recommended}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Waiting on sources
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {counts.waiting_on_sources}
            </p>
          </div>
        </div>

        {/* Application rows */}
        <div className="mt-8 space-y-3">
          {apps.map((a) => (
            <article
              key={a.applicationId}
              className="rounded-md border border-border bg-card p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {a.role} · {a.organization}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground">
                    {a.candidate.displayName}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.candidate.specialty} · NPI{' '}
                    <span className="font-mono">{a.candidate.npi}</span> ·
                    Applied {formatAt(a.appliedAt)}
                  </p>
                  {a.candidate.setting && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Setting: {a.candidate.setting}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Sources {a.sourcesCompleted}/{a.sourcesTotal} · Last refreshed {shortTime(a.sourceCheckedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${stateTone(a.state)}`}
                >
                  {STATE_LABEL[a.state]}
                </span>
              </div>

              {a.highlights.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Highlights
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
                    {a.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {a.cautions.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Cautions
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
                    {a.cautions.map((cn, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-600 dark:text-amber-400">⚠</span>
                        <span>{cn}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button size="sm" variant={a.state === 'move_forward' ? 'default' : 'outline'}>
                  Move forward
                </Button>
                <Button size="sm" variant="outline">Request review</Button>
                <Button size="sm" variant="outline">Mark follow-up</Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  Reviewer choice. No automatic decision.
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* Interactive ROI calculator */}
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Illustrative ROI
          </p>
          <RoiCalculator className="mt-3" defaultSpecialty="primary_care" />
        </div>

        {/* Equity & retention research signals */}
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Why retention matters
          </p>
          <EquityRetentionBlock className="mt-3" />
        </div>

        {/* Footer */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/demo/clinician">← Clinician view</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/demo/issuer">Issuer view →</Link>
          </Button>
          <Link
            href="/demo"
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
          >
            All demos
          </Link>
        </div>
      </section>
    </main>
  );
}
