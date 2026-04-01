import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

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
              Review a clinician&apos;s readiness
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Review a source-backed readiness snapshot before making a hiring decision.
              Open a passport link from a clinician, or create a new review from an NPI.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="h-11 w-full rounded-xl">
              <Link href="/review/request">Request a passport review</Link>
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
