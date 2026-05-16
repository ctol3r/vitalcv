import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Demo · VitalCV',
  description:
    'Three demo flows (clinician, employer, issuer) showing how VitalCV reads public sources and renders source-backed readiness. Fixture data; no real ingest.',
};

const TRACKS = [
  {
    audience: 'Clinician',
    href: '/demo/clinician',
    title: 'See your readiness preview.',
    body: 'Walk through how a clinician sees their source-backed readiness across NPPES, OIG, PECOS, and state board.',
  },
  {
    audience: 'Employer',
    href: '/demo/employer',
    title: 'Review applications, calmly.',
    body: 'See three applications across review-recommended / move-forward / waiting-on-sources states with source-backed highlights and honest cautions.',
  },
  {
    audience: 'Issuer',
    href: '/demo/issuer',
    title: 'Issuer confirmation, attributable.',
    body: 'See how a verification request is received, reviewed, and either confirmed or honestly marked unable-to-verify.',
  },
] as const;

export default function DemoIndexPage() {
  return (
    <main className="bg-background min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Demo
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Three flows. Same readiness layer.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each demo uses fixture data, not a live ingest run. The vocabulary,
            tier ladder, and source-honest framing match the production
            product. No claims here that the live product does not make.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {TRACKS.map((t) => (
              <article
                key={t.audience}
                className="flex flex-col rounded-md border border-border bg-card p-6"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  For {t.audience.toLowerCase()}s
                </p>
                <h2 className="mt-3 text-lg font-semibold leading-snug text-foreground">
                  {t.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t.body}
                </p>
                <Button asChild className="mt-6" variant="outline">
                  <Link href={t.href}>Open {t.audience.toLowerCase()} demo</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Demo posture:</span>{' '}
            All three flows render from in-repo fixtures. None requires a
            database connection, a Vercel deployment, or a backend API. They
            are reproducible on any machine that can run{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              pnpm --filter @vitalcv/web dev
            </code>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
