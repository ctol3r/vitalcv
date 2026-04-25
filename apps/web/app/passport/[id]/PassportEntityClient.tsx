'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PassportWallet from '@/components/passport/PassportWallet';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { fetchPassportEntity } from '@/lib/api';
import type { PassportData } from '@/lib/trust/passport-contract';
import { ClinicianProfileSections, type ClinicianProfileData } from '@/components/profile/ClinicianProfileSections';
import { KnowledgeTrustGraphPanel } from '@/components/trust/KnowledgeTrustGraphPanel';

function buildMockProfileData(passport: PassportData): ClinicianProfileData {
  return {
    identity: { value: passport.identity.displayName, provenance: 'VERIFIED' },
    contact: { value: '', provenance: 'UNKNOWN' },
    locations: { value: [], provenance: 'UNKNOWN' },
    medicalSchool: { value: '', provenance: 'UNKNOWN' },
    residency: { value: '', provenance: 'UNKNOWN' },
    fellowship: { value: '', provenance: 'UNKNOWN' },
    specialty: { value: passport.identity.specialty || '', provenance: 'VERIFIED' },
    subspecialty: { value: '', provenance: 'UNKNOWN' },
    boardCertifications: { value: [], provenance: 'UNKNOWN' },
    licenses: { value: [], provenance: 'UNKNOWN' },
    workHistory: { value: [], provenance: 'UNKNOWN' },
    affiliations: { value: [], provenance: 'UNKNOWN' },
    research: { value: [], provenance: 'UNKNOWN' },
    publications: { value: [], provenance: 'UNKNOWN' },
    documents: { value: [], provenance: 'UNKNOWN' },
    careerGoals: { value: '', provenance: 'UNKNOWN' },
  };
}

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
    <div className="flex flex-col gap-8 pb-16">
      <PassportWallet passport={passport} />
      <div className="mx-auto max-w-[480px] sm:max-w-[640px] md:max-w-3xl lg:max-w-4xl px-4 w-full space-y-8">
        <KnowledgeTrustGraphPanel />
        <ClinicianProfileSections data={buildMockProfileData(passport)} />
      </div>
    </div>
  );
}
