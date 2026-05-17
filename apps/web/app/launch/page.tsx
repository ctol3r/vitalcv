import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { RoiCalculator } from '@/components/demo/RoiCalculator';
import { EquityRetentionBlock } from '@/components/demo/EquityRetentionBlock';

/**
 * /launch — belief-first public landing pad.
 *
 * Above-the-fold goal: a hospital operator understands the value in
 * 10 seconds. Headline = primary message; subhead = scope + boundary;
 * 3 audience cards = the persona pitches; followed by an illustrative
 * ROI block, the "does today / remains manual" honest scope block,
 * and a direct-contact section.
 *
 * No backend dependency. No env vars required. Renders identically
 * on a fresh laptop.
 *
 * Foundation-honest framing: claims only what the product actually
 * does. Explicit truth boundary: VitalCV supports review decisions;
 * it does not replace hospital credentialing committees.
 */

export const metadata: Metadata = {
  title: 'VitalCV — Reusable, source-backed clinician readiness.',
  description:
    'Start with an NPI. See what is source-backed, what is gated, and what still needs review before the paperwork starts. VitalCV supports review decisions; it does not replace hospital credentialing committees.',
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
    title: 'Accept as credentialing head start.',
    body: 'Treat source-backed readiness as the head start your committee builds on — not as a replacement for the privileging cycle.',
    cta: { label: 'See the employer view →', href: '/demo/employer' },
  },
  {
    audience: 'For clinicians',
    title: 'See what is ready before paperwork.',
    body: 'One NPI, one preview. Know which lanes are source-backed, which are gated, and which still need review.',
    cta: { label: 'See the clinician view →', href: '/demo/clinician' },
  },
  {
    audience: 'For issuers',
    title: 'Confirm once, reduce repeat questions.',
    body: 'A single issuer confirmation carries forward to the next reviewer. Less queue. Less redundant verification.',
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
      {/* Hero — designed for a 10-second scan. */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            VitalCV
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            Reusable, source-backed clinician readiness.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Start with an NPI. See what is source-backed, what is gated, and
            what still needs review before the paperwork starts.
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

          {/* Truth boundary — explicit and adjacent to the hero CTAs. */}
          <p className="mt-6 max-w-2xl rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              VitalCV supports review decisions;
            </span>{' '}
            it does not replace hospital credentialing committees.
          </p>
        </div>
      </section>

      {/* Three audience cards. */}
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

      {/* Authority ladder. */}
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
                Each claim renders with its source tier so the reader knows
                exactly how far the evidence reaches. No fact is shown without
                naming who attested it.
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

      {/* Illustrative employer ROI block. */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            For employers
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            What the cycle compression is worth — on paper.
          </h2>
          <RoiCalculator className="mt-6" defaultSpecialty="primary_care" />
          <EquityRetentionBlock className="mt-6" />
        </div>
      </section>

      {/* Honest scope — does today / remains manual. */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Operational scope
          </p>
          <h2 className="mt-3 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
            What VitalCV does today.
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Does today
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
                <li className="rounded-md border border-border bg-card p-3">
                  Reads NPPES, OIG LEIE, and PECOS for a given NPI.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  Renders source-backed readiness with explicit tier per fact.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  Issues ES256-signed receipts a reviewer can independently verify.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  Records issuer outcomes (confirmed / unable-to-verify) with audit trail.
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Remains manual / out of scope
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="rounded-md border border-border bg-card p-3">
                  Hospital credentialing committee — hospitals still own this.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  Compliance program — VitalCV is a readiness preview, not certification.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  Risk transfer — reviewers remain responsible for their decisions.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  State-board portals requiring institutional access — surfaced as &quot;access required&quot;, not as clinician fault.
                </li>
                <li className="rounded-md border border-border bg-card p-3">
                  Primary-source replacement — VitalCV reads sources; it does not become one.
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            Structurally permanent. The &quot;Does today&quot; column grows as
            features ship; planned features are not promoted into it ahead of
            code.
          </p>
        </div>
      </section>

      {/* Bottom CTA. */}
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
