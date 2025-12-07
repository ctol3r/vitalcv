/**
 * Recruiter Offer Creation Page
 * Phase 1: Offer composer UI
 */

'use client';

import { OfferComposerView } from '@/components/offers/OfferComposerView';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function CreateOfferPage() {
  const router = useRouter();
  const [recruiterInfo, setRecruiterInfo] = useState<{
    recruiterDid: string;
    recruiterId: string;
    recruiterName?: string;
    recruiterOrgName?: string;
  } | null>(null);

  useEffect(() => {
    // TODO: Fetch recruiter info from API
    // For now, use mock data
    setRecruiterInfo({
      recruiterDid: 'did:example:recruiter123',
      recruiterId: 'recruiter-123',
      recruiterName: 'Recruiter User',
      recruiterOrgName: 'Healthcare Staffing Agency',
    });
  }, []);

  const handleOfferCreated = (offerId: string) => {
    router.push(`/recruiter/offers/${offerId}/preview`);
  };

  if (!recruiterInfo) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create Job Offer</h1>
        <p className="text-muted-foreground">
          Create a digitally signed job offer with credential requirements.
        </p>
      </header>

      <OfferComposerView
        recruiterDid={recruiterInfo.recruiterDid}
        recruiterId={recruiterInfo.recruiterId}
        recruiterName={recruiterInfo.recruiterName}
        recruiterOrgName={recruiterInfo.recruiterOrgName}
        onOfferCreated={handleOfferCreated}
      />
    </div>
  );
}

