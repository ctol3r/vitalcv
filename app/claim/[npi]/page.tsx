'use client';

/**
 * Claim Page - NPI Claim Wizard
 */

import { ClaimWizard } from '@/components/ClaimWizard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatNpi } from '@/lib/npi-client';
import { ArrowLeft, CheckCircle2, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ClaimPage() {
  const params = useParams();
  const router = useRouter();
  const npi = params.npi as string;

  const [completedLevel, setCompletedLevel] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleComplete = (level: number) => {
    setCompletedLevel(level);

    // Show success message based on level
    if (level >= 1) {
      setShowSuccess(true);
    }

    // If Level 3 is complete, redirect to wallet after a delay
    if (level === 3) {
      setTimeout(() => {
        router.push('/wallet');
      }, 3000);
    }
  };

  return (
    <div className="container max-w-3xl py-12 space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/npi/${npi}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to NPI Profile
          </Button>
        </Link>
        <div className="text-sm text-muted-foreground">NPI: {formatNpi(npi)}</div>
      </div>

      {showSuccess && completedLevel && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-900 dark:text-green-200">
            {completedLevel === 1 && (
              <>
                <strong>Email verified!</strong> You've reached Level 1 verification. Continue to
                verify your identity.
              </>
            )}
            {completedLevel === 2 && (
              <>
                <strong>Identity verified!</strong> You've reached Level 2 verification. Request
                issuer attestation for the highest level.
              </>
            )}
            {completedLevel === 3 && (
              <div className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5" />
                <div>
                  <strong>Attestation requested!</strong> You'll be notified when an issuer reviews
                  your request. Redirecting to wallet...
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center">
        <ClaimWizard npi={npi} onComplete={handleComplete} />
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3 mt-8">
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">L1</div>
          <div className="text-sm font-medium mt-1">Email Verified</div>
          <div className="text-xs text-muted-foreground mt-1">Basic account access</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">L2</div>
          <div className="text-sm font-medium mt-1">Identity Verified</div>
          <div className="text-xs text-muted-foreground mt-1">Share credentials</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">L3</div>
          <div className="text-sm font-medium mt-1">Issuer Attested</div>
          <div className="text-xs text-muted-foreground mt-1">Full verification</div>
        </div>
      </div>
    </div>
  );
}
