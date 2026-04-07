import type { Metadata } from 'next';
import React from 'react';
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
  },
};

export default function ReviewLandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
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
            <Button asChild className="h-11 w-full rounded-xl">
              <Link href="/review/request">Request pilot review</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full rounded-xl">
              <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup}>Start with NPI lookup</Link>
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
