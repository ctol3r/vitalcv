import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { LeadCaptureBlock } from '@/components/lead-capture/LeadCaptureBlock';
import {
  DEMO_ISSUER_REQUESTS,
  ISSUER_STATUS_LABEL,
  type DemoIssuerRequest,
} from '../_seed';

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const metadata: Metadata = {
  title: 'Issuer demo · VitalCV',
  description:
    "How an issuer (registrar, board, employer-HR) sees and resolves verification requests. Fixture data; recorded as 'demo' attribution.",
};

function statusTone(status: DemoIssuerRequest['status']): string {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'in_review':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400';
    case 'received':
      return 'border-border bg-muted text-foreground';
    case 'unable_to_verify':
    default:
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  }
}

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const CLAIM_TYPE_LABEL: Record<DemoIssuerRequest['claimType'], string> = {
  education_degree: 'Education / Degree',
  board_certification: 'Board Certification',
  employment_history: 'Employment History',
};

export default function IssuerDemoPage() {
  const reqs = DEMO_ISSUER_REQUESTS;

  return (
    <main className="bg-background min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Issuer demo · Fixture
          </p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Less redundant verification.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Three live request shapes: confirmed, in-review, and
            unable-to-verify. Each carries an audit trail; the issuer
            (registrar, board, HR) makes the call. VitalCV records the
            outcome and makes it reusable for the next reviewer — your
            verification work compounds instead of repeating.
          </p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
        <div className="space-y-3">
          {reqs.map((r) => (
            <article
              key={r.requestId}
              className="rounded-md border border-border bg-card p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {CLAIM_TYPE_LABEL[r.claimType]} · Request {r.requestId}
                  </p>
                  <h2 className="mt-2 text-base font-semibold leading-snug text-foreground">
                    {r.claimSummary}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Subject: {r.candidateName} · NPI{' '}
                    <span className="font-mono">{r.candidateNpi}</span>
                    <br />
                    Issuer: {r.issuerOrg}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Received {formatAt(r.receivedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(r.status)}`}
                >
                  {ISSUER_STATUS_LABEL[r.status]}
                </span>
              </div>

              {r.notes && (
                <div className="mt-4 rounded-md border border-border bg-background p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                    {r.notes}
                  </p>
                </div>
              )}

              {r.audit.length > 0 && (
                <div className="mt-4 rounded-md border border-border bg-background p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Audit trail
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {r.audit.map((entry, i) => (
                      <li key={i} className="flex items-start gap-3 text-xs">
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {shortTime(entry.at)}
                        </span>
                        <span className="shrink-0 rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {entry.actor}
                        </span>
                        <span className="text-foreground/80">{entry.action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {r.status === 'received' && (
                  <>
                    <Button size="sm">Start review</Button>
                    <Button size="sm" variant="outline">
                      Decline
                    </Button>
                  </>
                )}
                {r.status === 'in_review' && (
                  <>
                    <Button size="sm" variant="default">
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline">
                      Mark unable to verify
                    </Button>
                    <Button size="sm" variant="outline">
                      Request additional info
                    </Button>
                  </>
                )}
                {r.status === 'confirmed' && (
                  <>
                    <Button size="sm" variant="outline">
                      View receipt
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Issuer-confirmed; available for reuse by next reviewer.
                    </span>
                  </>
                )}
                {r.status === 'unable_to_verify' && (
                  <>
                    <Button size="sm" variant="outline">
                      Notify clinician
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      No fault to clinician; reviewer may request additional
                      artifacts to resolve.
                    </span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-md border border-border bg-muted/30 p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Issuer truth contract
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>
              Issuer decisions are <strong>attributable</strong> — every
              outcome carries who recorded it, when, and on what basis.
            </li>
            <li>
              Unable-to-verify is <strong>not a failure of the clinician</strong> —
              it is a property of the issuer&apos;s lookup, and is recorded as
              such.
            </li>
            <li>
              A confirmed result is <strong>re-usable by the next reviewer</strong> —
              the same clinician does not have to be re-verified by every
              employer.
            </li>
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/demo/employer">← Employer view</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/demo/clinician">Clinician view</Link>
          </Button>
          <Link
            href="/demo"
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
          >
            All demos
          </Link>
        </div>

        <LeadCaptureBlock
          className="mt-10"
          eyebrow="Issuer integration"
          heading="Issuer integration request."
          body="Confirm a credential once; it carries forward to every reviewer. Less queue. Less redundant verification."
          defaultIntent="walkthrough"
          storageKey="issuer-demo"
        />
      </section>
    </main>
  );
}
