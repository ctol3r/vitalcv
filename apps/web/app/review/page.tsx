import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
      <div className="mx-auto max-w-sm px-4 pt-20 pb-16">
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Employer review
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Review readiness for an active hiring decision
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Review a source-backed readiness snapshot before making a credentialing or recruiting decision.
              Start with pilot review request from NPI, or open an existing passport review link.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/review/request"
              className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-white transition hover:opacity-90 bg-primary"
            >
              Request pilot review
            </Link>
            <Button asChild variant="outline" className="h-11 w-full rounded-xl">
              <Link href="/passport">Start with NPI lookup</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60">
            No login required to view a shared passport link.
          </p>
        </div>
      </div>
    </main>
  );
}
