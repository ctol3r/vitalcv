'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PassportWallet from '@/components/passport/PassportWallet';
import { ClinicianProfileSections } from '@/components/profile/ClinicianProfileSections';
import { KnowledgeTrustGraphPanel } from '@/components/trust/KnowledgeTrustGraphPanel';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { fetchPassportEntity } from '@/lib/api';
import type { PassportData } from '@/lib/trust/passport-contract';

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

  return (
    <div className="bg-background">
      <PassportWallet passport={passport} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <KnowledgeTrustGraphPanel className="mt-6" />
        <ClinicianProfileSections passport={passport} />
      </div>
    </div>
  );
}
