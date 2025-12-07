'use client';

/**
 * NPI Public Profile Page - Display public NPI information with sliding pane for claim
 */

import { ClaimWizardPane } from '@/components/claim/ClaimWizardPane';
import { NpiPublicCard } from '@/components/NpiPublicCard';
import { NPIFreshnessBadge } from '@/components/NPIFreshnessBadge';
import { PaneProvider, usePanes } from '@/components/panes/PaneManager';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NpiRecord } from '@/lib/npi-types';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function NpiProfileContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const npi = params.npi as string;
  const auto = searchParams.get('auto') === '1';

  const [record, setRecord] = useState<NpiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = usePanes();

  // Auto-open claim wizard if ?auto=1
  useEffect(() => {
    if (auto && record && !isLoading) {
      push({
        title: `Claim NPI ${record.npi}`,
        content: <ClaimWizardPane npi={record.npi} />,
        width: 700,
      });
    }
  }, [auto, record, isLoading, push]);

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-12 space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="container max-w-3xl py-12 space-y-6">
        <Link href="/start">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
        </Link>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'NPI not found'}</AlertDescription>
        </Alert>

        <div className="text-center py-12">
          <p className="text-muted-foreground">Please try searching for a different NPI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-12 space-y-6">
      <Link href="/start">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>
      </Link>

      <NpiPublicCard record={record} showClaimButton={false} />

      {/* NPI Freshness Badge */}
      {record.lastUpdated && (
        <div className="flex items-center gap-2">
          <NPIFreshnessBadge lastSynced={record.lastUpdated} source="NPPES" />
        </div>
      )}

      {/* Additional Actions */}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          size="lg"
          onClick={() =>
            push({
              title: `Claim NPI ${record.npi}`,
              content: <ClaimWizardPane npi={record.npi} />,
              width: 700,
            })
          }
        >
          Claim this NPI (opens pane)
        </Button>
        <Button variant="outline" size="lg" onClick={() => router.push('/start')}>
          Search Another
        </Button>
      </div>
    </div>
  );
}

export default function NpiProfilePage() {
  return (
    <PaneProvider>
      <NpiProfileContent />
    </PaneProvider>
  );
}
