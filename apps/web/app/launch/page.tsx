import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';

/**
 * /launch — focused public landing pad.
 *
 * One page, no auth required, no backend dependency. Loads instantly,
 * survives degraded apex states. Three user paths (clinician,
 * employer, issuer) each pointing at the /demo family so a visitor
 * can see something working in <5 seconds.
 *
 * Foundation-honest framing throughout: claims only what the product
 * actually does ("readiness preview, source-honest") and explicitly
 * disclaims credentialing completion.
 */

export const metadata: Metadata = {
  title: 'VitalCV — Reusable, source-backed clinician readiness.',
  description:
    'Read NPPES, OIG, PECOS once. Every reviewer sees the same source-backed readiness. No credentialing completion claim.',
};

interface PathCard {
  audience: 'For employers' | 'For clinicians' | 'For issuers';
  title: string;
  body: string;
  cta: { label: string; href: string };
}

// Employer-first ordering: hospital operators are the primary 10-second audience.
const PATHS: ReadonlyArray<PathCard> = [
  {
    audience: 'For employers',
    title: 'Days, not weeks, to first start.',
    body: 'Accept source-backed readiness. No re-submission paperwork; no claims you cannot back.',
    cta: { label: 'See the employer view →', href: '/demo/employer' },
  },
  {
    audience: 'For clinicians',
    title: 'One NPI. Your readiness preview.',
    body: 'See what public sources say about you, before any employer asks.',
    cta: { label: 'See the clinician view →', href: '/demo/clinician' },
  },
  {
    audience: 'For issuers',
    title: 'Verify once. Be re-used.',
    body: 'Your confirmation carries forward to the next reviewer — verification work compounds instead of repeating.',
    cta: { label: 'See the issuer view →', href: '/demo/issuer' },
  },
] as const;

const TRUST_STEPS = [
  { tier: 'T1', label: 'Self-asserted', note: 'Clinician typed it.' },
  { tier: 'T2', label: 'AI-inferred', note: 'Extracted from clinician-supplied artifacts.' },
  { tier: 'T3', label: 'Source-checked', note: 'Verified against a primary source (NPPES / OIG / PECOS / state board).' },
  { tier: 'T4', label: 'Issuer-signed', note: 'Cryptographically signed by the issuing authority.' },
] as const;

export default function LaunchPage() {
  return (
    <main className="bg-background min-h-screen">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            VitalCV
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            Reusable, source-backed clinician readiness.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Read NPPES, OIG, and PECOS once. Every reviewer sees the same
            source-backed readiness — decisions move in days, not weeks.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/demo/employer">See the employer view</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/passport">Try with an NPI</Link>
            </Button>
            <Link
              href="/demo/clinician"
              className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
            >
              How it works for clinicians →
            </Link>
          </div>
        </div>
      </section>

      {/* Three user paths */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            One readiness layer. Three audiences.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PATHS.map((p) => (
              <article
                key={p.audience}
                className="flex flex-col rounded-md border border-border bg-card p-6"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {p.audience}
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-snug text-foreground">
                  {p.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                <Link
                  href={p.cta.href}
                  className="mt-6 inline-flex items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {p.cta.label}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Trust ladder */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Authority ladder
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                Every fact carries its tier.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Nothing is presented as &quot;verified&quot; without naming who
                verified it. Each claim renders with its source tier so the
                reader knows exactly how far the evidence reaches.
              </p>
            </div>
            <ol className="space-y-3">
              {TRUST_STEPS.map((s) => (
                <li
                  key={s.tier}
                  className="flex items-start gap-4 rounded-md border border-border bg-card p-4"
                >
                  <span className="rounded-sm bg-foreground/5 px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                    {s.tier}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {s.note}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* What we don't claim */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            What VitalCV does not do
          </p>
          <ul className="mt-6 grid gap-3 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <li className="rounded-md border border-border bg-card p-4">
              <span className="font-medium text-foreground">
                Does not finish credentialing.
              </span>{' '}
              Hospitals still own the credentialing decision.
            </li>
            <li className="rounded-md border border-border bg-card p-4">
              <span className="font-medium text-foreground">
                Does not certify compliance.
              </span>{' '}
              VitalCV is a readiness preview, not a compliance program.
            </li>
            <li className="rounded-md border border-border bg-card p-4">
              <span className="font-medium text-foreground">
                Does not transfer risk.
              </span>{' '}
              Reviewers remain responsible for their decisions.
            </li>
            <li className="rounded-md border border-border bg-card p-4">
              <span className="font-medium text-foreground">
                Does not replace primary sources.
              </span>{' '}
              We READ public sources; we don&apos;t become one.
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
          <div className="rounded-md border border-border bg-card p-8 sm:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Apply with VitalCV
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              Start ready. Stop restarting.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Each application carries your readiness preview so reviewers see
              the same source-backed picture you do.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/demo/employer">See the employer view first</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
