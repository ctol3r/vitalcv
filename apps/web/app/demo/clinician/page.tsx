import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { LeadCaptureBlock } from '@/components/lead-capture/LeadCaptureBlock';
import {
  DEMO_CLINICIAN,
  STATUS_LABEL,
  type DemoSource,
} from '../_seed';

const FRESHNESS_LABEL = {
  current: 'Current',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
  no_expiry: 'No expiry',
} as const;

function freshnessTone(f: 'current' | 'expiring_soon' | 'expired' | 'no_expiry'): string {
  if (f === 'current') return 'text-emerald-600 dark:text-emerald-400';
  if (f === 'expiring_soon') return 'text-amber-600 dark:text-amber-400';
  if (f === 'expired') return 'text-destructive';
  return 'text-muted-foreground';
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const metadata: Metadata = {
  title: 'Clinician demo · VitalCV',
  description:
    "What a clinician sees when their NPI's readiness preview renders. Fixture data — no real ingest.",
};

function formatChecked(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusTone(status: DemoSource['status']): string {
  switch (status) {
    case 'source_backed':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'access_required':
      return 'text-amber-600 dark:text-amber-400';
    case 'pending':
      return 'text-muted-foreground';
    case 'not_yet':
    default:
      return 'text-muted-foreground';
  }
}

export default function ClinicianDemoPage() {
  const c = DEMO_CLINICIAN;

  return (
    <main className="bg-background min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Clinician demo · Fixture
          </p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Finally reusable.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            One source-backed readiness preview that every reviewer sees — no
            re-submission, no restart. This page is a fixture render; the
            shape matches what the live product produces against real public
            sources.
          </p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        {/* Identity */}
        <div className="rounded-md border border-border bg-card p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Provider
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-tight text-foreground">
            {c.displayName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.specialty} · NPI{' '}
            <span className="font-mono">{c.npi}</span> · {c.state}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Checked {formatChecked(c.lastCheckedAt)}
          </p>
        </div>

        {/* Source rows */}
        <div className="mt-6 rounded-md border border-border bg-card p-2 sm:p-3">
          <ul className="divide-y divide-border">
            {c.sources.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-4 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {s.name}
                    </p>
                    <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                      {s.tier}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {s.detail}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Checked {shortTime(s.checkedAt)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-xs font-medium ${statusTone(s.status)}`}
                >
                  {STATUS_LABEL[s.status]}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Readiness summary */}
        <div className="mt-6 rounded-md border border-border bg-card p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Readiness preview
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                {c.readinessScore}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  /100
                </span>
              </p>
            </div>
            <p className="rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
              {c.readinessLevel}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Readiness is a preview of source-backed signals, not a credentialing
            decision. Hospitals still complete their own credentialing process.
          </p>
        </div>

        {/* Credentials */}
        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Credentials on file
          </p>
          <div className="mt-3 rounded-md border border-border bg-card">
            <ul className="divide-y divide-border">
              {c.credentials.map((cred) => (
                <li
                  key={cred.name}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {cred.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cred.issuer} · Issued {cred.issuedOn}
                      {cred.expiresOn ? ` · Expires ${cred.expiresOn}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                      {cred.tier}
                    </span>
                    <span className={`text-[10px] font-medium ${freshnessTone(cred.freshness)}`}>
                      {FRESHNESS_LABEL[cred.freshness]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/demo/employer">See employer view →</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/passport">Try with your NPI</Link>
          </Button>
          <Link
            href="/demo"
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
          >
            ← All demos
          </Link>
        </div>

        <LeadCaptureBlock
          className="mt-10"
          eyebrow="Clinician early access"
          heading="Be among the first clinicians on VitalCV."
          body="One readiness preview. Reusable across every employer that accepts it."
          defaultIntent="early_access"
          storageKey="clinician-demo"
        />
      </section>
    </main>
  );
}
