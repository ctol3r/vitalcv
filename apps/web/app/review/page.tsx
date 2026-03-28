import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

export default function ReviewLandingPage() {
  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in-up space-y-4">
        <TrustStateCard
          eyebrow="Employer review"
          title="Open a shared passport review"
          description={(
            <>
              <span>Employer review opens from a real passport share link.</span>
              <span className="block pt-2 text-white/30">
                Access required lanes stay attached to the passport itself. Start from NPI lookup, then share when a real passport exists.
              </span>
            </>
          )}
          tone="warning"
          centered
          actions={(
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline" className="h-11 rounded-full border-white/10 bg-white/4 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white">
                <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup}>Start with NPI lookup</Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 rounded-full text-white/45 hover:bg-white/5 hover:text-white/70">
                <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}>View passport</Link>
              </Button>
            </div>
          )}
        />
        {/* Employer path */}
        <div className="text-center pt-2">
          <p className="text-white/25 text-xs mb-2">Are you an employer?</p>
          <Button asChild variant="outline" className="h-10 rounded-full border-white/10 bg-white/4 text-xs text-white/55 hover:border-white/20 hover:bg-white/7 hover:text-white">
            <Link href="/review/request">Request a passport review</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
