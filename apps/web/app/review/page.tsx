import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

export const metadata: Metadata = {
  title: 'Employer Review',
  description:
    'Review a source-backed clinician readiness snapshot before making a credentialing or recruiting decision.',
  openGraph: {
    title: 'Employer Review',
    description:
      'Review a source-backed clinician readiness snapshot before making a credentialing or recruiting decision.',
    url: 'https://vitalcv.com/review',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Employer Review',
    description:
      'Review a source-backed clinician readiness snapshot before making a credentialing or recruiting decision.',
  },
};

export default function ReviewLandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 pb-16 pt-20">
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Employer review
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Review readiness for an active hiring decision
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Review a source-backed readiness snapshot before making a
              credentialing or recruiting decision. Start with a pilot review
              request from NPI, or open an existing entity-specific review link.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={PUBLIC_WEDGE_ROUTE_TARGETS.reviewRequestEntry}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white transition hover:opacity-90"
            >
              Request pilot review
            </Link>
            <Button asChild variant="outline" className="h-11 w-full rounded-xl">
              <Link href="/onboarding">Start with NPI lookup</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60">
            Shared review links open directly when a valid entity-specific link is available.
          </p>

          <div
            className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-left text-xs text-muted-foreground"
            data-testid="review-pilot-fallback"
          >
            If the review request flow is unavailable, you can always{' '}
            <Link href="/pilot" className="font-semibold text-foreground underline-offset-4 hover:underline">
              request a 30-day pilot
            </Link>
            {' '}instead — the pilot intake captures the same context and never
            requires a live backend session.
          </div>
        </div>
      </div>
    </main>
  );
}
