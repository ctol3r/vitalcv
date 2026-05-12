'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PassportWallet from '@/components/passport/PassportWallet';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { TrustHeader } from '@/components/trust';
import { fetchPassportEntity } from '@/lib/api';
import type { PassportData } from '@/lib/trust/passport-contract';
import { KnowledgeInboxPanel } from '@/components/knowledge-inbox/KnowledgeInboxPanel';
import type { KnowledgeInboxItem } from '@/lib/knowledge-inbox/types';
import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';

interface PassportEntityClientProps {
  entityId: string;
}

export default function PassportEntityClient({ entityId }: PassportEntityClientProps) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      const result = await fetchPassportEntity(entityId);
      if (cancelled) {
        return;
      }

      setPassport(result.ok ? result.body : null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  if (loading) {
    return <PassportWallet loading />;
  }

  if (!passport) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-in-up">
          <TrustStateCard
            eyebrow="Passport"
            title="Passport not available"
            description="This passport hasn't been generated yet. Run a readiness check first to create a source-backed passport."
            centered
            actions={(
              <div className="flex w-full flex-col gap-2">
                <Button asChild variant="default" className="h-11 w-full rounded-full">
                  <Link href="/passport">Check readiness</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full rounded-full border-border bg-card text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground">
                  <Link href="/">Return home</Link>
                </Button>
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  // GOD-3: Inbox is mounted here as a UI surface. Real items arrive
  // once a backend endpoint provides them; until then the panel
  // renders its empty state. We never synthesize fake items and we
  // never auto-mark anything verified. No external model calls happen
  // in classification — see lib/knowledge-inbox/classifyInboxItem.ts.
  const inboxItems: KnowledgeInboxItem[] = [];

  // Canonical TrustHeader — single source for the institutional reading
  // order on the passport surface. Adopts Lane B primitives without
  // changing the existing PassportWallet rendering below.
  // Channel = the first checked launch-spine source; ownership and runId
  // are stubbed where data isn't threaded yet (Lane D plumbing).
  const channel = passport.sources?.checked?.[0] ?? 'unknown';
  const ownershipClaimant = passport.identity.displayName;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="mx-auto max-w-[480px] sm:max-w-[640px] md:max-w-3xl lg:max-w-4xl px-4 w-full">
        <TrustHeader
          variant="SNAPSHOT"
          object={{
            id: passport.identity.npi ?? passport.entityId,
            label: passport.identity.displayName,
            kind: passport.identity.entityType.toLowerCase(),
          }}
          ownership={{ state: 'UNCLAIMED', claimant: ownershipClaimant }}
          checkedAt={passport.lastCheckedAt}
          channel={channel}
          runId={passport.entityId}
        />
      </div>
      <PassportWallet passport={passport} />
      <div className="mx-auto max-w-[480px] sm:max-w-[640px] md:max-w-3xl lg:max-w-4xl px-4 w-full space-y-8">
        <section
          aria-label="Source health"
          data-testid="passport-lane-health-mount"
        >
          <LaneHealthMount heading="Source health" />
        </section>
        <section
          className="rounded-2xl border border-border bg-background/60 p-5 sm:p-6"
          aria-label="Knowledge Inbox"
          data-testid="passport-knowledge-inbox-mount"
        >
          <header className="mb-4 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Knowledge Inbox
            </p>
            <h3 className="text-base font-semibold text-foreground">
              Captured but not yet source-verified
            </h3>
            <p className="text-xs text-muted-foreground/80">
              The inbox is where new clinician-supplied evidence is staged.
              Items here are user-entered or inferred; nothing is
              automatically marked verified, and classification runs
              deterministically without external model calls.
            </p>
          </header>
          <KnowledgeInboxPanel items={inboxItems} />
        </section>
      </div>
    </div>
  );
}
